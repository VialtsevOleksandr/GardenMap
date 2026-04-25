import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import PlantIcon from './PlantIcon';

function daysRem(crop) {
  if (!crop?.plantedAt) return null;
  const planted = crop.plantedAt.toDate ? crop.plantedAt.toDate() : new Date(crop.plantedAt);
  return Math.ceil((planted.getTime() + crop.harvestDays * 86400000 - Date.now()) / 86400000);
}

function wateredInfo(lastWateredAt, t) {
  if (!lastWateredAt) return { text: t('neverWatered'), color: '#e57373', critical: true };
  const d = lastWateredAt.toDate ? lastWateredAt.toDate() : new Date(lastWateredAt);
  const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (daysAgo === 0) return { text: t('wateredToday'),                         color: '#388e3c', critical: false };
  if (daysAgo === 1) return { text: t('wateredYesterday'),                     color: '#66bb6a', critical: false };
  if (daysAgo <= 3)  return { text: t('wateredDaysAgo', { count: daysAgo }),  color: '#fb8c00', critical: false };
  return               { text: t('wateredCritical', { count: daysAgo }),   color: '#c62828', critical: true };
}

export default function BedListItem({ bed, crop, onPress, onWater }) {
  const { t } = useTranslation();

  const days    = crop ? daysRem(crop) : null;
  const pct     = (days != null && crop?.harvestDays)
    ? Math.max(0, Math.min(100, (1 - days / crop.harvestDays) * 100))
    : null;
  const isReady = days != null && days <= 0;
  const isSoon  = !isReady && days != null && days <= 7;
  const watered = crop ? wateredInfo(crop.lastWateredAt, t) : null;

  const barColor    = isReady ? '#ef5350' : isSoon ? '#fb8c00' : '#52b788';
  const cardBg      = isReady ? '#fff3f3' : isSoon ? '#fffde7' : '#ffffff';
  const borderColor = isReady ? '#ef9a9a' : isSoon ? '#ffe082' : '#eeeeee';
  const iconBg      = crop ? '#e8f5e9' : '#f5ede0';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderColor }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Top row: icon + name + bed label */}
      <View style={styles.topRow}>
        {crop?.photoUri ? (
          <Image source={{ uri: crop.photoUri }} style={styles.icon} />
        ) : (
          <View style={[styles.iconBg, { backgroundColor: iconBg }]}>
            {crop ? (
              <PlantIcon
                plantId={crop.plantId}
                name={crop.name}
                icon={crop.icon}
                size={26}
                textStyle={styles.iconEmoji}
              />
            ) : (
              <Text style={styles.iconEmoji}>🟫</Text>
            )}
          </View>
        )}

        <View style={styles.mid}>
          <Text style={styles.cropName} numberOfLines={1}>
            {crop
              ? `${crop.name}${crop.variety ? ` (${crop.variety})` : ''}`
              : t('noCropInBed')}
          </Text>
          <Text style={styles.bedLabel}>{bed.label}</Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </View>

      {/* Progress bar + days label */}
      {pct != null ? (
        <>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.pctText}>{Math.round(pct)}%</Text>
            {isReady ? (
              <View style={styles.readyWrap}>
                <PlantIcon
                  plantId={crop?.plantId}
                  name={crop?.name}
                  icon={crop?.icon}
                  size={14}
                  textStyle={styles.readyText}
                  fallback="🌿"
                />
                <Text style={styles.readyText}>{t('readyToHarvest')}</Text>
              </View>
            ) : (
              <Text style={styles.daysText}>{t('daysRemaining', { count: days })}</Text>
            )}
          </View>
        </>
      ) : (
        !crop && (
          <Text style={styles.noPlantHint}>{t('tapToAddCrop')}</Text>
        )
      )}

      {/* Watering action bar — only if there's a crop */}
      {watered && (
        <View style={[styles.waterBar, watered.critical && styles.waterBarCritical]}>
          {/* Status indicator */}
          <View style={styles.waterStatusWrap}>
            <Text style={[styles.waterStatusText, { color: watered.color }]}>
              {watered.critical ? '⚠️ ' : '💧 '}{watered.text}
            </Text>
          </View>

          {/* Water button */}
          <TouchableOpacity
            style={[styles.waterBtn, watered.critical && styles.waterBtnCritical]}
            onPress={(e) => { e.stopPropagation?.(); onWater(crop); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.waterBtnText, watered.critical && styles.waterBtnTextCritical]}>
              💧 {t('waterNow')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },

  icon: { width: 52, height: 52, borderRadius: 12 },
  iconBg: {
    width: 52, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 26 },

  mid: { flex: 1 },
  cropName: { fontSize: 16, fontWeight: '700', color: '#1a3c2d' },
  bedLabel:  { fontSize: 13, color: '#888', marginTop: 3 },

  chevron: { fontSize: 22, color: '#ccc', fontWeight: '300' },

  progressBg: {
    height: 8, backgroundColor: '#e0e0e0',
    borderRadius: 4, overflow: 'hidden', marginBottom: 6,
  },
  progressFill: { height: 8, borderRadius: 4 },

  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  pctText:   { fontSize: 12, color: '#aaa', fontWeight: '600' },
  daysText:  { fontSize: 12, color: '#777' },
  readyWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readyText: { fontSize: 13, fontWeight: '800', color: '#c62828' },

  noPlantHint: { fontSize: 12, color: '#bbb', fontStyle: 'italic', marginTop: 2 },

  // Watering bar
  waterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f7f4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  waterBarCritical: {
    backgroundColor: '#fff3e0',
  },

  waterStatusWrap: { flex: 1 },
  waterStatusText: { fontSize: 12, fontWeight: '600' },

  waterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    borderWidth: 1.5,
    borderColor: '#64b5f6',
  },
  waterBtnCritical: {
    backgroundColor: '#fff3e0',
    borderColor: '#fb8c00',
  },
  waterBtnText:         { fontSize: 12, fontWeight: '700', color: '#1565c0' },
  waterBtnTextCritical: { color: '#e65100' },
});
