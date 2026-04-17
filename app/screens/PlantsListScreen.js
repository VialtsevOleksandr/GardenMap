import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPlants, deletePlant } from '../services/plantsService';
import { useFocusEffect } from '@react-navigation/native';

export default function PlantsListScreen({ navigation }) {
  const { t } = useTranslation();
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPlants = async () => {
    try {
      const data = await getPlants();
      setPlants(data);
    } catch (e) {
      console.log('Error loading plants:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadPlants();
    }, [])
  );

  const handleDelete = (id, name) => {
    Alert.alert(t('delete'), `${t('delete')} ${name}?`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        try {
          await deletePlant(id);
          setPlants(plants.filter(p => p.id !== id));
        } catch (e) {
          Alert.alert('Error', e.message);
        }
      }}
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.photoUri ? (
        <Image source={{ uri: item.photoUri }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.emoji}>🌱</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        {item.variety ? <Text style={styles.variety}>{item.variety}</Text> : null}
        <Text style={styles.days}>⏱ {item.harvestDays} дн.</Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
        <Text style={{ fontSize: 18, color: '#e63946' }}>🗑</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2d6a4f" />
      ) : (
        <FlatList
          data={plants}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>{t('noPlants')}</Text>}
        />
      )}
      
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddPlant')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },
  empty: { textAlign: 'center', marginTop: 40, color: '#777', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2ece7',
  },
  photo: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  photoPlaceholder: {
    width: 60, height: 60, borderRadius: 8, marginRight: 12,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center'
  },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a3c2d' },
  variety: { fontSize: 14, color: '#555', marginTop: 2 },
  days: { fontSize: 13, color: '#2d6a4f', marginTop: 4, fontWeight: '600' },
  deleteBtn: { padding: 8 },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
});
