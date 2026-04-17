import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, ScrollView,
  TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getBeds, addBed, deleteBed } from '../services/bedsService';
import { getActiveCropsForPlot, markWatered } from '../services/cropsService';
import { updatePlot } from '../services/plotsService';
import SmartBedGrid, { getPlotGridInfo, suggestCellSize } from '../components/SmartBedGrid';
import BedListItem from '../components/BedListItem';

function daysRemainingFor(crop) {
  if (!crop?.plantedAt) return null;
  const planted = crop.plantedAt.toDate ? crop.plantedAt.toDate() : new Date(crop.plantedAt);
  return Math.ceil((planted.getTime() + crop.harvestDays * 86400000 - Date.now()) / 86400000);
}

export default function PlotDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { plot } = route.params;

  const [beds, setBeds]             = useState([]);
  const [cropsByBed, setCropsByBed] = useState({});
  const [loading, setLoading]       = useState(true);
  const [viewMode, setViewMode]     = useState('list');   // 'list' | 'grid'
  const [editMode, setEditMode]     = useState(false);
  const [search, setSearch]         = useState('');
  const [cellSize, setCellSize]     = useState(plot.cellSize ?? null);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgCellSize, setCfgCellSize] = useState(null);
  const [applying, setApplying]     = useState(false);

  // ── Plot dimensions ──────────────────────────────────────────────────────────
  const plotDims = useMemo(() => {
    if (plot.polygon?.length >= 3) {
      const info = getPlotGridInfo(plot.polygon, 1);
      return { w: info.widthM, h: info.heightM };
    }
    if (plot.widthM && plot.lengthM) return { w: plot.widthM, h: plot.lengthM };
    const side = Math.sqrt(Math.max(1, plot.area ?? 25));
    return { w: side, h: side };
  }, [plot]);

  // ── Data loading ─────────────────────────────────────────────────────────────
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

  useEffect(() => {
    navigation.setOptions({ title: plot.name });
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, plot.name, load]);

  // ── Grid config ──────────────────────────────────────────────────────────────
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

  // ── Bed actions ───────────────────────────────────────────────────────────────
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

  // ── Stats ────────────────────────────────────────────────────────────────────
  const activeCrops = Object.values(cropsByBed).filter(Boolean);
  const readyCount  = activeCrops.filter(c => (daysRemainingFor(c) ?? 1) <= 0).length;

  // ── List mode data ───────────────────────────────────────────────────────────
  const filteredBeds = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return beds;
    return beds.filter(bed => {
      const crop = cropsByBed[bed.id];
      return bed.label.toLowerCase().includes(q)
          || (crop?.name ?? '').toLowerCase().includes(q);
    });
  }, [beds, search, cropsByBed]);

  // ── Grid config preview ──────────────────────────────────────────────────────
  const previewGrid = cfgCellSize ? {
    rows: Math.max(1, Math.ceil(plotDims.h / cfgCellSize)),
    cols: Math.max(1, Math.ceil(plotDims.w / cfgCellSize)),
  } : null;

  // ── Render helpers ───────────────────────────────────────────────────────────
  const navigateToBed = bed => navigation.navigate('BedDetail', { bed, plotId: plot.id });

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

  // ── LIST MODE ─────────────────────────────────────────────────────────────────
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

  // ── GRID MODE ─────────────────────────────────────────────────────────────────
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

  // ── EMPTY STATE (no grid configured) ────────────────────────────────────────
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

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {statsRow}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f7f4' },

  // ── Stats ─────────────────────────────────────────────────────────────────────
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
  statValue:  { fontSize: 24, fontWeight: '800', color: '#2d6a4f' },
  statLabel:  { fontSize: 11, color: '#888', marginTop: 2, fontWeight: '500' },

  // ── Segmented control ────────────────────────────────────────────────────────
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
  segActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segText:       { fontSize: 13, fontWeight: '600', color: '#6aad8a' },
  segTextActive: { color: '#1a3c2d' },

  gearBtn: {
    padding: 8,
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
  },
  gearIcon: { fontSize: 20, color: '#2d6a4f' },

  // ── Search ───────────────────────────────────────────────────────────────────
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

  // ── Empty / hints ────────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 56 },
  emptyEmoji: { fontSize: 60, marginBottom: 12 },
  emptyText:  { textAlign: 'center', marginTop: 40, fontSize: 15, color: '#bbb' },

  setupBtn: {
    backgroundColor: '#2d6a4f',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 3,
    marginTop: 16,
  },
  setupBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Grid mode ────────────────────────────────────────────────────────────────
  editBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  editBannerText: { color: '#1565c0', fontWeight: '600', fontSize: 14, textAlign: 'center' },
  gridHint: { textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 10 },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 24, right: 24,
    width: 58, height: 58,
    borderRadius: 29,
    backgroundColor: '#2d6a4f',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabCancel: { backgroundColor: '#c62828' },
  fabText:   { fontSize: 28, color: '#fff', lineHeight: 34 },

  // ── Config modal ──────────────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#ddd',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20, fontWeight: '700', color: '#1a3c2d',
    textAlign: 'center', marginBottom: 12,
  },
  plotDimsText: { fontSize: 13, color: '#777', textAlign: 'center', marginBottom: 20 },
  cellSizeLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 10 },
  cellSizeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  cellSizeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#e8f5e9', borderWidth: 1.5, borderColor: '#a5d6a7', alignItems: 'center',
  },
  cellSizeBtnActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  cellSizeBtnText:       { fontWeight: '700', fontSize: 14, color: '#2d6a4f' },
  cellSizeBtnTextActive: { color: '#fff' },
  previewBox: {
    backgroundColor: '#f8fffe', borderRadius: 12, paddingVertical: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#d0ede0', alignItems: 'center',
  },
  previewText:     { fontSize: 14, color: '#555', fontWeight: '500' },
  createBtn: {
    backgroundColor: '#2d6a4f', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, elevation: 2,
  },
  createBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelSheetBtn:  { paddingVertical: 12, alignItems: 'center' },
  cancelSheetText: { color: '#999', fontSize: 15 },

  noResults: { textAlign: 'center', marginTop: 40, fontSize: 15, color: '#bbb' },
});
