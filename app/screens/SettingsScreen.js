import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings')}</Text>
      <Text style={styles.label}>{t('language')}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, i18n.language === 'uk' && styles.btnActive]}
          onPress={() => i18n.changeLanguage('uk')}
        >
          <Text style={styles.btnText}>{t('ukrainian')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, i18n.language === 'en' && styles.btnActive]}
          onPress={() => i18n.changeLanguage('en')}
        >
          <Text style={styles.btnText}>{t('english')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2d6a4f', marginBottom: 30 },
  label: { fontSize: 16, color: '#555', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#ddd' },
  btnActive: { backgroundColor: '#2d6a4f' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
