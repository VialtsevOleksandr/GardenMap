import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function AddPlotChoiceScreen({ navigation }) {
  const { t } = useTranslation();

  useEffect(() => {
    navigation.setOptions({ title: t('addPlot') });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('choiceTitle')}</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Map')}
        activeOpacity={0.85}
      >
        <Text style={styles.cardIcon}>🗺️</Text>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{t('addByMap')}</Text>
          <Text style={styles.cardDesc}>{t('addByMapDesc')}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ManualPlot')}
        activeOpacity={0.85}
      >
        <Text style={styles.cardIcon}>📏</Text>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{t('addManual')}</Text>
          <Text style={styles.cardDesc}>{t('addManualDesc')}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 15,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardIcon: { fontSize: 36, marginRight: 16 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#777', lineHeight: 18 },
  arrow: { fontSize: 26, color: '#bbb', marginLeft: 8 },
});
