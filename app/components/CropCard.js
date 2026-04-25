import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import PlantIcon from './PlantIcon';
import { resolveName, resolveVariety } from '../services/varietiesCatalog';

export function daysRemaining(crop) {
  if (!crop?.plantedAt) return null;
  const planted = crop.plantedAt.toDate ? crop.plantedAt.toDate() : new Date(crop.plantedAt);
  return Math.ceil((planted.getTime() + crop.harvestDays * 86400000 - Date.now()) / 86400000);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString();
}

function timerStyle(days) {
  if (days == null) return {};
  if (days <= 0) return { color: '#b71c1c' };
  if (days <= 7) return { color: '#e65100' };
  return { color: '#2d6a4f' };
}

function wateredStatus(lastWateredAt, t) {
  if (!lastWateredAt) return { text: t('neverWateredShort'), color: '#e57373', urgent: true };
  const d = lastWateredAt.toDate ? lastWateredAt.toDate() : new Date(lastWateredAt);
  const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (daysAgo === 0) return { text: t('wateredToday'),                        color: '#388e3c', urgent: false };
  if (daysAgo === 1) return { text: t('wateredYesterday'),                    color: '#66bb6a', urgent: false };
  if (daysAgo <= 3)  return { text: t('wateredDaysAgo', { count: daysAgo }), color: '#fb8c00', urgent: false };
  return               { text: t('wateredCritical', { count: daysAgo }),      color: '#c62828', urgent: true };
}

const QUALITY_EMOJI = { excellent: '🌟', good: '👍', average: '😐', poor: '👎' };

