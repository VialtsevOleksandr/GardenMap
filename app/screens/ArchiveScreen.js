import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getLocalHarvests, deleteLocalHarvest, syncHarvestToLocal } from '../services/storageService';
import { deleteHarvest, updateHarvest } from '../services/harvestsService';

const GREEN      = '#2d6a4f';
const GREEN_DARK = '#1a3c2d';

const QUALITY_OPTIONS = ['excellent', 'good', 'average', 'poor'];
const QUALITY_EMOJI   = { excellent: '🌟', good: '👍', average: '😐', poor: '👎' };
const QUALITY_COLORS  = {
  excellent: { bg: '#e8f5e9', text: '#2e7d32' },
  good:      { bg: '#e8f5e9', text: '#388e3c' },
  average:   { bg: '#fff8e1', text: '#f57f17' },
  poor:      { bg: '#ffebee', text: '#c62828' },
};
const QUICK_KG = [0.5, 1, 2, 5];
const QUICK_L  = [5, 10, 12];

function harvestEmoji(unit) { return unit === 'L' ? '🪣' : '📦'; }

function parseDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

export default function ArchiveScreen() {
  const { t } = useTranslation();
  const [harvests,    setHarvests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [yearFilter,  setYearFilter]  = useState(null);
  const [cropFilter,  setCropFilter]  = useState(null);

  // Edit modal state
  const [editTarget, setEditTarget] = useState(null); // harvest object or null
  const [hYieldKg,   setHYieldKg]   = useState('');
  const [hUnit,      setHUnit]      = useState('kg');
  const [hQuality,   setHQuality]   = useState('good');
  const [hNotes,     setHNotes]     = useState('');
  const [saving,     setSaving]     = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setHarvests(await getLocalHarvests());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const data = await getLocalHarvests();
        if (active) setHarvests(data);
        setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  // ── Derived filter data ───────────────────────────────────────────────────
  const years = [...new Set(
    harvests.map(h => parseDate(h.harvestedAt)?.getFullYear()).filter(Boolean)
  )].sort((a, b) => b - a);

  const cropNames = [...new Set(
    harvests.map(h => h.cropName).filter(Boolean)
  )].sort();

  const filtered = harvests.filter(h => {
    const year = parseDate(h.harvestedAt)?.getFullYear();
    if (yearFilter && year !== yearFilter) return false;
    if (cropFilter && h.cropName !== cropFilter) return false;
    return true;
  });

  const totalKg = filtered.reduce((s, h) => s + (h.yieldKg || 0), 0);

  // ── Delete ────────────────────────────────────────────────────────────────
  function confirmDelete(h) {
    Alert.alert(t('delete'), `${h.cropName}?`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => doDelete(h) },
    ]);
  }

  async function doDelete(h) {
    try {
      await deleteHarvest(h.id); // Firestore + local
    } catch {
      // Offline: delete only from local cache
      await deleteLocalHarvest(h.id);
      Alert.alert('⚠️', 'Без інтернету видалено лише локально. Запис може повернутись після синхронізації.');
    }
    await reload();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(h) {
    setHYieldKg(String(h.yieldKg ?? ''));
    setHUnit(h.unit ?? 'kg');
    setHQuality(h.quality ?? 'good');
    setHNotes(h.notes ?? '');
    setEditTarget(h);
  }

  function closeEdit() { setEditTarget(null); setSaving(false); }

  async function saveEdit() {
    if (!editTarget) return;
    const updates = { yieldKg: parseFloat(hYieldKg) || 0, unit: hUnit, quality: hQuality, notes: hNotes };
    setSaving(true);
    try {
      await updateHarvest(editTarget.id, updates); // Firestore + local
    } catch {
      // Offline: update only in local cache
      await syncHarvestToLocal({ ...editTarget, ...updates });
      Alert.alert('⚠️', 'Без інтернету збережено лише локально. Синхронізується при наступному підключенні.');
    }
    closeEdit();
    await reload();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Year filter */}
        {years.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.filterLabel}>{t('filterByYear')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {years.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.chip, yearFilter === y && styles.chipActive]}
                  onPress={() => setYearFilter(yearFilter === y ? null : y)}
                >
                  <Text style={[styles.chipText, yearFilter === y && styles.chipTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Crop filter */}
        {cropNames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.filterLabel}>{t('filterByCrop')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {cropNames.map(name => (
                <TouchableOpacity
                  key={name}
                  style={[styles.chip, cropFilter === name && styles.chipActive]}
                  onPress={() => setCropFilter(cropFilter === name ? null : name)}
                >
                  <Text style={[styles.chipText, cropFilter === name && styles.chipTextActive]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reset + summary */}
        {(yearFilter || cropFilter) && (
          <View style={styles.resetRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={() => { setYearFilter(null); setCropFilter(null); }}>
              <Text style={styles.resetText}>✕ {t('resetFilters')}</Text>
            </TouchableOpacity>
            <Text style={styles.summaryText}>
              {filtered.length} зап. · {totalKg % 1 === 0 ? totalKg : totalKg.toFixed(1)} {t('unitKg')}
            </Text>
          </View>
        )}

        {/* List */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} size="large" color={GREEN} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              {harvests.length === 0 ? t('noHarvestRecorded') : t('noResults')}
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            {filtered.map((h, i) => {
              const date = parseDate(h.harvestedAt);
              const dateStr = date
                ? date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
              const unitLabel = h.unit === 'L' ? t('unitLiters') : t('unitKg');
              const qColors   = QUALITY_COLORS[h.quality] ?? { bg: '#f4f4f4', text: '#888' };
              return (
                <View key={h.id ?? i} style={styles.card}>
                  {/* Top row: name + date + actions */}
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName} numberOfLines={1}>{h.cropName || '—'}</Text>
                    <View style={styles.cardTopRight}>
                      <Text style={styles.cardDate}>{dateStr}</Text>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(h)}>
                        <Text style={styles.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(h)}>
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Bottom row: yield + quality */}
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardYield}>
                      {harvestEmoji(h.unit)} {h.yieldKg != null
                        ? `${h.yieldKg % 1 === 0 ? h.yieldKg : Number(h.yieldKg).toFixed(1)} ${unitLabel}`
                        : '—'}
                    </Text>
                    {h.quality && (
                      <View style={[styles.qualityBadge, { backgroundColor: qColors.bg }]}>
                        <Text style={[styles.qualityText, { color: qColors.text }]}>
                          {QUALITY_EMOJI[h.quality]} {t(h.quality)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {!!h.notes && (
                    <Text style={styles.cardNotes} numberOfLines={2}>{h.notes}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Edit modal */}
      <Modal
        visible={!!editTarget}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('editHarvestRecord')}</Text>
            <Text style={styles.modalSubtitle}>{editTarget?.cropName}</Text>

            {/* Unit toggle */}
            <Text style={styles.fieldLabel}>{t('yieldKg')}</Text>
            <View style={styles.unitToggle}>
              <TouchableOpacity
                style={[styles.unitBtn, hUnit === 'kg' && styles.unitBtnActive]}
                onPress={() => setHUnit('kg')}
              >
                <Text style={[styles.unitBtnText, hUnit === 'kg' && styles.unitBtnTextActive]}>
                  ⚖️ {t('unitToggleKg')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitBtn, hUnit === 'L' && styles.unitBtnActive]}
                onPress={() => setHUnit('L')}
              >
                <Text style={[styles.unitBtnText, hUnit === 'L' && styles.unitBtnTextActive]}>
                  🪣 {t('unitToggleLiters')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Yield input */}
            <TextInput
              style={styles.yieldInput}
              value={hYieldKg}
              onChangeText={setHYieldKg}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor="#bbb"
            />

            {/* Quick-fill */}
            <View style={styles.quickRow}>
              {(hUnit === 'kg' ? QUICK_KG : QUICK_L).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.quickBtn, hYieldKg === String(v) && styles.quickBtnActive]}
                  onPress={() => setHYieldKg(String(v))}
                >
                  <Text style={[styles.quickBtnText, hYieldKg === String(v) && styles.quickBtnTextActive]}>
                    {v} {hUnit === 'kg' ? t('unitKg') : t('unitLiters')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quality */}
            <Text style={styles.fieldLabel}>{t('quality')}</Text>
            <View style={styles.qualityRow}>
              {QUALITY_OPTIONS.map(q => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityBtn, hQuality === q && styles.qualityBtnActive]}
                  onPress={() => setHQuality(q)}
                >
                  <Text style={styles.qualityEmoji}>{QUALITY_EMOJI[q]}</Text>
                  <Text style={[styles.qualityBtnText, hQuality === q && styles.qualityBtnTextActive]}>
                    {t(q)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>{t('notes')}</Text>
            <TextInput
              style={styles.notesInput}
              value={hNotes}
              onChangeText={setHNotes}
              multiline
              numberOfLines={3}
              placeholder="..."
              placeholderTextColor="#bbb"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>{t('save')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeEdit}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f7f4' },

  section:     { marginTop: 12, paddingHorizontal: 16 },
  filterLabel: {
    fontSize: 11, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5,
  },
  chipsRow:       { gap: 8, paddingBottom: 4 },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d0e8d8' },
  chipActive:     { backgroundColor: GREEN, borderColor: GREEN },
  chipText:       { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  resetRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 10 },
  resetBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ef9a9a' },
  resetText:   { fontSize: 12, color: '#c62828', fontWeight: '700' },
  summaryText: { fontSize: 12, color: '#888', fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 44, marginBottom: 14 },
  emptyText:  { fontSize: 15, color: '#aaa', textAlign: 'center' },

  listSection: { marginHorizontal: 16, marginTop: 14, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  cardTop:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardName:       { fontSize: 16, fontWeight: '700', color: GREEN_DARK, flex: 1, marginRight: 8 },
  cardTopRight:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDate:       { fontSize: 12, color: '#999', marginRight: 2 },
  editBtn:        { width: 28, height: 28, borderRadius: 8, backgroundColor: '#f0f7f4', alignItems: 'center', justifyContent: 'center' },
  editBtnText:    { fontSize: 13 },
  deleteBtn:      { width: 28, height: 28, borderRadius: 8, backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText:  { fontSize: 13, color: '#ef5350', fontWeight: '700' },

  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardYield:  { fontSize: 14, fontWeight: '600', color: '#333', flex: 1 },
  qualityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qualityText:  { fontSize: 12, fontWeight: '700' },
  cardNotes: {
    fontSize: 12, color: '#999', fontStyle: 'italic',
    marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 8,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44,
  },
  modalHandle:   { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: GREEN_DARK, textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 16 },
  fieldLabel:    { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 4 },

  unitToggle:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  unitBtn:          { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f4f4f4', alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0' },
  unitBtnActive:    { backgroundColor: '#e8f5e9', borderColor: GREEN },
  unitBtnText:      { fontSize: 13, color: '#888', fontWeight: '600' },
  unitBtnTextActive:{ color: GREEN_DARK },

  yieldInput: {
    backgroundColor: '#f4f4f4', borderRadius: 12, padding: 14,
    fontSize: 18, fontWeight: '700', color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 12, textAlign: 'center',
  },
  quickRow:         { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
  quickBtn:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f4f4f4', borderWidth: 1.5, borderColor: '#e0e0e0' },
  quickBtnActive:   { backgroundColor: '#e8f5e9', borderColor: GREEN },
  quickBtnText:     { fontSize: 13, color: '#777', fontWeight: '600' },
  quickBtnTextActive:{ color: GREEN_DARK },

  qualityRow:          { flexDirection: 'row', gap: 8, marginBottom: 16 },
  qualityBtn:          { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f4f4f4', alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0' },
  qualityBtnActive:    { backgroundColor: '#e8f5e9', borderColor: GREEN },
  qualityEmoji:        { fontSize: 18, marginBottom: 3 },
  qualityBtnText:      { fontSize: 11, color: '#888', fontWeight: '600' },
  qualityBtnTextActive:{ color: GREEN_DARK },

  notesInput: {
    backgroundColor: '#f4f4f4', borderRadius: 12, padding: 12,
    fontSize: 14, color: '#1a1a1a', borderWidth: 1, borderColor: '#e0e0e0',
    marginBottom: 20, minHeight: 80, textAlignVertical: 'top',
  },
  saveBtn:     { backgroundColor: GREEN, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10, elevation: 2 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn:   { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:{ color: '#999', fontSize: 15 },
});
