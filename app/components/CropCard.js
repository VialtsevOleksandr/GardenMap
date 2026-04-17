import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  if (daysAgo === 0) return { text: t('wateredToday'), color: '#388e3c', urgent: false };
  if (daysAgo === 1) return { text: t('wateredYesterday'), color: '#66bb6a', urgent: false };
  if (daysAgo <= 3)  return { text: t('wateredDaysAgo', { count: daysAgo }), color: '#fb8c00', urgent: false };
  return               { text: t('wateredCritical', { count: daysAgo }), color: '#c62828', urgent: true };
}

export default function CropCard({ crop, onHarvest, onDelete, onWater, justWatered }) {
  const { t } = useTranslation();
  const days = daysRemaining(crop);
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
      {/* Top: photo + info */}
      <View style={styles.top}>
        {crop.photoUri ? (
          <Image source={{ uri: crop.photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>{crop.icon || '🌱'}</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name}>{crop.name}</Text>
          {!!crop.variety && <Text style={styles.variety}>{crop.variety}</Text>}
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

      {/* Actions: harvest + delete */}
      {isActive && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.harvestBtn} onPress={() => onHarvest(crop)}>
            <Text style={styles.harvestBtnText}>🍅 {t('harvest')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(crop)}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const GREEN = '#2d6a4f';

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  top: { flexDirection: 'row', gap: 12 },
  photo: { width: 64, height: 64, borderRadius: 12 },
  photoPlaceholder: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: '#e8f5e9',
    alignItems: 'center', justifyContent: 'center',
  },
  photoEmoji: { fontSize: 30 },
  info: { flex: 1 },
  name:        { fontSize: 17, fontWeight: '700', color: '#1a3c2d' },
  variety:     { fontSize: 13, color: '#666', marginTop: 2 },
  date:        { fontSize: 12, color: '#999', marginTop: 3 },
  timer:       { fontSize: 13, fontWeight: '700', marginTop: 5 },
  harvestedTag:{ marginTop: 5, fontSize: 12, color: '#aaa', fontStyle: 'italic' },

  progressWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, gap: 8,
  },
  progressBg: {
    flex: 1, height: 7,
    backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden',
  },
  progressFill:  { height: 7, borderRadius: 4 },
  progressPct:   { fontSize: 11, color: '#888', minWidth: 32, textAlign: 'right' },

  // Watering row
  waterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f0f7f4',
    borderRadius: 10,
    gap: 8,
  },
  waterRowUrgent: {
    backgroundColor: '#fff3e0',
  },
  waterStatus: { fontSize: 12, fontWeight: '600', flex: 1 },
  waterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    borderWidth: 1.5,
    borderColor: '#64b5f6',
  },
  waterBtnUrgent: {
    backgroundColor: '#fff3e0',
    borderColor: '#fb8c00',
  },
  waterBtnDone: {
    backgroundColor: '#e8f5e9',
    borderColor: '#66bb6a',
  },
  waterBtnText:     { fontSize: 12, fontWeight: '700', color: '#1565c0' },
  waterBtnTextDone: { color: '#2e7d32' },

  // Actions
  actions: { flexDirection: 'row', marginTop: 10, gap: 8 },
  harvestBtn: {
    flex: 1, backgroundColor: GREEN,
    paddingVertical: 11, borderRadius: 12, alignItems: 'center',
  },
  harvestBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  deleteBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#ffebee',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18, color: '#ef5350' },
});