// ── Sub-component: single harvest record row ─────────────────────────────────
function HarvestRow({ harvest, onEdit, onDelete, t }) {
  const unit   = harvest.unit === 'L' ? 'л' : 'кг';
  const amount = harvest.yieldKg != null
    ? `${harvest.yieldKg % 1 === 0 ? harvest.yieldKg : Number(harvest.yieldKg).toFixed(1)} ${unit}`
    : '—';

  return (
    <View style={hrStyles.row}>
      <View style={hrStyles.info}>
        <View style={hrStyles.metaRow}>
          <Text style={hrStyles.date}>{formatDate(harvest.harvestedAt)}</Text>
          <Text style={hrStyles.amount}>{harvest.unit === 'L' ? '🪣' : '📦'} {amount}</Text>
          {harvest.quality ? (
            <Text style={hrStyles.quality}>
              {QUALITY_EMOJI[harvest.quality]} {t(harvest.quality)}
            </Text>
          ) : null}
        </View>
        {!!harvest.notes && (
          <Text style={hrStyles.notes} numberOfLines={1}>{harvest.notes}</Text>
        )}
      </View>
      <View style={hrStyles.btns}>
        <TouchableOpacity style={hrStyles.iconBtn} onPress={() => onEdit(harvest)}>
          <Text style={hrStyles.editIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[hrStyles.iconBtn, hrStyles.deleteIconBtn]} onPress={() => onDelete(harvest)}>
          <Text style={hrStyles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CropCard({
  crop,
  onRecordHarvest,
  onFinalHarvest,
  onDelete,
  onWater,
  justWatered,
  harvests = [],
  isExpanded = false,
  onToggleExpand,
  onEditHarvest,
  onDeleteHarvest,
}) {
  const { t } = useTranslation();
  const days    = daysRemaining(crop);
  const isActive = crop.isActive;

  let timerText = '';
  if (isActive) {
    if (days == null) timerText = '';
    else if (days <= 0) timerText = t('harvestTime');
    else if (days <= 7) timerText = `${t('harvestSoon')} (${days}д)`;
    else timerText = t('daysLeft', { count: days });
  }

  const pct = (isActive && days != null && crop.harvestDays)
    ? Math.max(0, Math.min(100, (1 - days / crop.harvestDays) * 100))
    : 100;

  let barColor = '#52b788';
  if (days != null && days <= 0) barColor = '#ef5350';
  else if (days != null && days <= 7) barColor = '#fb8c00';

  let cardBg = '#f9f9f9';
  if (isActive) {
    if (days != null && days <= 0) cardBg = '#fff3f3';
    else if (days != null && days <= 7) cardBg = '#fffde7';
    else cardBg = '#f1f8f4';
  }

  const watered = isActive ? wateredStatus(crop.lastWateredAt, t) : null;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Delete button — absolute top-right */}
      {isActive && onDelete && (
        <TouchableOpacity style={styles.deleteTopBtn} onPress={() => onDelete(crop)}>
          <Text style={styles.deleteTopBtnText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Top: photo + info */}
      <View style={styles.top}>
        {crop.photoUri ? (
          <Image source={{ uri: crop.photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <PlantIcon
              plantId={crop.plantId}
              name={crop.name}
              icon={crop.icon}
              size={30}
              textStyle={styles.photoEmoji}
            />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{resolveName(crop, t)}</Text>
          {!!resolveVariety(crop, t) && <Text style={styles.variety}>{resolveVariety(crop, t)}</Text>}
          <Text style={styles.date}>{t('planted', { date: formatDate(crop.plantedAt) })}</Text>
          {isActive && !!timerText && (
            <Text style={[styles.timer, timerStyle(days)]}>{timerText}</Text>
          )}
          {!isActive && (
            <Text style={styles.harvestedTag}>{t('inactive')}</Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      {isActive && days != null && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
        </View>
      )}

      {/* Watering row */}
      {isActive && watered && (
        <View style={[styles.waterRow, watered.urgent && styles.waterRowUrgent]}>
          <Text style={[styles.waterStatus, { color: watered.color }]}>
            {watered.urgent ? '⚠️' : '💧'} {watered.text}
          </Text>
          <TouchableOpacity
            style={[
              styles.waterBtn,
              justWatered && styles.waterBtnDone,
              watered.urgent && !justWatered && styles.waterBtnUrgent,
            ]}
            onPress={() => onWater && onWater(crop)}
            disabled={justWatered}
          >
            <Text style={[styles.waterBtnText, justWatered && styles.waterBtnTextDone]}>
              {justWatered ? '✓' : '💧'} {justWatered ? t('wateredToday') : t('waterNow')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Harvest action buttons */}
      {isActive && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.recordBtn}
            onPress={() => onRecordHarvest && onRecordHarvest(crop)}
          >
            <Text style={styles.recordBtnText}>📦 {t('recordHarvest')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.finalBtn}
            onPress={() => onFinalHarvest && onFinalHarvest(crop)}
          >
            <Text style={styles.finalBtnText}>{t('finalHarvest')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Harvest records toggle — shown when there are records */}
      {harvests.length > 0 && onToggleExpand && (
        <TouchableOpacity style={styles.recordsToggle} onPress={onToggleExpand}>
          <Text style={styles.recordsToggleText}>
            📋 {harvests.length} {t('harvestEntriesShort')}
          </Text>
          <Text style={styles.recordsToggleArrow}>{isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      )}

      {/* Expanded harvest records list */}
      {isExpanded && harvests.length > 0 && (
        <View style={styles.harvestList}>
          {harvests.map(h => (
            <HarvestRow
              key={h.id}
              harvest={h}
              onEdit={onEditHarvest}
              onDelete={onDeleteHarvest}
              t={t}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const GREEN = '#2d6a4f';

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.07,
    shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  deleteTopBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  deleteTopBtnText: { fontSize: 14, color: '#ef5350', lineHeight: 18 },

  top:              { flexDirection: 'row', gap: 12, paddingRight: 30 },
  photo:            { width: 64, height: 64, borderRadius: 12 },
  photoPlaceholder: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center',
  },
  photoEmoji:   { fontSize: 30 },
  info:         { flex: 1 },
  name:         { fontSize: 17, fontWeight: '700', color: '#1a3c2d' },
  variety:      { fontSize: 13, color: '#666', marginTop: 2 },
  date:         { fontSize: 12, color: '#999', marginTop: 3 },
  timer:        { fontSize: 13, fontWeight: '700', marginTop: 5 },
  harvestedTag: { marginTop: 5, fontSize: 12, color: '#aaa', fontStyle: 'italic' },

  progressWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  progressBg:   { flex: 1, height: 7, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4 },
  progressPct:  { fontSize: 11, color: '#888', minWidth: 32, textAlign: 'right' },

  waterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#f0f7f4', borderRadius: 10, gap: 8,
  },
  waterRowUrgent:   { backgroundColor: '#fff3e0' },
  waterStatus:      { fontSize: 12, fontWeight: '600', flex: 1 },
  waterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#e3f2fd', borderWidth: 1.5, borderColor: '#64b5f6',
  },
  waterBtnUrgent:   { backgroundColor: '#fff3e0', borderColor: '#fb8c00' },
  waterBtnDone:     { backgroundColor: '#e8f5e9', borderColor: '#66bb6a' },
  waterBtnText:     { fontSize: 12, fontWeight: '700', color: '#1565c0' },
  waterBtnTextDone: { color: '#2e7d32' },

  actions:   { flexDirection: 'row', marginTop: 10, gap: 8 },
  recordBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#e8f5e9', borderWidth: 1.5, borderColor: '#a5d6a7',
  },
  recordBtnText: { color: '#1b5e20', fontWeight: '700', fontSize: 13 },
  finalBtn:      { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: GREEN },
  finalBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Harvest records toggle
  recordsToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#eee', gap: 6,
  },
  recordsToggleText:  { fontSize: 13, color: '#888', fontWeight: '600' },
  recordsToggleArrow: { fontSize: 11, color: '#aaa' },

  // Expanded harvest list
  harvestList: { marginTop: 8, gap: 0 },
});

// ── HarvestRow styles ─────────────────────────────────────────────────────────
const hrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    gap: 8,
  },
  info:    { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  date:    { fontSize: 12, color: '#888' },
  amount:  { fontSize: 13, fontWeight: '700', color: '#1a3c2d' },
  quality: { fontSize: 12, color: '#555' },
  notes:   { fontSize: 12, color: '#aaa', marginTop: 3, fontStyle: 'italic' },
  btns:    { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  deleteIconBtn: { backgroundColor: '#ffebee' },
  editIcon:      { fontSize: 15 },
  deleteIcon:    { fontSize: 15 },
});
