import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { addPlant, updatePlant } from '../services/plantsService';
import { getCatalogPlants } from '../services/plantsCatalog';
import { sanitizeInt } from '../utils/inputSanitizers';
import PlantIcon from '../components/PlantIcon';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 16 * 3) / 2;

function PlantCard({ plant, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.plantCard, selected && styles.plantCardSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {selected && <View style={styles.plantCardCheck}><Text style={styles.plantCardCheckText}>✓</Text></View>}
      <View style={styles.plantCardMedia}>
        <PlantIcon
          id={plant.id}
          name={plant.name}
          icon={plant.icon}
          size={30}
          textStyle={styles.plantCardIcon}
        />
      </View>
      <Text style={styles.plantCardName} numberOfLines={1}>{plant.name}</Text>
    </TouchableOpacity>
  );
}

export default function AddPlantScreen({ route, navigation }) {
  const { t } = useTranslation();
  const existing = route.params?.plant ?? null;
  const isEdit = !!existing;

  const catalogPlants = useMemo(() => getCatalogPlants(), []);

  // For edit mode: find the existing plantId in catalog
  const existingCatalogPlant = isEdit && existing.plantId
    ? catalogPlants.find(p => p.id === existing.plantId) ?? null
    : null;

  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState(existingCatalogPlant?.id ?? null);
  const [selectedCatalog, setSelectedCatalog]     = useState(existingCatalogPlant);

  const [variety, setVariety]         = useState(existing?.variety ?? '');
  const [harvestDays, setHarvestDays] = useState(existing?.harvestDays ? String(existing.harvestDays) : '');
  const [notes, setNotes]             = useState(existing?.notes ?? '');
  const [photoUri, setPhotoUri]       = useState(existing?.photoUri ?? null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [saving, setSaving]           = useState(false);

  const displayedPlants = useMemo(() => {
    if (!searchQuery.trim()) return catalogPlants;
    const q = searchQuery.toLowerCase();
    return catalogPlants.filter(p => p.name.toLowerCase().includes(q));
  }, [catalogPlants, searchQuery]);

  function handleSelectCatalog(p) {
    setSelectedCatalogId(p.id);
    setSelectedCatalog(p);
    setSearchQuery('');
  }

  function handleClearCatalog() {
    setSelectedCatalogId(null);
    setSelectedCatalog(null);
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('photo'), t('photoError'));
      return;
    }
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
        const dest = FileSystem.documentDirectory + `plant_ref_${Date.now()}.jpg`;
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
    if (!selectedCatalog) {
      Alert.alert(t('basePlant'), t('noCatalogPlant'));
      return;
    }
    const days = Number(harvestDays);
    if (!harvestDays || isNaN(days) || days < 1) {
      Alert.alert(t('harvestDays'), '≥ 1');
      return;
    }

    setSaving(true);
    try {
      const plantName = selectedCatalog.name;

      if (isEdit) {
        await updatePlant(existing.id, {
          plantId: selectedCatalog.id,
          variety: variety.trim(),
          varietyId: null,
          photoUri,
          harvestDays: days,
          notes: notes.trim(),
        });
      } else {
        await addPlant({
          plantId: selectedCatalog.id,
          variety: variety.trim(),
          varietyId: null,
          photoUri,
          harvestDays: days,
          notes: notes.trim(),
        });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!selectedCatalog && Number(harvestDays) >= 1;

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Catalog selector */}
      <Text style={styles.sectionLabel}>{t('basePlant')} *</Text>

      {selectedCatalog ? (
        <View style={styles.selectedRow}>
          <PlantIcon
            id={selectedCatalog.id}
            name={selectedCatalog.name}
            icon={selectedCatalog.icon}
            size={24}
            textStyle={styles.selectedIcon}
          />
          <Text style={styles.selectedName}>{selectedCatalog.name}</Text>
          {!isEdit && (
            <TouchableOpacity onPress={handleClearCatalog}>
              <Text style={styles.clearLink}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
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
          {searchQuery.length > 0 && (
            <View style={styles.grid}>
              {displayedPlants.length === 0 ? (
                <Text style={styles.emptyText}>{t('noResults')}</Text>
              ) : (
                displayedPlants.map(p => (
                  <PlantCard
                    key={p.id}
                    plant={p}
                    selected={selectedCatalogId === p.id}
                    onPress={() => handleSelectCatalog(p)}
                  />
                ))
              )}
            </View>
          )}
          {!searchQuery && (
            <Text style={styles.hintText}>🌱 {t('selectBasePlant')}</Text>
          )}
        </>
      )}

      {/* Photo */}
      <TouchableOpacity style={styles.photoWrap} onPress={pickPhoto} disabled={photoLoading}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <PlantIcon
              id={selectedCatalog?.id}
              name={selectedCatalog?.name}
              icon={selectedCatalog?.icon}
              size={38}
              textStyle={styles.photoEmoji}
              fallback="📷"
            />
            {!photoLoading && <Text style={styles.photoHint}>{t('selectPhoto')}</Text>}
          </View>
        )}
        {photoLoading && (
          <View style={styles.photoLoadingOverlay}>
            <ActivityIndicator size="large" color="#2d6a4f" />
          </View>
        )}
        {photoUri && !photoLoading && (
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>✎</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.field}>
        <Text style={styles.label}>{t('variety')}</Text>
        <TextInput
          style={styles.input}
          value={variety}
          onChangeText={setVariety}
          placeholder="Чері"
          placeholderTextColor="#bbb"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('harvestDays')} *</Text>
        <TextInput
          style={styles.input}
          value={harvestDays}
          onChangeText={v => setHarvestDays(sanitizeInt(v))}
          keyboardType="numeric"
          placeholder="90"
          placeholderTextColor="#bbb"
        />
        <View style={styles.presets}>
          {[30, 60, 90, 120].map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.preset, harvestDays === String(d) && styles.presetActive]}
              onPress={() => setHarvestDays(String(d))}
            >
              <Text style={[styles.presetText, harvestDays === String(d) && styles.presetActiveText]}>
                {d} {t('days')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('notes')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholderTextColor="#bbb"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || !canSave}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>{isEdit ? t('save') : t('addPlant')}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },

  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#555',
    marginHorizontal: 16, marginTop: 16, marginBottom: 6,
  },

  selectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#f0fbf4', borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: '#2d6a4f',
  },
  selectedIcon: { fontSize: 24 },
  selectedName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a3c2d' },
  clearLink: { fontSize: 18, color: '#e63946', fontWeight: '700', paddingHorizontal: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
    paddingHorizontal: 12, height: 46,
    borderWidth: 1, borderColor: '#d4e8dd',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1a3c2d' },
  searchClear: { fontSize: 16, color: '#aaa', paddingHorizontal: 4 },

  hintText: {
    fontSize: 13, color: '#888', textAlign: 'center',
    marginHorizontal: 16, marginBottom: 8,
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10, marginBottom: 12,
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
  plantCardIcon: { fontSize: 30 },
  plantCardName: { fontSize: 13, fontWeight: '700', color: '#1a3c2d', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', margin: 16 },

  photoWrap: { alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  photo: { width: 120, height: 120, borderRadius: 18 },
  photoPlaceholder: {
    width: 120, height: 120, borderRadius: 18,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#a5d6a7', borderStyle: 'dashed',
  },
  photoEmoji: { fontSize: 34 },
  photoHint: { fontSize: 11, color: '#52b788', marginTop: 6, fontWeight: '600' },
  photoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.80)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center',
  },
  photoBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  field: { marginHorizontal: 16, marginBottom: 14, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 13,
    fontSize: 15, borderWidth: 1, borderColor: '#dde8e2', color: '#1a1a1a',
  },
  textarea: { height: 88, textAlignVertical: 'top' },

  presets: { flexDirection: 'row', gap: 8, marginTop: 10 },
  preset: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#a5d6a7',
  },
  presetActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  presetText: { fontSize: 13, fontWeight: '600', color: '#2d6a4f' },
  presetActiveText: { color: '#fff' },

  saveBtn: {
    margin: 16, backgroundColor: '#2d6a4f', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    elevation: 3, shadowColor: '#2d6a4f', shadowOpacity: 0.3,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  saveBtnDisabled: { backgroundColor: '#a0c4b2' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
