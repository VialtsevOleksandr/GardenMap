import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, Alert,
  StyleSheet, Dimensions, PanResponder, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import PlantIcon from './PlantIcon';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD    = 12;
const GAP      = 4;
const CELL_PX  = 44; // fixed comfortable touch size; grid scrolls horizontally if wider than screen

// ── Utility functions ──────────────────────────────────────────────────────────

export function getPlotGridInfo(polygon, cellSize) {
  // Handles both { latitude, longitude } and { lat, lng } formats
  const lats = polygon.map(p => p.latitude ?? p.lat ?? 0);
  const lngs = polygon.map(p => p.longitude ?? p.lng ?? 0);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const avgLat = (minLat + maxLat) / 2;
  const heightM = (maxLat - minLat) * 111320;
  const widthM  = (maxLng - minLng) * 111320 * Math.cos(avgLat * Math.PI / 180);
  const rows    = Math.max(1, Math.ceil(heightM / cellSize));
  const cols    = Math.max(1, Math.ceil(widthM  / cellSize));
  return { rows, cols, heightM, widthM, minLat, maxLat, minLng, maxLng, avgLat };
}

export function suggestCellSize(widthM, heightM) {
  const maxDim = Math.max(widthM, heightM);
  if (maxDim <= 8)  return 0.5;
  if (maxDim <= 20) return 1;
  if (maxDim <= 50) return 2;
  return 5;
}

