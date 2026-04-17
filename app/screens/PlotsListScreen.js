import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPlots, deletePlot } from '../services/plotsService';

export default function PlotsListScreen({ navigation }) {
  const { t } = useTranslation();
  const [plots, setPlots] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Будуємо індекс для швидкого пошуку O(1)
  const searchIndex = useMemo(() => {
    const map = new Map();
    plots.forEach(p => map.set(p.name.toLowerCase(), p));
    return map;
  }, [plots]);

  const filtered = useMemo(() => {
    if (!search.trim()) return plots;
    const q = search.toLowerCase();
    return plots.filter(p => p.name.toLowerCase().includes(q));
  }, [plots, search]);

  async function load() {
    setLoading(true);
    try {
      const data = await getPlots();
      setPlots(data);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  async function handleDelete(plot) {
    Alert.alert(
      t('delete'),
      `${plot.name}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deletePlot(plot.id);
            setPlots(prev => prev.filter(p => p.id !== plot.id));
          },
        },
      ]
    );
  }

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('PlotDetail', { plot: item })}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>
            {t('area')}: {item.area ? `${item.area.toFixed(0)} м²` : '—'}
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder={t('search')}
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#aaa"
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2d6a4f" />
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>{t('noPlots')}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddPlotChoice')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: {
    margin: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 10,
    elevation: 2,
  },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  cardSub: { fontSize: 13, color: '#666', marginTop: 3 },
  arrow: { fontSize: 24, color: '#aaa' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 16, color: '#999' },
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
    elevation: 5,
  },
  fabText: { fontSize: 32, color: '#fff', lineHeight: 36 },
});
