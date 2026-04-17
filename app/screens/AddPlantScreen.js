import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { addPlant, updatePlant } from '../services/plantsService';

export default function AddPlantScreen({ route, navigation }) {
  const { t } = useTranslation();
  const existing = route.params?.plant ?? null;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [variety, setVariety] = useState(existing?.variety ?? '');
  const [harvestDays, setHarvestDays] = useState(existing?.harvestDays ? String(existing.harvestDays) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photoUri, setPhotoUri] = useState(existing?.photoUri ?? null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (!name.trim()) return Alert.alert(t('cropName'), t('fillAllFields'));
    const days = Number(harvestDays);
    if (!harvestDays || isNaN(days) || days < 1) return Alert.alert(t('harvestDays'), '≥ 1');

    setSaving(true);
    try {
      if (isEdit) {
        await updatePlant(existing.id, {
          name: name.trim(),
          variety: variety.trim(),
          photoUri,
          icon: existing.icon ?? null,
          harvestDays: days,
          notes: notes.trim(),
        });
      } else {
        await addPlant({
          name: name.trim(),
          variety: variety.trim(),
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

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Photo */}
      <TouchableOpacity style={styles.photoWrap} onPress={pickPhoto} disabled={photoLoading}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>{existing?.icon || '📷'}</Text>
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
        <Text style={styles.label}>{t('cropName')} *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Томат"
          placeholderTextColor="#bbb"
          autoCapitalize="words"
        />
      </View>

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
          onChangeText={setHarvestDays}
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

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
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

  photoWrap: { alignSelf: 'center', marginTop: 20, marginBottom: 8 },
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
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