// Ray-casting in normalized [0,1] coords — avoids floating-point issues
// with tiny GPS deltas. All points mapped to [0,1]×[0,1] bounding-box space.
function isInNormPolygon(nx, ny, normPoly) {
  let inside = false;
  for (let i = 0, j = normPoly.length - 1; i < normPoly.length; j = i++) {
    const xi = normPoly[i].x, yi = normPoly[i].y;
    const xj = normPoly[j].x, yj = normPoly[j].y;
    if (((yi > ny) !== (yj > ny)) &&
        (nx < (xj - xi) * (ny - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function daysRem(crop) {
  if (!crop?.plantedAt) return null;
  const planted = crop.plantedAt.toDate ? crop.plantedAt.toDate() : new Date(crop.plantedAt);
  return Math.ceil((planted.getTime() + crop.harvestDays * 86400000 - Date.now()) / 86400000);
}

function cellColor(crop, isInactive, isSelected, hasBed) {
  if (isSelected) return { bg: '#bbdefb', border: '#42a5f5', text: '#0d47a1' };
  if (isInactive) return { bg: '#eeeeee', border: '#bdbdbd', text: '#aaa' };
  if (!crop && hasBed) return { bg: '#f5ede0', border: '#c9a97a', text: '#8b6340' };
  if (!crop)      return { bg: '#e8f5e9', border: '#a5d6a7', text: '#388e3c' };
  const d = daysRem(crop);
  if (d == null) return { bg: '#c8e6c9', border: '#66bb6a', text: '#2e7d32' };
  if (d <= 0)    return { bg: '#ffcdd2', border: '#ef9a9a', text: '#b71c1c' };
  if (d <= 7)    return { bg: '#fff9c4', border: '#f9a825', text: '#e65100' };
  return          { bg: '#c8e6c9', border: '#66bb6a', text: '#2e7d32' };
}

function normalizeRect(rect) {
  return {
    minR: Math.min(rect.startRow, rect.endRow),
    maxR: Math.max(rect.startRow, rect.endRow),
    minC: Math.min(rect.startCol, rect.endCol),
    maxC: Math.max(rect.startCol, rect.endCol),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartBedGrid({ beds, cropsByBed, plot, cellSize, editMode, onBedCreated, onPressBed, onDeleteBed }) {
  const { t } = useTranslation();
  const [selectionRect, setSelectionRect] = useState(null);
  const [showModal, setShowModal]         = useState(false);
  const [bedLabelInput, setBedLabelInput] = useState('');
  const [saving, setSaving]               = useState(false);
  const [showBedInfo, setShowBedInfo]     = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => {
      setShowBedInfo(prev => !prev);
    }, 5000);
    return () => clearInterval(timerId);
  }, []);

  // ── Grid dimensions ──────────────────────────────────────────────────────────
  const gridInfo = useMemo(() => {
    if (!cellSize) return null;
    if (plot?.polygon?.length >= 3) {
      return getPlotGridInfo(plot.polygon, cellSize);
    }
    // Rectangular fallback for manually created plots
    const w = plot?.widthM  ?? Math.sqrt(Math.max(1, plot?.area ?? 25));
    const h = plot?.lengthM ?? Math.sqrt(Math.max(1, plot?.area ?? 25));
    return {
      rows: Math.max(1, Math.ceil(h / cellSize)),
      cols: Math.max(1, Math.ceil(w / cellSize)),
      heightM: h, widthM: w,
      minLat: 0, maxLat: 1, minLng: 0, maxLng: 1, avgLat: 0,
    };
  }, [plot, cellSize]);

  const rows = gridInfo?.rows ?? 0;
  const cols = gridInfo?.cols ?? 0;
  const STEP = CELL_PX + GAP;

  // ── Inactive cells (polygon masking, normalized coords) ───────────────────────
  const inactiveCells = useMemo(() => {
    if (!plot?.polygon?.length || plot.polygon.length < 3 || !cellSize || !rows || !cols) {
      return new Set();
    }
    const { minLat, maxLat, minLng, maxLng } = gridInfo;
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    if (!latRange || !lngRange) return new Set();

    // Normalize polygon to [0,1]×[0,1] bounding-box space
    const normPoly = plot.polygon.map(p => ({
      x: ((p.longitude ?? p.lng ?? 0) - minLng) / lngRange,
      y: ((p.latitude  ?? p.lat ?? 0) - minLat) / latRange,
    }));

    const inactive = new Set();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = (c + 0.5) / cols;         // 0=west  → 1=east
        const ny = 1 - (r + 0.5) / rows;    // 1=north → 0=south (rows grow south)
        if (!isInNormPolygon(nx, ny, normPoly)) inactive.add(`${r},${c}`);
      }
    }
    return inactive;
  }, [plot?.polygon, cellSize, rows, cols, gridInfo]);

  // ── Cell → bed mapping (multi-cell) ─────────────────────────────────────────
  const cellBedMap = useMemo(() => {
    const map = {};
    beds.forEach(bed => {
      const sr = bed.spanRows ?? 1;
      const sc = bed.spanCols ?? 1;
      for (let r = bed.row; r < bed.row + sr; r++)
        for (let c = bed.col; c < bed.col + sc; c++)
          map[`${r},${c}`] = bed;
    });
    return map;
  }, [beds]);

  // ── PanResponder (drag-to-select) ─────────────────────────────────────────────
  const gridRef = useRef(null);
  // All mutable values the PanResponder needs — safe to mutate refs during render
  const sr = useRef({
    editMode: false, selectionActive: false,
    gridOrigin: { x: 0, y: 0 },
    hScrollOffset: 0,
    cols: 0, rows: 0,
  });
  sr.current.editMode = editMode;
  sr.current.cols     = cols;
  sr.current.rows     = rows;

  const onGridLayout = useCallback(() => {
    // pageX is the left edge of the grid View (before H_PAD).
    // Cells start at pageX + H_PAD, so store that offset as gridOrigin.x.
    gridRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      sr.current.gridOrigin = { x: pageX + H_PAD, y: pageY };
    });
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:        () => sr.current.editMode,
    onStartShouldSetPanResponderCapture: () => sr.current.editMode,
    onMoveShouldSetPanResponder:         () => sr.current.editMode,

    onPanResponderGrant: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const { gridOrigin, hScrollOffset, cols: C, rows: R } = sr.current;
      // localX: position within the cell grid (accounts for horizontal scroll)
      const localX = pageX - gridOrigin.x + hScrollOffset;
      const localY = pageY - gridOrigin.y;
      const col = Math.max(0, Math.min(C - 1, Math.floor(localX / STEP)));
      const row = Math.max(0, Math.min(R - 1, Math.floor(localY / STEP)));
      sr.current.selectionActive = true;
      setSelectionRect({ startRow: row, startCol: col, endRow: row, endCol: col });
    },

    onPanResponderMove: (evt) => {
      if (!sr.current.selectionActive) return;
      const { pageX, pageY } = evt.nativeEvent;
      const { gridOrigin, hScrollOffset, cols: C, rows: R } = sr.current;
      const localX = pageX - gridOrigin.x + hScrollOffset;
      const localY = pageY - gridOrigin.y;
      const col = Math.max(0, Math.min(C - 1, Math.floor(localX / STEP)));
      const row = Math.max(0, Math.min(R - 1, Math.floor(localY / STEP)));
      setSelectionRect(prev => prev ? { ...prev, endRow: row, endCol: col } : null);
    },

    onPanResponderRelease: () => {
      if (sr.current.selectionActive) {
        sr.current.selectionActive = false;
        setShowModal(true);
      }
    },

    onPanResponderTerminate: () => {
      sr.current.selectionActive = false;
      setSelectionRect(null);
    },
  }), []); // created once; all dynamic values come from sr.current

  // ── Selection helpers ────────────────────────────────────────────────────────
  const normSel = selectionRect ? normalizeRect(selectionRect) : null;
  const selDims = normSel ? {
    w: ((normSel.maxC - normSel.minC + 1) * cellSize).toFixed(1),
    h: ((normSel.maxR - normSel.minR + 1) * cellSize).toFixed(1),
  } : null;

  // ── Bed creation ─────────────────────────────────────────────────────────────
  async function handleConfirmBed() {
    if (!bedLabelInput.trim() || !normSel) return;
    const { minR, maxR, minC, maxC } = normSel;

    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++) {
        if (cellBedMap[`${r},${c}`]) {
          Alert.alert(t('bedOverlap'), t('bedOverlapMsg'));
          return;
        }
        if (inactiveCells.has(`${r},${c}`)) {
          Alert.alert(t('inactiveZone'), t('selectionHasInactive'));
          return;
        }
      }

    const spanRows = maxR - minR + 1;
    const spanCols = maxC - minC + 1;
    setSaving(true);
    try {
      await onBedCreated({
        label:   bedLabelInput.trim(),
        row:     minR,
        col:     minC,
        spanRows,
        spanCols,
        widthM:  parseFloat((spanCols * cellSize).toFixed(2)),
        heightM: parseFloat((spanRows * cellSize).toFixed(2)),
      });
      setShowModal(false);
      setSelectionRect(null);
      setBedLabelInput('');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  function cancelModal() {
    setShowModal(false);
    setSelectionRect(null);
    setBedLabelInput('');
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!gridInfo || !rows || !cols) return null;

  return (
    <View style={styles.wrapper}>
      {/* Dimension badge while dragging */}
      {editMode && selDims && (
        <View style={styles.dimBadge}>
          <Text style={styles.dimBadgeText}>{selDims.w}м × {selDims.h}м</Text>
        </View>
      )}

      {/* Horizontal scroll — disabled in edit mode so PanResponder can work */}
      <ScrollView
        horizontal
        scrollEnabled={!editMode}
        showsHorizontalScrollIndicator={true}
        bounces={false}
        onScroll={e => { sr.current.hScrollOffset = e.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
      >
        <View
          ref={gridRef}
          onLayout={onGridLayout}
          style={styles.grid}
          {...panResponder.panHandlers}
        >
          {Array.from({ length: rows }, (_, r) => (
            <View key={r} style={[styles.row, { marginBottom: GAP }]}>
              {Array.from({ length: cols }, (_, c) => {
                const key        = `${r},${c}`;
                const isInactive = inactiveCells.has(key);
                const bed        = cellBedMap[key];
                const crop       = bed ? (cropsByBed?.[bed.id] ?? null) : null;
                const isSelected = editMode && !!normSel &&
                  r >= normSel.minR && r <= normSel.maxR &&
                  c >= normSel.minC && c <= normSel.maxC;
                const { bg, border, text } = cellColor(crop, isInactive, isSelected, !!bed);
                const isTopLeft  = bed && bed.row === r && bed.col === c;
                const isCheckerCell = bed
                  ? ((r - bed.row) + (c - bed.col)) % 2 === 0
                  : false;
                const days       = crop ? daysRem(crop) : null;
                const daysLabel  = !crop ? null :
                  days == null ? null :
                  days <= 0 ? '🍅' :
                  days <= 7 ? `${days}д!` : `${days}д`;
                const infoModeText = days == null
                  ? '—'
                  : days <= 0
                    ? t('harvestTime')
                    : `${days}${t('days')}`;

                const cellStyle = [
                  styles.cell,
                  {
                    width:           CELL_PX,
                    height:          CELL_PX,
                    backgroundColor: bg,
                    borderColor:     border,
                    marginRight:     c < cols - 1 ? GAP : 0,
                    borderWidth:     isSelected ? 2.5 : 1.5,
                  },
                ];

                const content = isInactive ? (
                  <Text style={[styles.inactiveIcon, { color: text }]}>⊘</Text>
                ) : bed && crop && !editMode && !showBedInfo && isCheckerCell ? (
                  <PlantIcon
                    plantId={crop.plantId}
                    id={crop.id}
                    itemId={crop.itemId}
                    name={crop.name}
                    icon={crop.icon}
                    size={20}
                    fallback="🌱"
                    textStyle={[styles.cropIconFallback, { color: text }]}
                  />
                ) : bed && crop && !editMode && showBedInfo && isTopLeft ? (
                  <>
                    <Text style={[styles.bedLabelTxt, styles.bedInfoLabel, { color: text }]} numberOfLines={1}>
                      {bed.label}
                    </Text>
                    <Text style={[styles.daysTxt, styles.bedInfoDays, { color: text }]} numberOfLines={1}>
                      {infoModeText}
                    </Text>
                  </>
                ) : isTopLeft ? (
                  <>
                    <Text style={[styles.bedLabelTxt, { color: text }]} numberOfLines={1}>
                      {bed.label}
                    </Text>
                    {crop && (
                      <Text style={[styles.cropTxt, { color: text }]} numberOfLines={1}>
                        {crop.name}
                      </Text>
                    )}
                    {daysLabel && (
                      <Text style={[styles.daysTxt, { color: text }]}>{daysLabel}</Text>
                    )}
                  </>
                ) : !bed ? (
                  <Text style={[styles.emptyHint, { color: border }]}>
                    {editMode ? '+' : '🌱'}
                  </Text>
                ) : null;

                if (isInactive || editMode) {
                  return <View key={c} style={cellStyle}>{content}</View>;
                }
                return (
                  <TouchableOpacity
                    key={c}
                    style={cellStyle}
                    onPress={() => bed && onPressBed(bed)}
                    onLongPress={() => bed && onDeleteBed && onDeleteBed(bed)}
                    activeOpacity={bed ? 0.75 : 1}
                  >
                    {content}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Create Bed Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={cancelModal}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('nameBed')}</Text>
            {selDims && (
              <Text style={styles.sheetDims}>
                {t('bedDimensions', { w: selDims.w, h: selDims.h })}
              </Text>
            )}
            <TextInput
              style={styles.labelInput}
              value={bedLabelInput}
              onChangeText={setBedLabelInput}
              placeholder={t('bedLabel')}
              placeholderTextColor="#bbb"
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.confirmBtn, (!bedLabelInput.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleConfirmBed}
              disabled={saving || !bedLabelInput.trim()}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>{t('confirmBed')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelSheetBtn} onPress={cancelModal}>
              <Text style={styles.cancelSheetText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingBottom: 8 },

  dimBadge: {
    alignSelf: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  dimBadgeText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  grid: {
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
    paddingTop: 4,
  },
  row: { flexDirection: 'row' },
  cell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },

  bedLabelTxt: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  cropTxt:     { fontSize: 9,  fontWeight: '600', textAlign: 'center', marginTop: 1 },
  daysTxt:     { fontSize: 9,  fontWeight: '700', marginTop: 1 },
  cropIconFallback: { fontSize: 20 },
  bedInfoLabel: { fontSize: 11, fontWeight: '800' },
  bedInfoDays: { fontSize: 9, fontWeight: '700' },
  inactiveIcon:{ fontSize: 14 },
  emptyHint:   { fontSize: 16, opacity: 0.3 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
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
    textAlign: 'center', marginBottom: 6,
  },
  sheetDims: {
    fontSize: 15, color: '#52b788', textAlign: 'center',
    marginBottom: 18, fontWeight: '700',
  },
  labelInput: {
    backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#dde8e2',
    marginBottom: 16, color: '#1a1a1a',
  },
  confirmBtn: {
    backgroundColor: '#2d6a4f', borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', marginBottom: 10, elevation: 2,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelSheetBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelSheetText: { color: '#999', fontSize: 15 },
});
