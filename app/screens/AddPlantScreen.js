import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { addPlant } from '../services/plantsService';

export default function AddPlantScreen({ navigation }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [harvestDays, setHarvestDays] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [saving, setSaving] = useState(false);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const src = result.assets[0].uri;
      const dest = `${FileSystem.documentDirectory}plant_ref_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: src, to: dest });
      setPhotoUri(dest);
    }
  }

  async function handleSave() {
    if (!name.trim()) return Alert.alert(t('cropName'), '—');
    const days = Number(harvestDays);
    if (!harvestDays || isNaN(days) || days < 1) return Alert.alert(t('harvestDays'), '≥ 1');
    
    setSaving(true);
    try {
      await addPlant({
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
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
      <TouchableOpacity style={styles.photoWrap} onPress={pickPhoto}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : (
          <View style={styles.photoPlaceholder}><Text style={styles.photoEmoji}>📷</Text></View>
        )}
      </TouchableOpacity>

      <View style={styles.field}>
        <Text style={styles.label}>{t('cropName')} *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Томат" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('variety')}</Text>
        <TextInput style={styles.input} value={variety} onChangeText={setVariety} placeholder="Чері" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('harvestDays')} *</Text>
        <TextInput style={styles.input} value={harvestDays} onChangeText={setHarvestDays} keyboardType="numeric" placeholder="90" />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },
  photoWrap: { alignSelf: 'center', marginVertical: 16 },
  photo: { width: 120, height: 120, borderRadius: 18 },
  photoPlaceholder: { width: 120, height: 120, borderRadius: 18, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#a5d6a7', borderStyle: 'dashed' },
  photoEmoji: { fontSize: 34 },
  field: { marginHorizontal: 16, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, fontSize: 15, borderWidth: 1, borderColor: '#dde8e2' },
  saveBtn: { margin: 16, backgroundColor: '#2d6a4f', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
