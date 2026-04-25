import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, Alert,
  StyleSheet, Dimensions, PanResponder, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlantIcon from './PlantIcon';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD    = 12;
const GAP      = 4;
const CELL_PX_BASE = 44; // base cell size in pixels
const ZOOM_MIN     = 0.5;
const ZOOM_MAX     = 2.0;
const ZOOM_STEP    = 0.25;

// ── Utility functions ──────────────────────────────────────────────────────────

export function getPlotGridInfo(polygon, cellSize) {
  const lats = polygon.map(p => p.latitude ?? p.lat ?? 0);
  const lngs = polygon.map(p => p.longitude ?? p.lng ?? 0);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const avgLat = (minLat + maxLat) / 2;
  const avgLng = (minLng + maxLng) / 2;

  // Convert GPS coords to local Cartesian metres (centroid = origin)
  const meterCoords = polygon.map(p => gpsToMeters(
    p.latitude ?? p.lat ?? 0, p.longitude ?? p.lng ?? 0, avgLat, avgLng,
  ));

  // Rotate to align grid with the polygon's dominant edge direction (OBB)
  const angle   = findPrincipalAngle(meterCoords);
  const rotated = meterCoords.map(p => rotatePoint(p.x, p.y, angle));

  const obbMinX = Math.min(...rotated.map(p => p.x));
  const obbMaxX = Math.max(...rotated.map(p => p.x));
  const obbMinY = Math.min(...rotated.map(p => p.y));
  const obbMaxY = Math.max(...rotated.map(p => p.y));

  const widthM  = obbMaxX - obbMinX;
  const heightM = obbMaxY - obbMinY;
  const cols    = Math.max(1, Math.ceil(widthM  / cellSize));
  const rows    = Math.max(1, Math.ceil(heightM / cellSize));

  return {
    rows, cols, heightM, widthM,
    minLat, maxLat, minLng, maxLng, avgLat,   // kept for backward compat
    angle, obbMinX, obbMinY, rotatedPoly: rotated,
  };
}

export function suggestCellSize(widthM, heightM) {
  const maxDim = Math.max(widthM, heightM);
  if (maxDim <= 8)  return 0.5;
  if (maxDim <= 20) return 1;
  if (maxDim <= 50) return 2;
  return 5;
}

// ── Geo helpers — OBB (Oriented Bounding Box) ─────────────────────────────────

function gpsToMeters(lat, lng, originLat, originLng) {
  return {
    x: (lng - originLng) * 111320 * Math.cos(originLat * Math.PI / 180),
    y: (lat - originLat) * 111320,
  };
}

function findPrincipalAngle(meterCoords) {
  let maxLen = 0, angle = 0;
  for (let i = 0, j = meterCoords.length - 1; i < meterCoords.length; j = i++) {
    const dx = meterCoords[i].x - meterCoords[j].x;
    const dy = meterCoords[i].y - meterCoords[j].y;
    const len = Math.hypot(dx, dy);
    if (len > maxLen) { maxLen = len; angle = Math.atan2(dy, dx); }
  }
  return angle;
}

