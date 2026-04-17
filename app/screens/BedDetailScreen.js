import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCrops, deleteCrop, deactivateCrop, markWatered } from '../services/cropsService';
import { addHarvest } from '../services/harvestsService';
import { getRotationAdvice, getNextCropSuggestions } from '../services/rotationRules';
import CropCard from '../components/CropCard';

export default function BedDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { bed, plotId } = route.params;

  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [justWateredIds, setJustWateredIds] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCrops(bed.id);
      data.sort((a, b) => (a.plantedAt?.seconds ?? 0) - (b.plantedAt?.seconds ?? 0));
      setCrops(data);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [bed.id]);

  useEffect(() => {
    navigation.setOptions({
      title: `${bed.label} · ${bed.widthM ?? 1}×${bed.heightM ?? 1} м`,
    });
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, bed, load]);

  async function handleHarvest(crop) {
    Alert.alert(
      `🍅 ${t('harvest')}`,
      crop.name,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('harvest'),
          onPress: async () => {
            try {
              await addHarvest({ cropId: crop.id, bedId: bed.id, plotId, yieldKg: 0, quality: 'good', notes: '' });
              await deactivateCrop(crop.id);
              load();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  async function handleDelete(crop) {
    Alert.alert(t('delete'), `${crop.name}?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteCrop(crop.id);
          load();
        },
      },
    ]);
  }

  async function handleWater(crop) {
    try {
      await markWatered(crop.id);
      setCrops(prev => prev.map(c =>
        c.id === crop.id
          ? { ...c, lastWateredAt: { toDate: () => new Date() } }
          : c
      ));
      setJustWateredIds(prev => new Set([...prev, crop.id]));
      setTimeout(() => {
        setJustWateredIds(prev => {
          const next = new Set(prev);
          next.delete(crop.id);
          return next;
        });
      }, 3000);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  const activeCrops = crops.filter(c => c.isActive);
  const pastCrops   = crops.filter(c => !c.isActive);

  const cropNames  = crops.map(c => c.name);
  const advice     = getRotationAdvice(cropNames);
  const suggestions = getNextCropSuggestions(cropNames);

  const adviceBg   = { good: '#e8f5e9', ok: '#fffde7', bad: '#ffebee' }[advice.status] ?? '#f5f5f5';
  const adviceIcon = { good: '✅', ok: 'ℹ️', bad: '⚠️' }[advice.status];
  const adviceBadgeColor = { good: '#2e7d32', ok: '#f57f17', bad: '#c62828' }[advice.status];
  const adviceKey  = `rotation${advice.status.charAt(0).toUpperCase()}${advice.status.slice(1)}`;

  const bedArea = ((bed.widthM ?? 1) * (bed.heightM ?? 1)).toFixed(1);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Bed info header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>{bed.label}</Text>
            <Text style={styles.headerDims}>
              {bed.widthM ?? 1} × {bed.heightM ?? 1} м  ·  {bedArea} м²
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerBedIcon}>🟫</Text>
          </View>
        </View>

        {/* Rotation section */}
        {crops.length > 0 && (
          <View style={[styles.rotationCard, { borderLeftColor: adviceBadgeColor }]}>
            {/* Title row */}
            <View style={styles.rotationTitleRow}>
              <Text style={styles.rotationTitle}>🌾 {t('cropHistory')}</Text>
              <View style={[styles.statusBadge, { backgroundColor: adviceBg }]}>
                <Text style={[styles.statusBadgeText, { color: adviceBadgeColor }]}>
                  {adviceIcon} {t(adviceKey)}
                </Text>
              </View>
            </View>

            <Text style={styles.rotationReason}>
              {t(advice.reasonKey, advice.reasonParams ?? {})}
            </Text>

            {/* Next season suggestions */}
            <View style={styles.divider} />
            <Text style={styles.nextTitle}>
              🌱 {t('rotation.nextSeasonTitle')}
            </Text>

            {suggestions.recommended.length > 0 ? (
              <>
                <Text style={styles.chipGroupLabel}>
                  {t('rotation.recommend', { crop: suggestions.lastCrop })}
                </Text>
                <View style={styles.chipsRow}>
                  {suggestions.recommended.map(crop => (
                    <View key={crop} style={styles.chipGood}>
                      <Text style={styles.chipGoodText}>{crop}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.noSuggestionsText}>{t('rotation.noSuggestions')}</Text>
            )}

            {suggestions.avoid.length > 0 && (
              <>
                <Text style={[styles.chipGroupLabel, styles.chipGroupLabelBad]}>
                  {t('rotation.avoidLabel', { crop: suggestions.lastCrop })}
                </Text>
                <View style={styles.chipsRow}>
                  {suggestions.avoid.map(crop => (
                    <View key={crop} style={styles.chipBad}>
                      <Text style={styles.chipBadText}>{crop}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Empty state rotation hint */}
        {crops.length === 0 && !loading && (
          <View style={styles.rotationEmpty}>
            <Text style={styles.rotationEmptyIcon}>🌾</Text>
            <Text style={styles.rotationEmptyText}>{t('rotation.noHistory')}</Text>
          </View>
        )}

        {/* Active crops */}
        <Text style={styles.sectionTitle}>🌿 {t('crop')}</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#2d6a4f" />
        ) : activeCrops.length === 0 ? (
          <Text style={styles.emptyText}>{t('noCrops')}</Text>
        ) : (
          activeCrops.map(c => (
            <CropCard
              key={c.id}
              crop={c}
              onHarvest={handleHarvest}
              onDelete={handleDelete}
              onWater={handleWater}
              justWatered={justWateredIds.has(c.id)}
            />
          ))
        )}

        {/* Past crops */}
        {pastCrops.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              📦 {t('cropHistory')}
            </Text>
            {pastCrops.slice().reverse().map(c => (
              <CropCard
                key={c.id}
                crop={c}
                onHarvest={handleHarvest}
                onDelete={handleDelete}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddCrop', { bedId: bed.id, plotId })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const GREEN      = '#2d6a4f';
const GREEN_DARK = '#1a3c2d';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f7f4' },

  // Bed header card
  headerCard: {
    margin: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  headerLeft:  { flex: 1 },
  headerLabel: { fontSize: 22, fontWeight: '800', color: GREEN_DARK },
  headerDims:  { fontSize: 13, color: '#888', marginTop: 4 },
  headerRight: { marginLeft: 12 },
  headerBedIcon: { fontSize: 40 },

  // Rotation card
  rotationCard: {
    margin: 12,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    borderLeftWidth: 4,
  },
  rotationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rotationTitle: { fontSize: 15, fontWeight: '700', color: GREEN_DARK },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  rotationReason: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 4 },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },

  nextTitle: { fontSize: 14, fontWeight: '700', color: GREEN_DARK, marginBottom: 8 },
  chipGroupLabel: {
    fontSize: 12, color: '#2e7d32', fontWeight: '600',
    marginBottom: 6, marginTop: 4,
  },
  chipGroupLabelBad: { color: '#c62828', marginTop: 10 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },

  chipGood: {
    backgroundColor: '#e8f5e9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  chipGoodText: { fontSize: 13, color: '#1b5e20', fontWeight: '600' },

  chipBad: {
    backgroundColor: '#ffebee',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#ef9a9a',
  },
  chipBadText: { fontSize: 13, color: '#b71c1c', fontWeight: '600' },

  noSuggestionsText: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },

  rotationEmpty: { alignItems: 'center', marginVertical: 12 },
  rotationEmptyIcon: { fontSize: 32 },
  rotationEmptyText: { fontSize: 13, color: '#bbb', marginTop: 4 },

  // Section titles & empty
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: GREEN_DARK,
    marginHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 36,
    fontSize: 15,
    color: '#aaa',
  },

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
  fabText: { fontSize: 32, color: '#fff', lineHeight: 36 },
});
