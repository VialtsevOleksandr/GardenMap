import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, ScrollView,
  TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal,
  Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import { getBeds, addBed, deleteBed } from '../services/bedsService';
import { getActiveCropsForPlot, markWatered } from '../services/cropsService';
import { updatePlot } from '../services/plotsService';
import { getCurrentWeather } from '../services/weatherApi';
import { getPlotDryDays, setPlotDryDays, resetPlotDryDays } from '../services/storageService';
import { DRY_DAYS_THRESHOLD } from '../config';
import SmartBedGrid, { getPlotGridInfo, suggestCellSize } from '../components/SmartBedGrid';
import BedListItem from '../components/BedListItem';

function daysRemainingFor(crop) {
  if (!crop?.plantedAt) return null;
  const planted = crop.plantedAt.toDate ? crop.plantedAt.toDate() : new Date(crop.plantedAt);
  return Math.ceil((planted.getTime() + crop.harvestDays * 86400000 - Date.now()) / 86400000);
}

function weatherIcon(id) {
  if (!id) return '🌤';
  if (id >= 200 && id < 300) return '⛈';
  if (id >= 300 && id < 400) return '🌦';
  if (id >= 500 && id < 600) return '🌧';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫';
  if (id === 800) return '☀️';
  return '☁️';
}

export default function PlotDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { plot } = route.params;

  // ── Existing state ─────────────────────────────────────────────────────────
  const [beds, setBeds]               = useState([]);
  const [cropsByBed, setCropsByBed]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [viewMode, setViewMode]       = useState('list');
  const [editMode, setEditMode]       = useState(false);
  const [search, setSearch]           = useState('');
  const [cellSize, setCellSize]       = useState(plot.cellSize ?? null);
  const [showConfig, setShowConfig]   = useState(false);
  const [cfgCellSize, setCfgCellSize] = useState(null);
  const [applying, setApplying]       = useState(false);

  // ── Weather state ──────────────────────────────────────────────────────────
  const [weatherLoc, setWeatherLoc]       = useState(plot.weatherLocation ?? null);
  const [weather, setWeather]             = useState(null);
  const [dryDays, setDryDaysData]         = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFetchedAt, setWeatherFetchedAt] = useState(null);

  // ── Weather detail bottom sheet ────────────────────────────────────────────
  const [weatherDetail, setWeatherDetail] = useState(false);

  // ── Weather location modal state ───────────────────────────────────────────
  const [weatherModal, setWeatherModal] = useState(false);
  const [locQuery, setLocQuery]         = useState('');
  const [locSugg, setLocSugg]           = useState([]);
  const [locSearching, setLocSearching] = useState(false);
  const [pendingLoc, setPendingLoc]     = useState(null);

  const weatherLocRef = useRef(plot.weatherLocation ?? null);
  const locDebounce   = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    weatherLocRef.current = weatherLoc;
  }, [weatherLoc]);

  // ── Plot dimensions ────────────────────────────────────────────────────────
  const plotDims = useMemo(() => {
    if (plot.polygon?.length >= 3) {
      const info = getPlotGridInfo(plot.polygon, 1);
      return { w: info.widthM, h: info.heightM };
    }
    if (plot.widthM && plot.lengthM) return { w: plot.widthM, h: plot.lengthM };
    const side = Math.sqrt(Math.max(1, plot.area ?? 25));
    return { w: side, h: side };
  }, [plot]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bedsData, cropsData] = await Promise.all([
        getBeds(plot.id),
        getActiveCropsForPlot(plot.id),
      ]);
      setBeds(bedsData);
      const map = {};
      cropsData.forEach(c => { map[c.bedId] = c; });
      setCropsByBed(map);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [plot.id]);

  const doLoadWeather = useCallback(async (loc) => {
    if (!loc) return;
    setWeatherLoading(true);
    try {
      const data = await getCurrentWeather(loc.latitude, loc.longitude);
      setWeather(data);
      setWeatherFetchedAt(new Date());
      // Dry days counter
      const today = new Date().toDateString();
      const current = await getPlotDryDays(plot.id);
      if (current.lastChecked !== today) {
        const hasRain =
          (data.rain?.['1h'] ?? 0) > 0 ||
          (data.rain?.['3h'] ?? 0) > 0 ||
          (data.snow?.['1h'] ?? 0) > 0;
        if (hasRain) {
          await resetPlotDryDays(plot.id);
          setDryDaysData({ count: 0, lastRainAt: new Date().toISOString(), lastChecked: today });
        } else {
          const updated = {
            count: (current.count || 0) + 1,
            lastRainAt: current.lastRainAt,
            lastChecked: today,
          };
          await setPlotDryDays(plot.id, updated);
          setDryDaysData(updated);
        }
      } else {
        setDryDaysData(current);
      }
    } catch {
      // weather is non-critical — fail silently
    } finally {
      setWeatherLoading(false);
    }
  }, [plot.id]);

  // ── Navigation setup + focus listener ─────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: plot.name,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setWeatherModal(true)}
          style={{ marginRight: 14, padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 22 }}>🌦</Text>
        </TouchableOpacity>
      ),
    });
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, plot.name, load]);

  // Separate focus listener for weather (uses ref to avoid dep on weatherLoc)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (weatherLocRef.current) doLoadWeather(weatherLocRef.current);
    });
    // Also load on mount
    if (weatherLocRef.current) doLoadWeather(weatherLocRef.current);
    return unsub;
  }, [navigation, doLoadWeather]);

  // ── Grid config ────────────────────────────────────────────────────────────
  function openConfig() {
    setCfgCellSize(cellSize ?? suggestCellSize(plotDims.w, plotDims.h));
    setShowConfig(true);
  }

  async function applyConfig() {
    if (!cfgCellSize) return;
    const doApply = async () => {
      setApplying(true);
      try {
        if (beds.length > 0) await Promise.all(beds.map(b => deleteBed(b.id)));
        await updatePlot(plot.id, { cellSize: cfgCellSize });
        setCellSize(cfgCellSize);
        setShowConfig(false);
        await load();
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setApplying(false);
      }
    };
    if (beds.length > 0) {
      Alert.alert(t('resetGrid'), t('resetGridConfirm'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: doApply },
      ]);
    } else {
      await doApply();
    }
  }

  // ── Bed actions ────────────────────────────────────────────────────────────
  async function handleBedCreated({ label, row, col, spanRows, spanCols, widthM, heightM }) {
    await addBed(plot.id, label, row, col, spanRows, spanCols, widthM, heightM);
    setEditMode(false);
    await load();
  }

  function handleDeleteBed(bed) {
    Alert.alert(
      t('deleteBed'),
      t('deleteBedConfirm', { label: bed.label }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBed(bed.id);
              await load();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  }

  async function handleWater(crop) {
    try {
      await markWatered(crop.id);
      setCropsByBed(prev => ({
        ...prev,
        [crop.bedId]: { ...crop, lastWateredAt: { toDate: () => new Date() } },
      }));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ── Weather location search (Nominatim, Ukraine only) ─────────────────────
  function handleLocSearch(text) {
    setLocQuery(text);
    setPendingLoc(null);
    clearTimeout(locDebounce.current);
    if (text.length < 3) { setLocSugg([]); return; }
    locDebounce.current = setTimeout(() => fetchLocSugg(text), 500);
  }

  async function fetchLocSugg(text) {
    setLocSearching(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(text)}&format=json&limit=6&addressdetails=1&countrycodes=ua`;
      const res = await fetch(url, { headers: { 'User-Agent': 'GardenMapApp/1.0' } });
      const data = await res.json();
      setLocSugg(data);
    } catch {
      setLocSugg([]);
    } finally {
      setLocSearching(false);
    }
  }

  function buildLocName(item) {
    const a = item.address || {};
    const parts = [
      a.road || a.pedestrian || a.footway,
      a.house_number,
      a.city || a.town || a.village || a.suburb,
    ].filter(Boolean);
    return parts.length > 0
      ? parts.join(', ')
      : item.display_name.split(',').slice(0, 3).join(',').trim();
  }

  function selectLocSugg(item) {
    Keyboard.dismiss();
    setLocSugg([]);
    const name = buildLocName(item);
    const loc = {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: name,
    };
    setPendingLoc(loc);
    setLocQuery(name);
  }

  async function confirmWeatherLoc() {
    if (!pendingLoc) return;
    try {
      await updatePlot(plot.id, { weatherLocation: pendingLoc });
      weatherLocRef.current = pendingLoc;
      setWeatherLoc(pendingLoc);
      setWeatherModal(false);
      setLocSugg([]);
      doLoadWeather(pendingLoc);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  function openWeatherModal() {
    setPendingLoc(null);
    setLocQuery('');
    setLocSugg([]);
    setWeatherModal(true);
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const activeCrops = Object.values(cropsByBed).filter(Boolean);
  const readyCount  = activeCrops.filter(c => (daysRemainingFor(c) ?? 1) <= 0).length;
  const isDrought   = dryDays && dryDays.count >= DRY_DAYS_THRESHOLD;

  const filteredBeds = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return beds;
    return beds.filter(bed => {
      const crop = cropsByBed[bed.id];
      return bed.label.toLowerCase().includes(q)
          || (crop?.name ?? '').toLowerCase().includes(q);
    });
  }, [beds, search, cropsByBed]);

  const previewGrid = cfgCellSize ? {
    rows: Math.max(1, Math.ceil(plotDims.h / cfgCellSize)),
    cols: Math.max(1, Math.ceil(plotDims.w / cfgCellSize)),
  } : null;

  const navigateToBed = bed => navigation.navigate('BedDetail', { bed, plotId: plot.id });

  // ── Stats row ──────────────────────────────────────────────────────────────
  const statsRow = (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{plot.area ? plot.area.toFixed(0) : '—'}</Text>
        <Text style={styles.statLabel}>{t('area')} м²</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{beds.length}</Text>
        <Text style={styles.statLabel}>{t('beds')}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{activeCrops.length}</Text>
        <Text style={styles.statLabel}>{t('crop')}</Text>
      </View>
      {readyCount > 0 && (
        <View style={[styles.statCard, styles.readyStatCard]}>
          <Text style={[styles.statValue, { color: '#b71c1c' }]}>{readyCount}</Text>
          <Text style={[styles.statLabel, { color: '#b71c1c' }]}>🍅</Text>
        </View>
      )}
    </View>
  );

  // ── Weather strip ──────────────────────────────────────────────────────────
  const weatherStrip = weatherLoc ? (
    <TouchableOpacity
      style={[styles.weatherStrip, isDrought && styles.weatherStripAlert]}
      onPress={() => setWeatherDetail(true)}
      activeOpacity={0.75}
    >
      {weatherLoading && !weather ? (
        <ActivityIndicator size="small" color="#2d6a4f" />
      ) : weather ? (
        <>
          <View style={styles.weatherLeft}>
            <Text style={styles.weatherEmoji}>
              {weatherIcon(weather.weather?.[0]?.id)}
            </Text>
            <Text style={styles.weatherTemp}>{Math.round(weather.main?.temp)}°C</Text>
            <Text style={styles.weatherDesc} numberOfLines={1}>
              {weather.weather?.[0]?.description}
            </Text>
          </View>
          {dryDays !== null && (
            <View style={styles.weatherRight}>
              <Text style={styles.weatherDry}>
                {isDrought ? '🔥' : '☀️'}  {t('dryDays', { count: dryDays.count })}
              </Text>
              {isDrought && (
                <Text style={styles.weatherAlert}>⚠️ {t('droughtAlert', { count: dryDays.count })}</Text>
              )}
            </View>
          )}
        </>
      ) : (
        <Text style={styles.weatherNoData}>🌦 {weatherLoc.displayName}</Text>
      )}
    </TouchableOpacity>
  ) : null;

  // ── Segmented control + buttons ────────────────────────────────────────────
  const segmentedControl = cellSize && (
    <View style={styles.segRow}>
      <View style={styles.segControl}>
        <TouchableOpacity
          style={[styles.seg, viewMode === 'list' && styles.segActive]}
          onPress={() => { setViewMode('list'); setEditMode(false); }}
        >
          <Text style={[styles.segText, viewMode === 'list' && styles.segTextActive]}>
            📋 {t('listMode')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.seg, viewMode === 'grid' && styles.segActive]}
          onPress={() => setViewMode('grid')}
        >
          <Text style={[styles.segText, viewMode === 'grid' && styles.segTextActive]}>
            ⊞ {t('planMode')}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.gearBtn} onPress={openConfig}>
        <Text style={styles.gearIcon}>⚙</Text>
      </TouchableOpacity>
    </View>
  );

  // ── List mode ──────────────────────────────────────────────────────────────
  const listMode = (
    <FlatList
      data={filteredBeds}
      keyExtractor={item => item.id}
      contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
      ListHeaderComponent={
        <TextInput
          style={styles.search}
          placeholder={t('search')}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>{search ? t('noResults') : t('noBeds')}</Text>
      }
      renderItem={({ item }) => (
        <BedListItem
          bed={item}
          crop={cropsByBed[item.id] ?? null}
          onPress={() => navigateToBed(item)}
          onWater={handleWater}
        />
      )}
    />
  );

  // ── Grid mode ──────────────────────────────────────────────────────────────
  const gridMode = (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 100 }}
      scrollEnabled={!editMode}
    >
      {editMode && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>✏ {t('dragToSelectBed')}</Text>
        </View>
      )}
      <Text style={styles.gridHint}>
        ☐ = {cellSize}м · {beds.length} {t('beds')}
      </Text>
      <SmartBedGrid
        beds={beds}
        cropsByBed={cropsByBed}
        plot={plot}
        cellSize={cellSize}
        editMode={editMode}
        onBedCreated={handleBedCreated}
        onDeleteBed={handleDeleteBed}
        onPressBed={navigateToBed}
      />
    </ScrollView>
  );

  // ── Empty state (no grid) ──────────────────────────────────────────────────
  const emptyState = (
    <ScrollView contentContainerStyle={{ flex: 1 }}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🌿</Text>
        <Text style={styles.emptyText}>{t('noBeds')}</Text>
        <TouchableOpacity style={styles.setupBtn} onPress={openConfig}>
          <Text style={styles.setupBtnText}>{t('configureGrid')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {statsRow}
      {weatherStrip}
      {segmentedControl}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#2d6a4f" />
      ) : !cellSize ? (
        emptyState
      ) : viewMode === 'list' ? (
        listMode
      ) : (
        gridMode
      )}

      {/* FABs — grid mode only */}
      {cellSize && viewMode === 'grid' && !editMode && (
        <TouchableOpacity style={styles.fab} onPress={() => setEditMode(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
      {viewMode === 'grid' && editMode && (
        <TouchableOpacity style={[styles.fab, styles.fabCancel]} onPress={() => setEditMode(false)}>
          <Text style={styles.fabText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Grid config modal */}
      <Modal
        visible={showConfig}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfig(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('configureGrid')}</Text>

            <Text style={styles.plotDimsText}>
              {t('plotDimensions', { w: plotDims.w.toFixed(0), h: plotDims.h.toFixed(0) })}
            </Text>

            <Text style={styles.cellSizeLabel}>{t('cellSizeLabel')}</Text>
            <View style={styles.cellSizeRow}>
              {[0.5, 1, 2, 5].map(sz => (
                <TouchableOpacity
                  key={sz}
                  style={[styles.cellSizeBtn, cfgCellSize === sz && styles.cellSizeBtnActive]}
                  onPress={() => setCfgCellSize(sz)}
                >
                  <Text style={[styles.cellSizeBtnText, cfgCellSize === sz && styles.cellSizeBtnTextActive]}>
                    {sz}м
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {previewGrid && (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  {previewGrid.rows} × {previewGrid.cols} = {previewGrid.rows * previewGrid.cols} {t('beds').toLowerCase()}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.createBtn, (!cfgCellSize || applying) && { opacity: 0.5 }]}
              onPress={applyConfig}
              disabled={applying || !cfgCellSize}
            >
              {applying
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>{t('save')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelSheetBtn} onPress={() => setShowConfig(false)}>
              <Text style={styles.cancelSheetText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Weather detail bottom sheet */}
      <Modal
        visible={weatherDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setWeatherDetail(false)}
      >
        <TouchableOpacity
          style={styles.detailOverlay}
          activeOpacity={1}
          onPress={() => setWeatherDetail(false)}
        >
          <View style={styles.detailSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.detailHandle} />

            {/* Location + change */}
            <View style={styles.detailLocRow}>
              <View style={styles.detailLocLeft}>
                <Text style={styles.detailLocName} numberOfLines={1}>
                  📍 {weatherLoc?.displayName}
                </Text>
                {weatherFetchedAt && (
                  <Text style={styles.detailUpdatedAt}>
                    {t('weatherUpdatedAt', {
                      time: weatherFetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    })}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => { setWeatherDetail(false); openWeatherModal(); }}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              >
                <Text style={styles.detailChangeText}>{t('change')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailDivider} />

            {weatherLoading ? (
              <ActivityIndicator size="large" color="#2d6a4f" style={{ marginVertical: 24 }} />
            ) : weather ? (
              <>
                {/* Icon + temp + description */}
                <View style={styles.detailMain}>
                  <Text style={styles.detailMainIcon}>
                    {weatherIcon(weather.weather?.[0]?.id)}
                  </Text>
                  <View>
                    <Text style={styles.detailMainTemp}>{Math.round(weather.main?.temp)}°C</Text>
                    <Text style={styles.detailMainDesc}>{weather.weather?.[0]?.description}</Text>
                  </View>
                </View>

                {/* Humidity / wind / feels like */}
                <View style={styles.detailStatsRow}>
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatVal}>{weather.main?.humidity}%</Text>
                    <Text style={styles.detailStatLabel}>💧 {t('humidity')}</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatVal}>{Math.round(weather.wind?.speed)} м/с</Text>
                    <Text style={styles.detailStatLabel}>💨 {t('wind')}</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatVal}>{Math.round(weather.main?.feels_like)}°</Text>
                    <Text style={styles.detailStatLabel}>🌡 {t('feelsLike')}</Text>
                  </View>
                </View>

                {/* Dry days */}
                {dryDays !== null && (
                  <View style={[styles.detailDryRow, isDrought && styles.detailDryAlert]}>
                    <Text style={styles.detailDryText}>
                      {isDrought ? '🔥' : '☀️'}  {t('dryDays', { count: dryDays.count })}
                    </Text>
                    {isDrought && (
                      <Text style={styles.detailAlertText}>
                        ⚠️ {t('droughtAlert', { count: dryDays.count })}
                      </Text>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.detailRefreshBtn}
                  onPress={() => { if (weatherLoc) doLoadWeather(weatherLoc); }}
                >
                  <Text style={styles.detailRefreshText}>{t('refreshWeather')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Weather location modal */}
      <Modal
        visible={weatherModal}
        animationType="slide"
        onRequestClose={() => { setWeatherModal(false); setLocSugg([]); }}
      >
        <KeyboardAvoidingView
          style={styles.locModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.locHeader}>
            <TouchableOpacity
              onPress={() => { setWeatherModal(false); setLocSugg([]); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.locCancel}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.locTitle}>{t('weatherLocationTitle')}</Text>
            <TouchableOpacity
              onPress={confirmWeatherLoc}
              disabled={!pendingLoc}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.locSave, !pendingLoc && styles.locSaveDisabled]}>
                {t('save')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={styles.locSearchRow}>
            <TextInput
              style={styles.locSearch}
              placeholder={t('searchAddress')}
              placeholderTextColor="#999"
              value={locQuery}
              onChangeText={handleLocSearch}
              autoFocus
              returnKeyType="search"
            />
            {locSearching && (
              <ActivityIndicator size="small" color="#2d6a4f" style={{ marginLeft: 8 }} />
            )}
          </View>

          {/* Current saved location (shown when not searching) */}
          {!locQuery && weatherLoc && locSugg.length === 0 && !pendingLoc && (
            <View style={styles.locCurrentBox}>
              <Text style={styles.locCurrentLabel}>{t('currentLocation')}</Text>
              <Text style={styles.locCurrentName}>📍 {weatherLoc.displayName}</Text>
            </View>
          )}

          {/* Suggestions list */}
          {locSugg.length > 0 && (
            <FlatList
              data={locSugg}
              keyExtractor={item => String(item.place_id ?? item.lat + item.lon)}
              style={styles.locList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.locItem} onPress={() => selectLocSugg(item)}>
                  <Text style={styles.locItemMain}>{buildLocName(item)}</Text>
                  <Text style={styles.locItemSub} numberOfLines={1}>{item.display_name}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Mini satellite map preview */}
          {pendingLoc && locSugg.length === 0 && (
            <>
              <MapView
                key={`${pendingLoc.latitude},${pendingLoc.longitude}`}
                style={styles.locMap}
                provider={PROVIDER_GOOGLE}
                mapType="hybrid"
                initialRegion={{
                  latitude: pendingLoc.latitude,
                  longitude: pendingLoc.longitude,
                  latitudeDelta: 0.004,
                  longitudeDelta: 0.004,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: pendingLoc.latitude,
                    longitude: pendingLoc.longitude,
                  }}
                />
              </MapView>
              <View style={styles.locBadge}>
                <Text style={styles.locBadgeText} numberOfLines={2}>
                  📍 {pendingLoc.displayName}
                </Text>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const GREEN = '#2d6a4f';
const GREEN_LIGHT = '#d8f3dc';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f7f4' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  readyStatCard: { borderWidth: 1.5, borderColor: '#ef9a9a' },
  statValue:  { fontSize: 24, fontWeight: '800', color: GREEN },
  statLabel:  { fontSize: 11, color: '#888', marginTop: 2, fontWeight: '500' },

  // Weather strip
  weatherStrip: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    minHeight: 46,
  },
  weatherStripAlert: {
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#ffcc02',
  },
  weatherLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  weatherEmoji:  { fontSize: 22, marginRight: 8 },
  weatherTemp:   { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginRight: 8 },
  weatherDesc:   { fontSize: 12, color: '#777', flex: 1 },
  weatherRight:  { alignItems: 'flex-end', marginLeft: 8 },
  weatherDry:    { fontSize: 12, color: '#555', fontWeight: '500' },
  weatherAlert:  { fontSize: 11, color: '#b07000', fontWeight: '600', marginTop: 2 },
  weatherNoData: { fontSize: 13, color: '#888' },

  // Segmented control
  segRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 10,
  },
  segControl: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#e2ede8',
    borderRadius: 14,
    padding: 3,
  },
  seg: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
  },
  segActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segText:       { fontSize: 13, fontWeight: '600', color: '#6aad8a' },
  segTextActive: { color: '#1a3c2d' },

  gearBtn: {
    padding: 8,
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
  },
  gearIcon: { fontSize: 20, color: GREEN },

  // Search
  search: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#dde8e2',
    color: '#1a1a1a',
  },

  // Empty
  emptyState:    { alignItems: 'center', paddingVertical: 56 },
  emptyEmoji:    { fontSize: 60, marginBottom: 12 },
  emptyText:     { textAlign: 'center', marginTop: 40, fontSize: 15, color: '#bbb' },
  setupBtn:      { backgroundColor: GREEN, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28, elevation: 3, marginTop: 16 },
  setupBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Grid mode
  editBanner: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#e3f2fd', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#90caf9',
  },
  editBannerText: { color: '#1565c0', fontWeight: '600', fontSize: 14, textAlign: 'center' },
  gridHint:       { textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 10 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24, right: 24,
    width: 58, height: 58,
    borderRadius: 29,
    backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  fabCancel: { backgroundColor: '#c62828' },
  fabText:   { fontSize: 28, color: '#fff', lineHeight: 34 },

  // Grid config modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#ddd',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle:    { fontSize: 20, fontWeight: '700', color: '#1a3c2d', textAlign: 'center', marginBottom: 12 },
  plotDimsText:  { fontSize: 13, color: '#777', textAlign: 'center', marginBottom: 20 },
  cellSizeLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 10 },
  cellSizeRow:   { flexDirection: 'row', gap: 10, marginBottom: 20 },
  cellSizeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#e8f5e9', borderWidth: 1.5, borderColor: '#a5d6a7', alignItems: 'center',
  },
  cellSizeBtnActive:     { backgroundColor: GREEN, borderColor: GREEN },
  cellSizeBtnText:       { fontWeight: '700', fontSize: 14, color: GREEN },
  cellSizeBtnTextActive: { color: '#fff' },
  previewBox: {
    backgroundColor: '#f8fffe', borderRadius: 12, paddingVertical: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#d0ede0', alignItems: 'center',
  },
  previewText:     { fontSize: 14, color: '#555', fontWeight: '500' },
  createBtn: {
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, elevation: 2,
  },
  createBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelSheetBtn:  { paddingVertical: 12, alignItems: 'center' },
  cancelSheetText: { color: '#999', fontSize: 15 },

  // Weather location modal
  locModal:  { flex: 1, backgroundColor: '#fff' },
  locHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  locCancel:      { fontSize: 15, color: '#888' },
  locTitle:       { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  locSave:        { fontSize: 15, color: GREEN, fontWeight: '700' },
  locSaveDisabled:{ color: '#ccc' },

  locSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f4f4f4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locSearch: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#333' },

  locCurrentBox: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 14,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 10,
  },
  locCurrentLabel: { fontSize: 11, color: GREEN, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  locCurrentName:  { fontSize: 14, color: '#1a3c2d', fontWeight: '500' },

  locList: { maxHeight: 280, borderBottomWidth: 1, borderBottomColor: '#eee' },
  locItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  locItemMain: { fontSize: 14, color: '#222', fontWeight: '500', marginBottom: 2 },
  locItemSub:  { fontSize: 12, color: '#888' },

  locMap: {
    marginHorizontal: 12,
    marginTop: 12,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  locBadge: {
    margin: 12,
    marginTop: 8,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 8,
    padding: 10,
  },
  locBadgeText: { fontSize: 13, color: GREEN, fontWeight: '500' },

  noResults: { textAlign: 'center', marginTop: 40, fontSize: 15, color: '#bbb' },

  // Weather detail bottom sheet
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  detailHandle: {
    width: 40, height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLocLeft:    { flex: 1, marginRight: 12 },
  detailLocName:    { fontSize: 13, color: '#555' },
  detailUpdatedAt:  { fontSize: 11, color: '#bbb', marginTop: 2 },
  detailChangeText: { fontSize: 14, color: GREEN, fontWeight: '600' },
  detailDivider:    { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  detailMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  detailMainIcon: { fontSize: 52 },
  detailMainTemp: { fontSize: 42, fontWeight: '700', color: '#1a1a1a', lineHeight: 48 },
  detailMainDesc: { fontSize: 14, color: '#666', textTransform: 'capitalize', marginTop: 2 },
  detailStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#f4faf6',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  detailStatItem:   { flex: 1, alignItems: 'center' },
  detailStatVal:    { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  detailStatLabel:  { fontSize: 11, color: '#888', marginTop: 4 },
  detailStatDivider:{ width: 1, height: 30, backgroundColor: '#d8ede2' },
  detailDryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  detailDryAlert:   { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffcc02' },
  detailDryText:    { fontSize: 14, color: '#444', fontWeight: '500' },
  detailAlertText:  { fontSize: 12, color: '#b07000', fontWeight: '600' },
  detailRefreshBtn: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: GREEN,
  },
  detailRefreshText: { color: GREEN, fontSize: 14, fontWeight: '600' },
});
