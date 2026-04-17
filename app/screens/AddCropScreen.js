import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { addCrop } from '../services/cropsService';
import { getPlants, addPlant } from '../services/plantsService';

export default function AddCropScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { bedId, plotId } = route.params;

  const [dictPlants, setDictPlants] = useState([]);
  const [loadingDict, setLoadingDict] = useState(true);

  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [harvestDays, setHarvestDays] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  
  const [saveToDict, setSaveToDict] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlants().then(data => {
      setDictPlants(data);
      setLoadingDict(false);
    }).catch(e => {
      setLoadingDict(false);
      console.log(e);
    });
  }, []);

  const handleSelectPlant = (p) => {
    setName(p.name);
    setVariety(p.variety || '');
    setHarvestDays(String(p.harvestDays));
    setPhotoUri(p.photoUri);
  };

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('photo'), 'Permission denied');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const src = result.assets[0].uri;
      const dest = `${FileSystem.documentDirectory}crop_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: src, to: dest });
      setPhotoUri(dest);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert(t('cropName'), '—');
      return;
    }
    const days = Number(harvestDays);
    if (!harvestDays || isNaN(days) || days < 1) {
      Alert.alert(t('harvestDays'), '≥ 1');
      return;
    }
    setSaving(true);
    try {
      if (saveToDict) {
        await addPlant({
          name: name.trim(),
          variety: variety.trim(),
          photoUri,
          harvestDays: days,
          notes: notes.trim(),
        });
      }
      await addCrop({
        bedId,
        plotId,
        name: name.trim(),
        variety: variety.trim(),
        photoUri,
        harvestDays: days,
        notes: notes.trim(),
      });
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
      <Text style={styles.heading}>{t('addCrop')}</Text>

      {/* Dictionary Picker */}
      {!loadingDict && dictPlants.length > 0 && (
        <View style={styles.dictSection}>
          <Text style={styles.dictLabel}>{t('selectPlant')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {dictPlants.map(p => (
              <TouchableOpacity key={p.id} style={styles.dictChip} onPress={() => handleSelectPlant(p)}>
                {p.photoUri ? (
                  <Image source={{ uri: p.photoUri }} style={styles.dictPhoto} />
                ) : (
                  <Text style={styles.dictEmoji}>🌱</Text>
                )}
                <Text style={styles.dictName} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Photo picker */}
      <TouchableOpacity style={styles.photoWrap} onPress={pickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>📷</Text>
            <Text style={styles.photoHint}>{t('selectPhoto')}</Text>
          </View>
        )}
        {photoUri && (
          <View style={styles.photoEditBadge}>
            <Text style={styles.photoEditText}>✎</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Name */}
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

      {/* Variety */}
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

      {/* Days to harvest */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('harvestDays')} *</Text>
        <TextInput
          style={styles.input}
          value={harvestDays}
          onChangeText={setHarvestDays}
          placeholder="90"
          placeholderTextColor="#bbb"
          keyboardType="numeric"
        />
      </View>

      {/* Quick presets */}
      <View style={styles.presets}>
        {[30, 60, 90, 120].map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.preset, harvestDays === String(d) && styles.presetActive]}
            onPress={() => setHarvestDays(String(d))}
          >
            <Text style={[styles.presetText, harvestDays === String(d) && styles.presetActiveText]}>
              {d}д
            </Text>
          </TouchableOpacity>
        ))}
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

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('saveToPlants')}</Text>
        <Switch 
          value={saveToDict} 
          onValueChange={setSaveToDict} 
          trackColor={{ false: '#767577', true: '#a5d6a7' }}
          thumbColor={saveToDict ? '#2d6a4f' : '#f4f3f4'}
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>{t('save')}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a3c2d',
    margin: 16,
    marginBottom: 8,
  },
  dictSection: { marginBottom: 8 },
  dictLabel: { marginHorizontal: 16, fontSize: 14, color: '#555', marginBottom: 8 },
  dictChip: {
    width: 72,
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#e8f5e9',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  dictPhoto: { width: 36, height: 36, borderRadius: 8, marginBottom: 4 },
  dictEmoji: { fontSize: 24, marginBottom: 4 },
  dictName: { fontSize: 11, fontWeight: '600', color: '#2d6a4f', textAlign: 'center', paddingHorizontal: 2 },
  
  photoWrap: {
    alignSelf: 'center',
    marginVertical: 16,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 18,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 18,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#a5d6a7',
    borderStyle: 'dashed',
  },
  photoEmoji: { fontSize: 34 },
  photoHint: { fontSize: 11, color: '#52b788', marginTop: 6, fontWeight: '600' },
  photoEditBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2d6a4f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  field: { marginHorizontal: 16, marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#dde8e2',
    color: '#1a1a1a',
  },
  textarea: {
    height: 88,
    textAlignVertical: 'top',
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dde8e2',
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#1a3c2d' },

  presets: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  preset: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  presetActive: {
    backgroundColor: '#2d6a4f',
    borderColor: '#2d6a4f',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d6a4f',
  },
  presetActiveText: { color: '#fff' },

  saveBtn: {
    margin: 16,
    backgroundColor: '#2d6a4f',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
