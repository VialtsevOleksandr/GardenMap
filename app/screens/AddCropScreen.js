import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, Switch,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { addCrop } from '../services/cropsService';
import { getPlants, getAllPlants, addPlant } from '../services/plantsService';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 16 * 3) / 2;

// ── Картка рослини ────────────────────────────────────────────────────────────
function PlantCard({ plant, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.plantCard, selected && styles.plantCardSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {selected && <View style={styles.plantCardCheck}><Text style={styles.plantCardCheckText}>✓</Text></View>}
      <View style={styles.plantCardMedia}>
        {plant.photoUri ? (
          <Image source={{ uri: plant.photoUri }} style={styles.plantCardPhoto} />
        ) : (
          <Text style={styles.plantCardIcon}>{plant.icon || '🌱'}</Text>
        )}
      </View>
      <Text style={styles.plantCardName} numberOfLines={1}>{plant.name}</Text>
      {!!plant.variety && (
        <Text style={styles.plantCardVariety} numberOfLines={1}>{plant.variety}</Text>
      )}
      <Text style={styles.plantCardDays}>⏱ {plant.harvestDays} дн.</Text>
    </TouchableOpacity>
  );
}

// ── Головний екран ─────────────────────────────────────────────────────────────
export default function AddCropScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { bedId, plotId } = route.params;

  // Plants data
  const [myPlants, setMyPlants] = useState([]);
  const [catalogPlants, setCatalogPlants] = useState([]);
  const [loadingPlants, setLoadingPlants] = useState(true);

  // Picker state
  const [activeTab, setActiveTab] = useState('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlantId, setSelectedPlantId] = useState(null);

  // Form
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [harvestDays, setHarvestDays] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [icon, setIcon] = useState(null);
  const [saveToDict, setSaveToDict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    Promise.all([getPlants(), getAllPlants()])
      .then(([mine, catalog]) => {
        setMyPlants(mine);
        setCatalogPlants(catalog);
      })
      .catch(console.log)
      .finally(() => setLoadingPlants(false));
  }, []);

  const displayedPlants = useMemo(() => {
    const source = activeTab === 'my' ? myPlants : catalogPlants;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase();
    return source.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.variety && p.variety.toLowerCase().includes(q))
    );
  }, [activeTab, myPlants, catalogPlants, searchQuery]);

  const handleSelectPlant = (p) => {
    setSelectedPlantId(p.id);
    setName(p.name);
    setVariety(p.variety || '');
    setHarvestDays(String(p.harvestDays));
    setPhotoUri(p.photoUri || null);
    setIcon(p.icon || null);
  };

  const handleClearSelection = () => {
    setSelectedPlantId(null);
    setName('');
    setVariety('');
    setHarvestDays('');
    setPhotoUri(null);
    setIcon(null);
  };

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('photo'), t('photoError')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoLoading(true);
      try {
        const src = result.assets[0].uri;
        const dest = `${FileSystem.documentDirectory}crop_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: src, to: dest });
        setPhotoUri(dest);
      } catch {
        Alert.alert(t('photo'), t('photoError'));
      } finally {
        setPhotoLoading(false);
      }
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert(t('cropName'), t('fillAllFields')); return; }
    const days = Number(harvestDays);
    if (!harvestDays || isNaN(days) || days < 1) {
      Alert.alert(t('harvestDays'), '≥ 1'); return;
    }
    setSaving(true);
    try {
      if (saveToDict) {
        await addPlant({ name: name.trim(), variety: variety.trim(), photoUri, icon, harvestDays: days, notes: notes.trim() });
      }
      await addCrop({ bedId, plotId, name: name.trim(), variety: variety.trim(), photoUri, icon, harvestDays: days, notes: notes.trim() });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchPlant')}
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {['catalog', 'my'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'catalog' ? `🌍 ${t('communityPlants')}` : `👤 ${t('myPlants')}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Plant grid — показуємо лише якщо є пошуковий запит */}
      {searchQuery.length > 0 && (
        loadingPlants ? (
          <ActivityIndicator color="#2d6a4f" style={{ marginVertical: 24 }} />
        ) : displayedPlants.length === 0 ? (
          <Text style={styles.emptyText}>{t('noResults')}</Text>
        ) : (
          <View style={styles.grid}>
            {displayedPlants.map(p => (
              <PlantCard
                key={p.id}
                plant={p}
                selected={selectedPlantId === p.id}
                onPress={() => handleSelectPlant(p)}
              />
            ))}
          </View>
        )
      )}

      <View style={styles.divider} />

      {/* Кнопка скинути вибір (якщо є) */}
      {selectedPlantId && (
        <View style={styles.clearRow}>
          <TouchableOpacity onPress={handleClearSelection}>
            <Text style={styles.clearLink}>✕ {t('clearSelection')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photo + Name/Variety row */}
      <View style={styles.topFormRow}>
        <TouchableOpacity style={styles.photoThumb} onPress={pickPhoto} disabled={photoLoading}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoThumbImg} />
          ) : (
            <View style={styles.photoThumbPlaceholder}>
              <Text style={styles.photoThumbIcon}>{icon || '📷'}</Text>
            </View>
          )}
          {photoLoading ? (
            <View style={styles.photoThumbLoading}>
              <ActivityIndicator size="small" color="#2d6a4f" />
            </View>
          ) : (
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>{photoUri ? '✎' : '+'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.nameBlock}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder={t('cropName') + ' *'}
            placeholderTextColor="#bbb"
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.nameInput, { marginTop: 8 }]}
            value={variety}
            onChangeText={setVariety}
            placeholder={t('variety')}
            placeholderTextColor="#bbb"
            autoCapitalize="words"
          />
        </View>
      </View>

      {/* Days to harvest */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('harvestDays')} *</Text>
        <View style={styles.daysRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 10 }]}
            value={harvestDays}
            onChangeText={setHarvestDays}
            placeholder="90"
            placeholderTextColor="#bbb"
            keyboardType="numeric"
          />
          <View style={styles.presets}>
            {[30, 60, 90, 120].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.preset, harvestDays === String(d) && styles.presetActive]}
                onPress={() => setHarvestDays(String(d))}
              >
                <Text style={[styles.presetText, harvestDays === String(d) && styles.presetActiveText]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('notes')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholderTextColor="#bbb"
          textAlignVertical="top"
        />
      </View>

      {/* Save to catalog */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('saveToPlants')}</Text>
        <Switch
          value={saveToDict}
          onValueChange={setSaveToDict}
          trackColor={{ false: '#767577', true: '#a5d6a7' }}
          thumbColor={saveToDict ? '#2d6a4f' : '#f4f3f4'}
        />
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>{t('plantBtn')}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },

  divider: {
    height: 1, backgroundColor: '#d4e8dd', marginHorizontal: 16,
  },
  clearRow: {
    alignItems: 'flex-end', marginHorizontal: 16, marginTop: 10,
  },
  clearLink: { fontSize: 13, color: '#e63946', fontWeight: '600' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 14,
    paddingHorizontal: 12, height: 46,
    borderWidth: 1, borderColor: '#d4e8dd',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1a3c2d' },
  searchClear: { fontSize: 16, color: '#aaa', paddingHorizontal: 4 },

  // Tabs
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 10, marginBottom: 12,
    backgroundColor: '#e8f5e9', borderRadius: 12, padding: 3, gap: 3,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#2d6a4f' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#555' },
  tabTextActive: { color: '#fff' },

  // Plant grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10, marginBottom: 16,
  },
  plantCard: {
    width: CARD_W, backgroundColor: '#fff', borderRadius: 14,
    padding: 10, alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
  },
  plantCardSelected: { borderColor: '#2d6a4f', backgroundColor: '#f0fbf4' },
  plantCardCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center',
  },
  plantCardCheckText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  plantCardMedia: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center',
    marginBottom: 7,
  },
  plantCardPhoto: { width: 56, height: 56, borderRadius: 12 },
  plantCardIcon: { fontSize: 30 },
  plantCardName: { fontSize: 13, fontWeight: '700', color: '#1a3c2d', textAlign: 'center' },
  plantCardVariety: { fontSize: 11, color: '#777', marginTop: 1, textAlign: 'center' },
  plantCardDays: { fontSize: 11, color: '#52b788', fontWeight: '600', marginTop: 3 },

  emptyText: {
    textAlign: 'center', marginVertical: 24, color: '#aaa',
    fontSize: 14, marginHorizontal: 16,
  },

  // Top form row (photo + name/variety)
  topFormRow: {
    flexDirection: 'row', marginHorizontal: 16, gap: 12, marginBottom: 14, marginTop: 16,
  },
  photoThumb: { position: 'relative' },
  photoThumbImg: { width: 88, height: 88, borderRadius: 14 },
  photoThumbLoading: {
    position: 'absolute', bottom: 4, right: 4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoThumbPlaceholder: {
    width: 88, height: 88, borderRadius: 14,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#a5d6a7', borderStyle: 'dashed',
  },
  photoThumbIcon: { fontSize: 34 },
  photoBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center',
  },
  photoBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  nameBlock: { flex: 1 },
  nameInput: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 13,
    paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#dde8e2', color: '#1a1a1a',
  },

  // Form
  field: { marginHorizontal: 16, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 13,
    fontSize: 15, borderWidth: 1, borderColor: '#dde8e2', color: '#1a1a1a',
  },
  textarea: { height: 88, textAlignVertical: 'top' },

  daysRow: { flexDirection: 'row', alignItems: 'center' },
  presets: { flexDirection: 'row', gap: 6 },
  preset: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#a5d6a7',
    alignItems: 'center', justifyContent: 'center',
  },
  presetActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  presetText: { fontSize: 12, fontWeight: '700', color: '#2d6a4f' },
  presetActiveText: { color: '#fff' },

  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: '#fff', padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#dde8e2',
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#1a3c2d' },

  saveBtn: {
    margin: 16, backgroundColor: '#2d6a4f', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    elevation: 3, shadowColor: '#2d6a4f', shadowOpacity: 0.3,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
