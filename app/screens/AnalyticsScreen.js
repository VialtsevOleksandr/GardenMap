import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  Dimensions, TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { getPlots } from '../services/plotsService';
import { getBeds } from '../services/bedsService';
import { getAllCropsForPlot } from '../services/cropsService';
import { getHarvestsForPlot } from '../services/harvestsService';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_INNER = SCREEN_W - 64;
const PAGE_SIZE   = 5;

const GREEN       = '#2d6a4f';
const GREEN_DARK  = '#1a3c2d';
const GREEN_LIGHT = '#e8f5e9';

const MONTHS_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
const DAY_ABBR     = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const QUALITY_COLORS = { excellent:'#2d6a4f', good:'#52b788', average:'#fb8c00', poor:'#ef5350' };

const chartCfg = {
  backgroundColor:'#fff', backgroundGradientFrom:'#fff', backgroundGradientTo:'#fff',
  decimalPlaces: 1,
  color:      (o = 1) => `rgba(45,106,79,${o})`,
  labelColor: (o = 1) => `rgba(80,100,90,${o})`,
  propsForBackgroundLines: { strokeOpacity: 0.12 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function getMonday(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatNavLabel(scale, year, month, weekStart) {
  if (scale === 'year')  return String(year);
  if (scale === 'month') return `${MONTHS_SHORT[month]} ${year}`;
  if (scale === 'week' && weekStart) {
    const ws = new Date(weekStart);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const sm = MONTHS_SHORT[ws.getMonth()], em = MONTHS_SHORT[we.getMonth()];
    return sm === em
      ? `${ws.getDate()}–${we.getDate()} ${sm}`
      : `${ws.getDate()} ${sm}–${we.getDate()} ${em}`;
  }
  return '';
}

// Returns { labels[], values[], barItems[][] } for the given scale/period.
// items: array; getDateFn(item)→Date|null; getValueFn(item)→number
function computeBars(items, getDateFn, getValueFn, scale, year, month, weekStart) {
  if (scale === 'year') {
    const values = Array(12).fill(0);
    const barItems = Array.from({ length: 12 }, () => []);
    items.forEach(item => {
      const d = getDateFn(item);
      if (d && d.getFullYear() === year) {
        const m = d.getMonth();
        values[m] = Math.round((values[m] + getValueFn(item)) * 10) / 10;
        barItems[m].push(item);
      }
    });
    return { labels: MONTHS_SHORT, values, barItems };
  }
  if (scale === 'month') {
    const values = Array(4).fill(0);
    const barItems = Array.from({ length: 4 }, () => []);
    items.forEach(item => {
      const d = getDateFn(item);
      if (d && d.getFullYear() === year && d.getMonth() === month) {
        const w = Math.min(3, Math.floor((d.getDate() - 1) / 7));
        values[w] = Math.round((values[w] + getValueFn(item)) * 10) / 10;
        barItems[w].push(item);
      }
    });
    return { labels: ['1–7', '8–14', '15–21', '22+'], values, barItems };
  }
  if (scale === 'week' && weekStart) {
    const values = Array(7).fill(0);
    const barItems = Array.from({ length: 7 }, () => []);
    const ws = new Date(weekStart); ws.setHours(0, 0, 0, 0);
    items.forEach(item => {
      const d = getDateFn(item);
      if (!d) return;
      const diff = Math.round((d - ws) / 86400000);
      if (diff >= 0 && diff < 7) {
        values[diff] = Math.round((values[diff] + getValueFn(item)) * 10) / 10;
        barItems[diff].push(item);
      }
    });
    return { labels: DAY_ABBR, values, barItems };
  }
  return { labels: [], values: [], barItems: [] };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyChart({ label }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>{label}</Text>
    </View>
  );
}

function ScaleSelector({ scale, onSelect, t }) {
  return (
    <View style={styles.scaleRow}>
      {[['year', t('analytics.scaleYear')], ['month', t('analytics.scaleMonth')], ['week', t('analytics.scaleWeek')]].map(([key, label]) => (
        <TouchableOpacity
          key={key}
          style={[styles.scaleBtn, scale === key && styles.scaleBtnActive]}
          onPress={() => onSelect(key)}
        >
          <Text style={[styles.scaleBtnText, scale === key && styles.scaleBtnTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NavRow({ label, onPrev, onNext }) {
  return (
    <View style={styles.navRow}>
      <TouchableOpacity style={styles.navBtn} onPress={onPrev}>
        <Text style={styles.navBtnText}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.navLabel}>{label}</Text>
      <TouchableOpacity style={styles.navBtn} onPress={onNext}>
        <Text style={styles.navBtnText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// Clickable period labels below the chart — tap to expand detail
function PeriodSelector({ labels, selected, onSelect, nonZero }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
      {labels.map((lbl, idx) => {
        const active = selected === idx;
        const hasData = nonZero[idx];
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.periodBtn, active && styles.periodBtnActive, !hasData && styles.periodBtnEmpty]}
            onPress={() => onSelect(active ? null : idx)}
          >
            <Text style={[styles.periodBtnText, active && styles.periodBtnTextActive, !hasData && styles.periodBtnTextEmpty]}>
              {lbl}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function PaginatedList({ items, page, setPage, renderItem, emptyText }) {
  if (!items.length) return <Text style={styles.detailEmpty}>{emptyText}</Text>;
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems  = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return (
    <View>
      {pageItems.map((item, i) => (
        <View key={item.id ?? `${page}-${i}`}>{renderItem(item)}</View>
      ))}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
            disabled={page === 0}
            onPress={() => setPage(p => p - 1)}
          >
            <Text style={styles.pageBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.pageText}>{page + 1}/{totalPages}</Text>
          <TouchableOpacity
            style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
            disabled={page >= totalPages - 1}
            onPress={() => setPage(p => p + 1)}
          >
            <Text style={styles.pageBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { t } = useTranslation();

  const [plots,        setPlots]        = useState([]);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [beds,         setBeds]         = useState([]);
  const [selectedBed,  setSelectedBed]  = useState(null);
  const [allCrops,     setAllCrops]     = useState([]);
  const [rawHarvests,  setRawHarvests]  = useState([]);
  const [loadingPlots, setLoadingPlots] = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);

  // Chart 2 – Planting calendar
  const [c2Scale,  setC2Scale]  = useState('year');
  const [c2Year,   setC2Year]   = useState(new Date().getFullYear());
  const [c2Month,  setC2Month]  = useState(new Date().getMonth());
  const [c2Week,   setC2Week]   = useState(() => getMonday(new Date()));
  const [c2Sel,    setC2Sel]    = useState(null); // selected bar index
  const [c2Page,   setC2Page]   = useState(0);

  // Chart 3 – Quality
  const [c3Quality, setC3Quality] = useState(null);
  const [c3Page,    setC3Page]    = useState(0);

  // Chart 4 – Harvest chronology
  const [c4Scale,  setC4Scale]  = useState('year');
  const [c4Year,   setC4Year]   = useState(new Date().getFullYear());
  const [c4Month,  setC4Month]  = useState(new Date().getMonth());
  const [c4Week,   setC4Week]   = useState(() => getMonday(new Date()));
  const [c4Sel,    setC4Sel]    = useState(null);
  const [c4Page,   setC4Page]   = useState(0);

  // Ref for stale-closure-free focus reload
  const plotRef = useRef(selectedPlot);
  useEffect(() => { plotRef.current = selectedPlot; }, [selectedPlot]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadPlotData = useCallback(async (plotId) => {
    setLoadingData(true);
    setC2Sel(null); setC4Sel(null); setC3Quality(null);
    const [bedsData, cropsData, harvestsData] = await Promise.all([
      getBeds(plotId),
      getAllCropsForPlot(plotId),
      getHarvestsForPlot(plotId),
    ]);
    setBeds(bedsData);
    setAllCrops(cropsData);
    setRawHarvests(harvestsData);
    setLoadingData(false);
  }, []);

  // Reload on every screen focus (fixes stale data after navigating away)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoadingPlots(true);
        const list = await getPlots();
        if (!active) return;
        setPlots(list);
        setLoadingPlots(false);
        const cur = plotRef.current;
        if (cur) await loadPlotData(cur.id);
        else if (list.length === 1) setSelectedPlot(list[0]);
      })();
      return () => { active = false; };
    }, [loadPlotData])
  );

  // Reload when a different plot chip is tapped
  useEffect(() => {
    if (!selectedPlot) {
      setBeds([]); setSelectedBed(null); setAllCrops([]); setRawHarvests([]);
      return;
    }
    loadPlotData(selectedPlot.id);
  }, [selectedPlot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-init nav years from actual data
  useEffect(() => {
    const years = [...new Set(
      rawHarvests.map(h => parseDate(h.harvestedAt)?.getFullYear()).filter(Boolean)
    )].sort();
    if (years.length) setC4Year(years[years.length - 1]);
  }, [rawHarvests]);

  useEffect(() => {
    const years = [...new Set(
      allCrops.map(c => parseDate(c.plantedAt)?.getFullYear()).filter(Boolean)
    )].sort();
    if (years.length) setC2Year(years[years.length - 1]);
  }, [allCrops]);

  // Reset selection when scale/nav changes
  useEffect(() => { setC2Sel(null); setC2Page(0); }, [c2Scale, c2Year, c2Month, c2Week]);
  useEffect(() => { setC4Sel(null); setC4Page(0); }, [c4Scale, c4Year, c4Month, c4Week]);
  useEffect(() => { setC3Page(0); }, [c3Quality]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const cropMap = {};
  allCrops.forEach(c => { cropMap[c.id] = c; });

  const allHarvests = rawHarvests.map(h => ({
    ...h,
    cropName: h.cropName || cropMap[h.cropId]?.name || '?',
  }));

  const filteredHarvests = selectedBed
    ? allHarvests.filter(h => h.bedId === selectedBed.id)
    : allHarvests;

  const filteredCrops = selectedBed
    ? allCrops.filter(c => c.bedId === selectedBed.id)
    : allCrops;

  // Chart 1 – yield by crop top-6
  const yieldMap = {};
  filteredHarvests.forEach(h => {
    if (!h.cropName || h.cropName === '?') return;
    yieldMap[h.cropName] = (yieldMap[h.cropName] || 0) + (h.yieldKg || 0);
  });
  const c1Entries = Object.entries(yieldMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const c1Labels  = c1Entries.map(([k]) => k.length > 5 ? k.slice(0, 4) + '…' : k);
  const c1Values  = c1Entries.map(([, v]) => Math.round(v * 10) / 10);

  // Chart 2 – plantings (uses allCrops.plantedAt, NOT harvests)
  const c2 = computeBars(
    filteredCrops,
    c => parseDate(c.plantedAt),
    () => 1,
    c2Scale, c2Year, c2Month, c2Week,
  );

  // Chart 3 – quality
  const qualityCount = { excellent: 0, good: 0, average: 0, poor: 0 };
  filteredHarvests.forEach(h => { if (h.quality && qualityCount[h.quality] !== undefined) qualityCount[h.quality]++; });
  const pieData = Object.entries(qualityCount)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: t(k), population: v, color: QUALITY_COLORS[k], legendFontColor: '#555', legendFontSize: 13, _key: k }));
  const c3FilteredHarvests = c3Quality ? filteredHarvests.filter(h => h.quality === c3Quality) : [];

  // Chart 4 – harvest chronology
  const c4 = computeBars(
    filteredHarvests,
    h => parseDate(h.harvestedAt),
    h => h.yieldKg || 0,
    c4Scale, c4Year, c4Month, c4Week,
  );

  const totalEntries = filteredHarvests.length;
  const totalKg      = filteredHarvests.reduce((s, h) => s + (h.yieldKg || 0), 0);
  const topCrop      = c1Entries[0]?.[0] ?? '—';

  // ── Scale navigation ──────────────────────────────────────────────────────
  function makeNav(scale, year, setYear, month, setMonth, week, setWeek) {
    const go = (dir) => {
      if (scale === 'year') { setYear(y => y + dir); return; }
      if (scale === 'month') {
        const nm = month + dir;
        if (nm < 0) { setMonth(11); setYear(y => y - 1); }
        else if (nm > 11) { setMonth(0); setYear(y => y + 1); }
        else setMonth(nm);
        return;
      }
      setWeek(d => { const nd = new Date(d); nd.setDate(nd.getDate() + dir * 7); return nd; });
    };
    return { prev: () => go(-1), next: () => go(1) };
  }

  const c2Nav = makeNav(c2Scale, c2Year, setC2Year, c2Month, setC2Month, c2Week, setC2Week);
  const c4Nav = makeNav(c4Scale, c4Year, setC4Year, c4Month, setC4Month, c4Week, setC4Week);

  // ── Row renderers ─────────────────────────────────────────────────────────
  const renderCropRow = (crop) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailIcon}>{crop.icon || '🌿'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailName} numberOfLines={1}>{crop.name}</Text>
        {!!crop.variety && <Text style={styles.detailSub} numberOfLines={1}>{crop.variety}</Text>}
      </View>
      <Text style={styles.detailDate}>
        {parseDate(crop.plantedAt)?.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) ?? ''}
      </Text>
    </View>
  );

  const renderHarvestRow = (h) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailIcon}>{cropMap[h.cropId]?.icon || '🌿'}</Text>
      <Text style={styles.detailName} numberOfLines={1}>{h.cropName}</Text>
      <Text style={styles.detailDate}>{h.yieldKg} {h.unit === 'L' ? t('unitLiters') : t('unitKg')}</Text>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Plot chips */}
      {loadingPlots ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color={GREEN} />
      ) : plots.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('analytics.noPlots')}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.filterLabel}>{t('analytics.plotLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {plots.map(p => {
              const active = selectedPlot?.id === p.id;
              return (
                <TouchableOpacity key={p.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setSelectedPlot(active ? null : p); if (active) setSelectedBed(null); }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>🌱 {p.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedPlot && beds.length > 0 && (
            <>
              <Text style={styles.filterLabel}>{t('analytics.bedLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {beds.map(b => {
                  const active = selectedBed?.id === b.id;
                  return (
                    <TouchableOpacity key={b.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedBed(active ? null : b)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>🟫 {b.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </>
      )}

      {!selectedPlot && !loadingPlots && plots.length > 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>☝️</Text>
          <Text style={styles.emptyStateText}>{t('analytics.selectPlot')}</Text>
        </View>
      )}

      {loadingData && <View style={styles.centered}><ActivityIndicator size="large" color={GREEN} /></View>}

      {selectedPlot && !loadingData && (
        <>
          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{totalEntries}</Text>
              <Text style={styles.summaryLabel}>{t('analytics.totalEntries')}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{totalKg % 1 === 0 ? totalKg : totalKg.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>{t('analytics.totalKg')} {t('unitKg')}</Text>
            </View>
            <View style={[styles.summaryCard, { flex: 1.5 }]}>
              <Text style={styles.summaryValue} numberOfLines={1}>{topCrop}</Text>
              <Text style={styles.summaryLabel}>{t('analytics.topCrop')}</Text>
            </View>
          </View>

          {/* ── Chart 1: Yield by crop ── */}
          <View style={styles.chartCard}>
            <View style={styles.chartTitleRow}>
              <Text style={styles.chartTitle}>📦 {t('yieldByCrop')}</Text>
              <View style={styles.unitBadge}><Text style={styles.unitText}>{t('unitKg')}</Text></View>
            </View>
            {c1Values.length > 0 && c1Values.some(v => v > 0) ? (
              <BarChart
                data={{ labels: c1Labels, datasets: [{ data: c1Values }] }}
                width={CHART_INNER} height={200} chartConfig={chartCfg}
                fromZero showValuesOnTopOfBars style={styles.chart}
              />
            ) : (
              <EmptyChart label={t('analytics.noData')} />
            )}
          </View>

          {/* ── Chart 2: Planting calendar ── */}
          <View style={styles.chartCard}>
            <View style={styles.chartTitleRow}>
              <Text style={styles.chartTitle}>🌱 {t('analytics.plantingsTitle')}</Text>
              <View style={styles.unitBadge}><Text style={styles.unitText}>{t('analytics.unitPcs')}</Text></View>
            </View>
            <ScaleSelector scale={c2Scale} onSelect={s => setC2Scale(s)} t={t} />
            <NavRow
              label={formatNavLabel(c2Scale, c2Year, c2Month, c2Week)}
              onPrev={c2Nav.prev}
              onNext={c2Nav.next}
            />
            {c2.values.some(v => v > 0) ? (
              <BarChart
                data={{ labels: c2.labels, datasets: [{ data: c2.values.map(v => v || 0.001) }] }}
                width={CHART_INNER} height={180} chartConfig={chartCfg}
                fromZero style={styles.chart}
              />
            ) : (
              <EmptyChart label={t('analytics.noData')} />
            )}
            <PeriodSelector
              labels={c2.labels}
              selected={c2Sel}
              onSelect={idx => { setC2Sel(idx); setC2Page(0); }}
              nonZero={c2.values.map(v => v > 0)}
            />
            {c2Sel !== null && c2Sel < c2.barItems.length && (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>
                  {c2.labels[c2Sel]}  {c2.barItems[c2Sel].length} {t('analytics.plantingsCount')}
                </Text>
                <PaginatedList
                  items={c2.barItems[c2Sel]}
                  page={c2Page}
                  setPage={setC2Page}
                  renderItem={renderCropRow}
                  emptyText={t('analytics.noData')}
                />
              </View>
            )}
          </View>

          {/* ── Chart 3: Quality distribution ── */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>🌟 {t('analytics.qualityTitle')}</Text>
            {pieData.length > 0 ? (
              <>
                <PieChart
                  data={pieData}
                  width={CHART_INNER} height={160} chartConfig={chartCfg}
                  accessor="population" backgroundColor="transparent"
                  paddingLeft="15" style={styles.chart} hasLegend={false}
                />
                <View style={styles.pieChipsRow}>
                  {pieData.map(item => (
                    <TouchableOpacity
                      key={item._key}
                      style={[styles.pieChip,
                        { backgroundColor: item.color + '22', borderColor: item.color },
                        c3Quality === item._key && styles.pieChipActive]}
                      onPress={() => { setC3Quality(q => q === item._key ? null : item._key); setC3Page(0); }}
                    >
                      <View style={[styles.pieDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.pieChipText, { color: item.color }]}>
                        {item.name}: {item.population}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {c3Quality && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailTitle}>{t(c3Quality)}: {c3FilteredHarvests.length}</Text>
                    <PaginatedList
                      items={c3FilteredHarvests}
                      page={c3Page}
                      setPage={setC3Page}
                      renderItem={renderHarvestRow}
                      emptyText={t('analytics.noData')}
                    />
                  </View>
                )}
              </>
            ) : (
              <EmptyChart label={t('analytics.noData')} />
            )}
          </View>

          {/* ── Chart 4: Harvest chronology ── */}
          <View style={styles.chartCard}>
            <View style={styles.chartTitleRow}>
              <Text style={styles.chartTitle}>🗓 {t('analytics.chronoTitle')}</Text>
              <View style={styles.unitBadge}><Text style={styles.unitText}>{t('unitKg')}</Text></View>
            </View>
            <ScaleSelector scale={c4Scale} onSelect={s => setC4Scale(s)} t={t} />
            <NavRow
              label={formatNavLabel(c4Scale, c4Year, c4Month, c4Week)}
              onPrev={c4Nav.prev}
              onNext={c4Nav.next}
            />
            {c4.values.some(v => v > 0) ? (
              <BarChart
                data={{ labels: c4.labels, datasets: [{ data: c4.values.map(v => v || 0.001) }] }}
                width={CHART_INNER} height={180} chartConfig={chartCfg}
                fromZero style={styles.chart}
              />
            ) : (
              <EmptyChart label={t('analytics.noData')} />
            )}
            <PeriodSelector
              labels={c4.labels}
              selected={c4Sel}
              onSelect={idx => { setC4Sel(idx); setC4Page(0); }}
              nonZero={c4.values.map(v => v > 0)}
            />
            {c4Sel !== null && c4Sel < c4.values.length && (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>
                  {c4.labels[c4Sel]}  {(c4.values[c4Sel] ?? 0).toFixed(1)} {t('unitKg')}
                </Text>
                <PaginatedList
                  items={c4.barItems[c4Sel]}
                  page={c4Page}
                  setPage={setC4Page}
                  renderItem={renderHarvestRow}
                  emptyText={t('analytics.noData')}
                />
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#f0f7f4' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },

  screenTitle: {
    fontSize: 22, fontWeight: '800', color: GREEN_DARK,
    marginHorizontal: 16, marginTop: 16, marginBottom: 10,
  },
  filterLabel: {
    fontSize: 12, fontWeight: '600', color: '#888',
    marginHorizontal: 16, marginTop: 10, marginBottom: 6, textTransform: 'uppercase',
  },
  chipsRow:       { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d0e8d8' },
  chipActive:     { backgroundColor: GREEN, borderColor: GREEN },
  chipText:       { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  emptyState:     { alignItems: 'center', paddingVertical: 48 },
  emptyStateIcon: { fontSize: 36, marginBottom: 12 },
  emptyStateText: { fontSize: 15, color: '#aaa', textAlign: 'center', paddingHorizontal: 24 },

  summaryRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  summaryCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  summaryValue: { fontSize: 20, fontWeight: '800', color: GREEN_DARK },
  summaryLabel: { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 14, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: GREEN_DARK },
  unitBadge:  { backgroundColor: GREEN_LIGHT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  unitText:   { fontSize: 11, fontWeight: '700', color: GREEN },
  chart:      { borderRadius: 10, marginTop: 8 },

  emptyChart:     { height: 110, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f9f9f9', borderRadius: 10, marginTop: 8 },
  emptyChartText: { fontSize: 13, color: '#ccc', fontStyle: 'italic' },

  // Scale selector
  scaleRow:          { flexDirection: 'row', gap: 6, marginBottom: 4 },
  scaleBtn:          { flex: 1, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f4f4f4',
    alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  scaleBtnActive:    { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  scaleBtnText:      { fontSize: 12, color: '#999', fontWeight: '600' },
  scaleBtnTextActive:{ color: GREEN },

  // Nav row
  navRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, marginVertical: 8 },
  navBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#a5d6a7' },
  navBtnText:{ fontSize: 20, color: GREEN, fontWeight: '700', lineHeight: 24 },
  navLabel:  { fontSize: 14, fontWeight: '700', color: GREEN_DARK,
    minWidth: 110, textAlign: 'center' },

  // Period selector
  periodRow:          { paddingVertical: 6, gap: 6, paddingHorizontal: 2 },
  periodBtn:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: '#f4f4f4', borderWidth: 1, borderColor: 'transparent' },
  periodBtnActive:    { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  periodBtnEmpty:     { opacity: 0.4 },
  periodBtnText:      { fontSize: 11, color: '#777', fontWeight: '600' },
  periodBtnTextActive:{ color: GREEN },
  periodBtnTextEmpty: { color: '#bbb' },

  // Detail card
  detailCard:  { marginTop: 8, backgroundColor: '#f6faf7', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#c8e6c9' },
  detailTitle: { fontSize: 13, fontWeight: '700', color: GREEN_DARK, marginBottom: 8 },
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e8f5e9' },
  detailIcon:  { fontSize: 20 },
  detailName:  { fontSize: 13, color: '#333', flex: 1 },
  detailSub:   { fontSize: 11, color: '#999' },
  detailDate:  { fontSize: 12, fontWeight: '700', color: GREEN },
  detailEmpty: { fontSize: 13, color: '#aaa', fontStyle: 'italic',
    textAlign: 'center', padding: 8 },

  // Pie
  pieChipsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pieChip:      { flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  pieChipActive:{ borderWidth: 2.5 },
  pieDot:       { width: 10, height: 10, borderRadius: 5 },
  pieChipText:  { fontSize: 13, fontWeight: '600' },

  // Pagination
  pagination:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e8f5e9' },
  pageBtn:         { width: 28, height: 28, borderRadius: 14, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { backgroundColor: '#f4f4f4' },
  pageBtnText:     { fontSize: 16, color: GREEN, fontWeight: '700', lineHeight: 20 },
  pageText:        { fontSize: 12, color: '#888', fontWeight: '600' },
});
