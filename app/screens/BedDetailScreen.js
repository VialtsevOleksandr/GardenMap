import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCrops, deleteCrop, deactivateCrop } from '../services/cropsService';
import { addHarvest } from '../services/harvestsService';
import { getRotationAdvice } from '../services/rotationRules';
import CropCard from '../components/CropCard';

export default function BedDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { bed, plotId } = route.params;

  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCrops(bed.id);
      // Sort oldest first so rotation advice reads correctly
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
              await addHarvest({
                cropId: crop.id,
                bedId: bed.id,
                plotId,
                yieldKg: 0,
                quality: 'good',
                notes: '',
              });
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

  const activeCrops = crops.filter(c => c.isActive);
  const pastCrops = crops.filter(c => !c.isActive);

  // Pass crop names in chronological order (oldest first) for rotation advice
  const advice = getRotationAdvice(crops.map(c => c.name));

  const adviceBg = { good: '#e8f5e9', ok: '#fffde7', bad: '#ffebee' }[advice.status] ?? '#f5f5f5';
  const adviceIcon = { good: '✅', ok: 'ℹ️', bad: '⚠️' }[advice.status];
  const adviceKey = `rotation${advice.status.charAt(0).toUpperCase()}${advice.status.slice(1)}`;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Rotation advice banner */}
        {crops.length > 0 && (
          <View style={[styles.adviceCard, { backgroundColor: adviceBg }]}>
            <Text style={styles.adviceTitle}>
              {adviceIcon} {t(adviceKey)}
            </Text>
            <Text style={styles.adviceBody}>
              {t(advice.reasonKey, advice.reasonParams ?? {})}
            </Text>
          </View>
        )}

        {/* Active crops */}
        <Text style={styles.sectionTitle}>{t('crop')}</Text>

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
            />
          ))
        )}

        {/* Past crops */}
        {pastCrops.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              {t('cropHistory')}
            </Text>
            {pastCrops.reverse().map(c => (
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f7f4' },

  adviceCard: {
    margin: 12,
    padding: 14,
    borderRadius: 14,
    elevation: 1,
  },
  adviceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a3c2d',
    marginBottom: 4,
  },
  adviceBody: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3c2d',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 36,
    fontSize: 15,
    color: '#aaa',
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
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
  fabText: { fontSize: 32, color: '#fff', lineHeight: 36 },
});
