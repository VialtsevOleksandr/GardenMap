import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Image, Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPlants, getAllPlants, deletePlant } from '../services/plantsService';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const TABS = ['my', 'community'];

export default function PlantsListScreen({ navigation }) {
  const { t } = useTranslation();
  const user = useAuth();
  const [activeTab, setActiveTab] = useState('my');
  const [myPlants, setMyPlants] = useState([]);
  const [communityPlants, setCommunityPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mine, all] = await Promise.all([getPlants(), getAllPlants()]);
      setMyPlants(mine);
      setCommunityPlants(all);
    } catch (e) {
      console.log('Error loading plants:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => { loadAll(); }, [])
  );

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.spring(indicatorAnim, {
      toValue: tab === 'my' ? 0 : 1,
      useNativeDriver: false,
    }).start();
  };

  const handleDelete = (id, name) => {
    Alert.alert(t('delete'), `${t('delete')} ${name}?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          try {
            await deletePlant(id);
            setMyPlants(myPlants.filter(p => p.id !== id));
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => {
    const isMine = item.userId === user?.uid;
    return (
      <View style={styles.card}>
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.emoji}>{item.icon || '🌱'}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          {item.variety ? <Text style={styles.variety}>{item.variety}</Text> : null}
          <Text style={styles.days}>⏱ {item.harvestDays} {t('days')}</Text>
        </View>
        {isMine && (
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddPlant', { plant: item })}
              style={styles.actionBtn}
            >
              <Text style={{ fontSize: 16 }}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item.id, item.name)}
              style={styles.actionBtn}
            >
              <Text style={{ fontSize: 16, color: '#e63946' }}>🗑</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const data = activeTab === 'my' ? myPlants : communityPlants;

  const indicatorLeft = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => switchTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'my' ? t('myPlants') : t('communityPlants')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2d6a4f" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {activeTab === 'my' ? t('noPlants') : t('noCommunityPlants')}
            </Text>
          }
        />
      )}

      {activeTab === 'my' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddPlant')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#e8f5e9',
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    borderRadius: 12, height: 44, position: 'relative', overflow: 'hidden',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#555' },
  tabTextActive: { color: '#fff' },
  tabIndicator: {
    position: 'absolute', width: '50%', height: '100%',
    backgroundColor: '#2d6a4f', borderRadius: 12,
  },
  empty: { textAlign: 'center', marginTop: 40, color: '#777', fontSize: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    borderWidth: 1, borderColor: '#e2ece7',
  },
  photo: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  photoPlaceholder: {
    width: 60, height: 60, borderRadius: 8, marginRight: 12,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a3c2d' },
  variety: { fontSize: 14, color: '#555', marginTop: 2 },
  days: { fontSize: 13, color: '#2d6a4f', marginTop: 4, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8 },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
});
