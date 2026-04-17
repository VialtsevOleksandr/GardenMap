import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function WeatherScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🌦</Text>
      <Text style={styles.text}>{t('weather')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f7f4' },
  icon: { fontSize: 56, marginBottom: 12 },
  text: { fontSize: 16, color: '#888' },
});