function rotatePoint(x, y, angle) {
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function isInsidePolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function isInsideWithBuffer(px, py, poly, buffer) {
  if (isInsidePolygon(px, py, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if (distToSegment(px, py, poly[j].x, poly[j].y, poly[i].x, poly[i].y) <= buffer)
      return true;
  return false;
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

// Returns the original grid (r, c) for a visual cell (vr, vc) given the display rotation.
// Rotations are CW: 0=none, 1=90°, 2=180°, 3=270°.
function visualToOriginal(vr, vc, rows, cols, rot) {
  switch (rot) {
    case 1: return { r: rows - 1 - vc, c: vr };
    case 2: return { r: rows - 1 - vr, c: cols - 1 - vc };
    case 3: return { r: vc,            c: cols - 1 - vr };
    default: return { r: vr, c: vc };
  }
}

// Returns the visual grid dimensions after rotation (90°/270° swap rows↔cols).
function getVisualDims(rows, cols, rot) {
  return rot % 2 === 0 ? { vRows: rows, vCols: cols } : { vRows: cols, vCols: rows };
}

// Inverse of visualToOriginal: original (r,c) → visual (vr,vc).
function originalToVisual(r, c, rows, cols, rot) {
  switch (rot) {
    case 1: return { vr: c,            vc: rows - 1 - r };
    case 2: return { vr: rows - 1 - r, vc: cols - 1 - c };
    case 3: return { vr: cols - 1 - c, vc: r            };
    default: return { vr: r, vc: c };
  }
}

// Returns the visual bounding box (in cell indices) of a bed after rotation.
function getBedVisualBounds(bed, rows, cols, rot) {
  const sr = bed.spanRows ?? 1, sc = bed.spanCols ?? 1;
  let minVr = Infinity, maxVr = -Infinity, minVc = Infinity, maxVc = -Infinity;
  for (let r = bed.row; r < bed.row + sr; r++)
    for (let c = bed.col; c < bed.col + sc; c++) {
      const { vr, vc } = originalToVisual(r, c, rows, cols, rot);
      if (vr < minVr) minVr = vr; if (vr > maxVr) maxVr = vr;
      if (vc < minVc) minVc = vc; if (vc > maxVc) maxVc = vc;
    }
  return { minVr, maxVr, minVc, maxVc };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartBedGrid({ beds, cropsByBed, plot, cellSize, editMode, onBedCreated, onPressBed, onDeleteBed }) {
  const { t } = useTranslation();
  const [selectionRect, setSelectionRect] = useState(null);
  const [showModal, setShowModal]         = useState(false);
  const [bedLabelInput, setBedLabelInput] = useState('');
  const [saving, setSaving]               = useState(false);
  const [showBedInfo, setShowBedInfo]     = useState(false);
  const [extraRotation, setExtraRotation] = useState(0);   // 0–3 × 90°
  const [zoomScale, setZoomScale]         = useState(1.0); // 0.5–2.0

  // Load persisted rotation for this plot on mount
  useEffect(() => {
    if (!plot?.id) return;
    AsyncStorage.getItem(`gardenmap_grid_rotation_${plot.id}`)
      .then(val => { if (val !== null) setExtraRotation(parseInt(val, 10)); })
      .catch(() => {});
  }, [plot?.id]);

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

  const rows   = gridInfo?.rows ?? 0;
  const cols   = gridInfo?.cols ?? 0;
  const { vRows, vCols } = getVisualDims(rows, cols, extraRotation);
  const cellPx = Math.round(CELL_PX_BASE * zoomScale);
  const step   = cellPx + GAP;

  // ── Inactive cells — OBB-aligned grid + edge buffer ──────────────────────────
  const inactiveCells = useMemo(() => {
    if (!plot?.polygon?.length || plot.polygon.length < 3 || !cellSize || !rows || !cols) {
      return new Set();
    }
    const { obbMinX, obbMinY, heightM, rotatedPoly } = gridInfo;
    if (!rotatedPoly) return new Set(); // manual (rectangular) plot — all cells active

    // 30% of cell size: cells that just clip the polygon edge stay active
    const BUFFER = cellSize * 0.3;
    const inactive = new Set();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Cell centre in OBB-rotated metre space; r=0 is the northernmost row
        const cx = obbMinX + (c + 0.5) * cellSize;
        const cy = obbMinY + heightM - (r + 0.5) * cellSize;
        if (!isInsideWithBuffer(cx, cy, rotatedPoly, BUFFER)) inactive.add(`${r},${c}`);
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
  sr.current.cols     = vCols;
  sr.current.rows     = vRows;
  sr.current.step     = step;

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
      const { gridOrigin, hScrollOffset, cols: C, rows: R, step: S } = sr.current;
      // localX: position within the cell grid (accounts for horizontal scroll)
      const localX = pageX - gridOrigin.x + hScrollOffset;
      const localY = pageY - gridOrigin.y;
      const col = Math.max(0, Math.min(C - 1, Math.floor(localX / S)));
      const row = Math.max(0, Math.min(R - 1, Math.floor(localY / S)));
      sr.current.selectionActive = true;
      setSelectionRect({ startRow: row, startCol: col, endRow: row, endCol: col });
    },

    onPanResponderMove: (evt) => {
      if (!sr.current.selectionActive) return;
      const { pageX, pageY } = evt.nativeEvent;
      const { gridOrigin, hScrollOffset, cols: C, rows: R, step: S } = sr.current;
      const localX = pageX - gridOrigin.x + hScrollOffset;
      const localY = pageY - gridOrigin.y;
      const col = Math.max(0, Math.min(C - 1, Math.floor(localX / S)));
      const row = Math.max(0, Math.min(R - 1, Math.floor(localY / S)));
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
  const selDims = normSel ? (() => {
    // Transform the four corners of the visual selection into original space,
    // then take the bounding box to get the physical size of the selection.
    const pts = [
      visualToOriginal(normSel.minR, normSel.minC, rows, cols, extraRotation),
      visualToOriginal(normSel.minR, normSel.maxC, rows, cols, extraRotation),
      visualToOriginal(normSel.maxR, normSel.minC, rows, cols, extraRotation),
      visualToOriginal(normSel.maxR, normSel.maxC, rows, cols, extraRotation),
    ];
    const spanR = Math.max(...pts.map(p => p.r)) - Math.min(...pts.map(p => p.r)) + 1;
    const spanC = Math.max(...pts.map(p => p.c)) - Math.min(...pts.map(p => p.c)) + 1;
    return { w: (spanC * cellSize).toFixed(1), h: (spanR * cellSize).toFixed(1) };
  })() : null;

  // ── Bed creation ─────────────────────────────────────────────────────────────
  async function handleConfirmBed() {
    if (!bedLabelInput.trim() || !normSel) return;

    // Map each visual cell in the selection to its original (r, c)
    const origCells = [];
    for (let vr = normSel.minR; vr <= normSel.maxR; vr++)
      for (let vc = normSel.minC; vc <= normSel.maxC; vc++)
        origCells.push(visualToOriginal(vr, vc, rows, cols, extraRotation));

    for (const { r, c } of origCells) {
      if (cellBedMap[`${r},${c}`]) {
        Alert.alert(t('bedOverlap'), t('bedOverlapMsg'));
        return;
      }
      if (inactiveCells.has(`${r},${c}`)) {
        Alert.alert(t('inactiveZone'), t('selectionHasInactive'));
        return;
      }
    }

    // Bounding box of the original cells — this is what we store in Firestore
    const origRs   = origCells.map(p => p.r);
    const origCs   = origCells.map(p => p.c);
    const minR     = Math.min(...origRs), maxR = Math.max(...origRs);
    const minC     = Math.min(...origCs), maxC = Math.max(...origCs);
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

      {/* Grid controls: rotate + zoom */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            const next = (extraRotation + 1) % 4;
            setExtraRotation(next);
            if (plot?.id)
              AsyncStorage.setItem(`gardenmap_grid_rotation_${plot.id}`, String(next)).catch(() => {});
          }}
        >
          <Text style={styles.controlBtnText}>↻ 90°</Text>
        </TouchableOpacity>

        <View style={styles.zoomGroup}>
          <TouchableOpacity
            style={[styles.controlBtn, zoomScale <= ZOOM_MIN && styles.controlBtnDisabled]}
            onPress={() => setZoomScale(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
            disabled={zoomScale <= ZOOM_MIN}
          >
            <Text style={styles.controlBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLabel}>{Math.round(zoomScale * 100)}%</Text>
          <TouchableOpacity
            style={[styles.controlBtn, zoomScale >= ZOOM_MAX && styles.controlBtnDisabled]}
            onPress={() => setZoomScale(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
            disabled={zoomScale >= ZOOM_MAX}
          >
            <Text style={styles.controlBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          {Array.from({ length: vRows }, (_, vr) => (
            <View key={vr} style={[styles.row, { marginBottom: GAP }]}>
              {Array.from({ length: vCols }, (_, vc) => {
                const { r, c }   = visualToOriginal(vr, vc, rows, cols, extraRotation);
                const key        = `${r},${c}`;
                const isInactive = inactiveCells.has(key);
                const bed        = cellBedMap[key];
                const crop       = bed ? (cropsByBed?.[bed.id] ?? null) : null;
                const isSelected = editMode && !!normSel &&
                  vr >= normSel.minR && vr <= normSel.maxR &&
                  vc >= normSel.minC && vc <= normSel.maxC;
                const { bg, border, text } = cellColor(crop, isInactive, isSelected, !!bed);
                const isTopLeft  = bed && bed.row === r && bed.col === c;
                const isCheckerCell = bed
                  ? ((r - bed.row) + (c - bed.col)) % 2 === 0
                  : false;
                const cellStyle = [
                  styles.cell,
                  {
                    width:           cellPx,
                    height:          cellPx,
                    backgroundColor: bg,
                    borderColor:     border,
                    marginRight:     vc < vCols - 1 ? GAP : 0,
                    borderWidth:     isSelected ? 2.5 : 1.5,
                  },
                ];

                // icon mode: checkerboard of crop icons; info mode: cells stay empty — overlay draws the text
                const content = isInactive ? (
                  <Text style={[styles.inactiveIcon, { color: text }]}>⊘</Text>
                ) : !bed ? (
                  <Text style={[styles.emptyHint, { color: border }]}>
                    {editMode ? '+' : '🌱'}
                  </Text>
                ) : editMode || showBedInfo ? null
                  : crop && isCheckerCell ? (
                  <PlantIcon
                    plantId={crop.plantId}
                    id={crop.id}
                    itemId={crop.itemId}
                    name={crop.name}
                    icon={crop.icon}
                    size={Math.round(cellPx * 0.48)}
                    fallback="🌱"
                    textStyle={[styles.cropIconFallback, { color: text }]}
                  />
                ) : !crop && isTopLeft ? (
                  <Text style={[styles.bedLabelTxt, { color: text, fontSize: Math.max(8, Math.min(11, cellPx * 0.22)) }]} numberOfLines={2}>
                    {bed.label}
                  </Text>
                ) : null;

                if (isInactive || editMode) {
                  return <View key={vc} style={cellStyle}>{content}</View>;
                }
                return (
                  <TouchableOpacity
                    key={vc}
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

          {/* ── Info-mode overlays: rendered last so they appear on top ── */}
          {showBedInfo && !editMode && beds.map(bed => {
            const crop = cropsByBed?.[bed.id] ?? null;
            const { minVr, maxVr, minVc, maxVc } = getBedVisualBounds(bed, rows, cols, extraRotation);
            const overlayLeft = H_PAD + minVc * (cellPx + GAP);
            const overlayTop  = 4    + minVr * (cellPx + GAP); // 4 = styles.grid.paddingTop
            const ow = (maxVc - minVc + 1) * cellPx + (maxVc - minVc) * GAP;
            const oh = (maxVr - minVr + 1) * cellPx + (maxVr - minVr) * GAP;
            const days = crop ? daysRem(crop) : null;
            const infoText = days == null ? '—'
              : days <= 0 ? t('harvestTime')
              : `${days} ${t('days')}`;
            const infoColor = days != null && days <= 0 ? '#b71c1c'
              : days != null && days <= 7 ? '#e65100' : '#2d6a4f';
            const borderCol = crop
              ? (days != null && days <= 0 ? '#ef9a9a' : days != null && days <= 7 ? '#f9a825' : '#66bb6a')
              : '#c9a97a';
            const minDim  = Math.min(ow, oh);
            const labelSz = Math.max(10, Math.min(18, minDim * 0.26));
            const daysSz  = Math.max(9,  Math.min(15, minDim * 0.21));
            return (
              <View key={`ov-${bed.id}`} pointerEvents="none" style={{
                position: 'absolute', left: overlayLeft, top: overlayTop,
                width: ow, height: oh,
                backgroundColor: 'rgba(255,255,255,0.93)',
                borderRadius: 8, borderWidth: 2, borderColor: borderCol,
                justifyContent: 'center', alignItems: 'center', padding: 4,
              }}>
                <Text style={{ fontWeight: '800', fontSize: labelSz, color: '#1a3c2d', textAlign: 'center' }} numberOfLines={2}>
                  {bed.label}
                </Text>
                {crop && (
                  <Text style={{ fontSize: daysSz, fontWeight: '700', color: infoColor, marginTop: 3, textAlign: 'center' }} numberOfLines={1}>
                    {infoText}
                  </Text>
                )}
              </View>
            );
          })}
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

  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    marginBottom: 8,
  },
  controlBtn: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  controlBtnDisabled: {
    opacity: 0.35,
  },
  controlBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d6a4f',
  },
  zoomGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    minWidth: 42,
    textAlign: 'center',
  },

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
