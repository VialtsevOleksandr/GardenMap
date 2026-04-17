import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { addPlot } from '../services/plotsService';

export default function ManualPlotScreen({ navigation }) {
  const { t } = useTranslation();
  const [name, setName]     = useState('');
  const [width, setWidth]   = useState('');
  const [length, setLength] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: t('manualPlotTitle') });
  }, []);

  const w    = parseFloat(width)  || 0;
  const l    = parseFloat(length) || 0;
  const area = w * l;

  const canSave = name.trim().length > 0 && w > 0 && l > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      // Для ручного вводу полігону немає — зберігаємо порожній масив
      await addPlot(name.trim(), [], Math.round(area), w, l);
      navigation.popToTop();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>{t('plotName')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('plotName')}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>{t('widthM')}</Text>
        <TextInput
          style={styles.input}
          placeholder="10"
          value={width}
          onChangeText={setWidth}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>{t('lengthM')}</Text>
        <TextInput
          style={styles.input}
          placeholder="20"
          value={length}
          onChangeText={setLength}
          keyboardType="decimal-pad"
        />

        {area > 0 && (
          <View style={styles.areaBox}>
            <Text style={styles.areaLabel}>{t('calcArea', { area: Math.round(area) })}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, !canSave && styles.btnOff]}
          onPress={handleSave}
          disabled={saving || !canSave}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnTxt}>{t('savePlot')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  areaBox: {
    marginTop: 22,
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  areaLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d6a4f',
  },
  btn: {
    marginTop: 28,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnOff: { backgroundColor: '#c0c0c0' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
