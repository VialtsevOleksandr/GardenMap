import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCrops, deleteCrop, deactivateCrop, markWatered } from '../services/cropsService';
import { addHarvest, updateHarvest, deleteHarvest, getHarvestsForBed } from '../services/harvestsService';
import { getRotationAdvice, getNextCropSuggestions } from '../services/rotationRules';
import { getCatalogPlants } from '../services/plantsCatalog';
import { resolveVariety } from '../services/varietiesCatalog';
import CropCard from '../components/CropCard';
import PlantIcon from '../components/PlantIcon';
import { sanitizeDecimal } from '../utils/inputSanitizers';

const QUALITY_OPTIONS = ['excellent', 'good', 'average', 'poor'];
const QUALITY_EMOJI   = { excellent: '🌟', good: '👍', average: '😐', poor: '👎' };

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString();
}

export default function BedDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { bed, plotId } = route.params;

  const [crops, setCrops]             = useState([]);
  const [harvestMap, setHarvestMap]   = useState({}); // { [cropId]: harvest[] }
  const [loading, setLoading]         = useState(true);
  const [justWateredIds, setJustWateredIds] = useState(new Set());
  const [expandedId, setExpandedId]   = useState(null);

  // ── Harvest modal state ──────────────────────────────────────────────────────
  // null = closed  |  { crop, isFinal, editHarvest: harvest|null }
  const [harvestModal, setHarvestModal] = useState(null);
  const [hYieldKg,  setHYieldKg]  = useState('');
  const [hUnit,     setHUnit]     = useState('kg'); // 'kg' | 'L'
  const [hQuality,  setHQuality]  = useState('good');
  const [hNotes,    setHNotes]    = useState('');
  const [hSaving,   setHSaving]   = useState(false);

  const QUICK_KG = [0.5, 1, 2, 5];
  const QUICK_L  = [5, 10, 12];

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cropsData, harvestsData] = await Promise.all([
        getCrops(bed.id),
        getHarvestsForBed(bed.id),
      ]);
      cropsData.sort((a, b) => (a.plantedAt?.seconds ?? 0) - (b.plantedAt?.seconds ?? 0));
      setCrops(cropsData);

      const map = {};
      harvestsData.forEach(h => {
        if (!map[h.cropId]) map[h.cropId] = [];
        map[h.cropId].push(h);
      });
      setHarvestMap(map);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [bed.id]);

  useEffect(() => {
    navigation.setOptions({ title: bed.label });
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, bed, load]);

  // ── Watering ─────────────────────────────────────────────────────────────────
  async function handleWater(crop) {
    try {
      await markWatered(crop.id);
      setCrops(prev => prev.map(c =>
        c.id === crop.id ? { ...c, lastWateredAt: { toDate: () => new Date() } } : c
      ));
      setJustWateredIds(prev => new Set([...prev, crop.id]));
      setTimeout(() => {
        setJustWateredIds(prev => { const n = new Set(prev); n.delete(crop.id); return n; });
      }, 3000);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ── Delete harvest record ─────────────────────────────────────────────────────
  async function handleDeleteHarvest(harvest) {
    Alert.alert(t('delete'), t('deleteHarvestConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteHarvest(harvest.id);
          load();
        },
      },
    ]);
  }

  // ── Delete crop ───────────────────────────────────────────────────────────────
  async function handleDeleteCrop(crop) {
    Alert.alert(t('delete'), `${crop.name}?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteCrop(crop.id, crop.photoUri);
          load();
        },
      },
    ]);
  }

  // ── Harvest modal helpers ────────────────────────────────────────────────────
  function openHarvestModal(crop, isFinal, editHarvest = null) {
    setHYieldKg(editHarvest ? String(editHarvest.yieldKg ?? '') : '');
    setHUnit(editHarvest?.unit ?? 'kg');
    setHQuality(editHarvest?.quality ?? 'good');
    setHNotes(editHarvest?.notes ?? '');
    setHarvestModal({ crop, isFinal, editHarvest });
  }

  function closeHarvestModal() {
    setHarvestModal(null);
    setHSaving(false);
  }

  async function saveHarvest() {
    if (!harvestModal) return;
    const { crop, isFinal, editHarvest } = harvestModal;
    const yieldNum = parseFloat(hYieldKg);
    if (!(yieldNum > 0)) {
      Alert.alert(t('yieldKg'), '> 0');
      return;
    }
    setHSaving(true);
    try {
      if (editHarvest) {
        await updateHarvest(editHarvest.id, { yieldKg: yieldNum, quality: hQuality, notes: hNotes });
      } else {
        await addHarvest({ cropId: crop.id, bedId: bed.id, plotId, cropName: crop.name, yieldKg: yieldNum, quality: hQuality, notes: hNotes, unit: hUnit });
      }
      if (isFinal && crop.isActive) {
        await deactivateCrop(crop.id);
      }
      closeHarvestModal();
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setHSaving(false);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────────
  const activeCrops = crops.filter(c => c.isActive);
  const pastCrops   = crops.filter(c => !c.isActive).slice().reverse();

  const cropIds     = crops.map(c => c.plantId).filter(Boolean);
  const advice      = getRotationAdvice(cropIds);
  const suggestions = getNextCropSuggestions(cropIds);

  // Translate reasonParams: { cropKey, prevKey } → { crop, prev } for i18n
  function resolveAdviceParams(params) {
    if (!params) return {};
    const resolved = {};
    if (params.cropKey) resolved.crop = t(params.cropKey);
    if (params.prevKey) resolved.prev = t(params.prevKey);
    if (params.crop && !params.cropKey) resolved.crop = params.crop;
    if (params.prev && !params.prevKey) resolved.prev = params.prev;
    return resolved;
  }

  const adviceBg         = { good: '#e8f5e9', ok: '#fffde7', bad: '#ffebee' }[advice.status] ?? '#f5f5f5';
  const adviceIcon       = { good: '✅', ok: 'ℹ️', bad: '⚠️' }[advice.status];
  const adviceBadgeColor = { good: '#2e7d32', ok: '#f57f17', bad: '#c62828' }[advice.status];
  const adviceKey        = `rotation${advice.status.charAt(0).toUpperCase()}${advice.status.slice(1)}`;

  const bedArea = ((bed.widthM ?? 1) * (bed.heightM ?? 1)).toFixed(1);

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Bed info header */}
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>{bed.label}</Text>
            <Text style={styles.headerDims}>
              {bed.widthM ?? 1} × {bed.heightM ?? 1} м · {bedArea} м²
            </Text>
          </View>
          <Text style={styles.headerIcon}>🟫</Text>
        </View>

        {/* Rotation card */}
        {crops.length > 0 && (
          <View style={[styles.rotationCard, { borderLeftColor: adviceBadgeColor }]}>
            <View style={styles.rotationTitleRow}>
              <Text style={styles.rotationTitle}>🌾 {t('cropHistory')}</Text>
              <View style={[styles.statusBadge, { backgroundColor: adviceBg }]}>
                <Text style={[styles.statusBadgeText, { color: adviceBadgeColor }]}>
                  {adviceIcon} {t(adviceKey)}
                </Text>
              </View>
            </View>
            <Text style={styles.rotationReason}>
              {t(advice.reasonKey, resolveAdviceParams(advice.reasonParams))}
            </Text>

            <View style={styles.divider} />
            <Text style={styles.nextTitle}>🌱 {t('rotation.nextSeasonTitle')}</Text>

            {suggestions.recommended.length > 0 ? (
              <>
                <Text style={styles.chipGroupLabel}>
                  {t('rotation.recommend', { crop: suggestions.lastCropId ? t(`plantName.${suggestions.lastCropId}`) : '' })}
                </Text>
                <View style={styles.chipsRow}>
                  {suggestions.recommended.map(id => (
                    <View key={id} style={styles.chipGood}>
                      <Text style={styles.chipGoodText}>{t(`plantName.${id}`)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.noSuggestionsText}>{t('rotation.noSuggestions')}</Text>
            )}

            {suggestions.avoid.length > 0 && (
              <>
                <Text style={[styles.chipGroupLabel, styles.chipGroupLabelBad]}>
                  {t('rotation.avoidLabel', { crop: suggestions.lastCropId ? t(`plantName.${suggestions.lastCropId}`) : '' })}
                </Text>
                <View style={styles.chipsRow}>
                  {suggestions.avoid.map(id => (
                    <View key={id} style={styles.chipBad}>
                      <Text style={styles.chipBadText}>{t(`plantName.${id}`)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Active crops */}
        <Text style={styles.sectionTitle}>🌿 {t('crop')}</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#2d6a4f" />
        ) : activeCrops.length === 0 ? (
          <Text style={styles.emptyText}>{t('noCrops')}</Text>
        ) : (
          activeCrops.map(c => {
            const cropHarvests = harvestMap[c.id] ?? [];
            const isExp = expandedId === c.id;
            return (
              <CropCard
                key={c.id}
                crop={c}
                onRecordHarvest={crop => openHarvestModal(crop, false)}
                onFinalHarvest={crop => openHarvestModal(crop, true)}
                onDelete={handleDeleteCrop}
                onWater={handleWater}
                justWatered={justWateredIds.has(c.id)}
                harvests={cropHarvests}
                isExpanded={isExp}
                onToggleExpand={() => setExpandedId(isExp ? null : c.id)}
                onEditHarvest={h => openHarvestModal(c, false, h)}
                onDeleteHarvest={handleDeleteHarvest}
              />
            );
          })
        )}

        {/* Past crops */}
        {pastCrops.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
              📦 {t('cropHistory')}
            </Text>
            {pastCrops.map(c => {
              const harvests    = harvestMap[c.id] ?? [];
              const totalAmount = harvests.reduce((s, h) => s + (h.yieldKg || 0), 0);
              const latest      = harvests[0] ?? null;
              const unitLabel   = latest?.unit === 'L' ? t('unitLiters') : t('unitKg');
              const isExp       = expandedId === c.id;

              return (
                <View key={c.id} style={styles.pastCard}>
                  {/* Delete top-right */}
                  <TouchableOpacity style={styles.pastDeleteBtn} onPress={() => handleDeleteCrop(c)}>
                    <Text style={styles.pastDeleteBtnText}>✕</Text>
                  </TouchableOpacity>

                  {/* Tappable header — toggles expansion */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setExpandedId(isExp ? null : c.id)}
                  >
                    {/* Crop info row */}
                    <View style={styles.pastTopRow}>
                      <View style={styles.pastIconWrap}>
                        <PlantIcon
                          plantId={c.plantId}
                          name={c.name}
                          icon={c.icon}
                          size={24}
                          textStyle={styles.pastIcon}
                        />
                      </View>
                      <View style={styles.pastInfo}>
                        <Text style={styles.pastName}>
                          {c.name}{resolveVariety(c, t) ? ` (${resolveVariety(c, t)})` : ''}
                        </Text>
                        <Text style={styles.pastDate}>
                          {t('planted', { date: formatDate(c.plantedAt) })}
                        </Text>
                      </View>
                      <Text style={styles.pastExpandArrow}>{isExp ? '▲' : '▼'}</Text>
                    </View>

                    {/* Harvest summary row */}
                    <View style={styles.pastHarvestRow}>
                      {totalAmount > 0 ? (
                        <Text style={styles.pastYield}>
                          {latest?.unit === 'L' ? '🪣' : '📦'} {t('totalYieldKg', { amount: `${totalAmount % 1 === 0 ? totalAmount : totalAmount.toFixed(1)} ${unitLabel}` })}
                          {latest?.quality ? `  ·  ${QUALITY_EMOJI[latest.quality]} ${t(latest.quality)}` : ''}
                        </Text>
                      ) : (
                        <Text style={styles.pastNoYield}>{t('noHarvestRecorded')}</Text>
                      )}
                      <Text style={styles.pastEntriesHint}>
                        {harvests.length} {t('harvestEntriesShort')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded: full list of harvest records */}
                  {isExp && (
                    <View style={styles.pastExpandedList}>
                      {harvests.length === 0 ? (
                        <Text style={styles.pastNoYield}>{t('noHarvestRecorded')}</Text>
                      ) : (
                        harvests.map(h => {
                          const hUnit = h.unit === 'L' ? t('unitLiters') : t('unitKg');
                          const hAmt  = h.yieldKg != null
                            ? `${h.yieldKg % 1 === 0 ? h.yieldKg : Number(h.yieldKg).toFixed(1)} ${hUnit}`
                            : '—';
                          return (
                            <View key={h.id} style={styles.pastHarvestEntry}>
                              <View style={styles.pastHarvestEntryInfo}>
                                <Text style={styles.pastHarvestEntryDate}>
                                  {formatDate(h.harvestedAt)}
                                </Text>
                                <Text style={styles.pastHarvestEntryAmount}>{h.unit === 'L' ? '🪣' : '📦'} {hAmt}</Text>
                                {h.quality ? (
                                  <Text style={styles.pastHarvestEntryQuality}>
                                    {QUALITY_EMOJI[h.quality]} {t(h.quality)}
                                  </Text>
                                ) : null}
                                {!!h.notes && (
                                  <Text style={styles.pastHarvestEntryNotes} numberOfLines={1}>
                                    {h.notes}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.pastHarvestEntryBtns}>
                                <TouchableOpacity
                                  style={styles.pastEntryIconBtn}
                                  onPress={() => openHarvestModal(c, false, h)}
                                >
                                  <Text style={styles.pastEntryEditIcon}>✏️</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.pastEntryIconBtn, styles.pastEntryDeleteBtn]}
                                  onPress={() => handleDeleteHarvest(h)}
                                >
                                  <Text style={styles.pastEntryDeleteIcon}>🗑️</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}
                      {/* Add new harvest record for this past crop */}
                      <TouchableOpacity
                        style={styles.pastAddHarvestBtn}
                        onPress={() => openHarvestModal(c, false, null)}
                      >
                        <Text style={styles.pastAddHarvestBtnText}>+ {t('recordHarvest')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* FAB — hidden when bed already has an active crop */}
      {activeCrops.length === 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddCrop', { bedId: bed.id, plotId })}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Harvest modal */}
      <Modal
        visible={!!harvestModal}
        transparent
        animationType="slide"
        onRequestClose={closeHarvestModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.modalSheet}
            contentContainerStyle={{ paddingBottom: 44 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              {harvestModal?.isFinal ? t('finalHarvestTitle') : t('harvestModalTitle')}
            </Text>
            <Text style={styles.modalSubtitle}>{harvestModal?.crop?.name}</Text>

            {harvestModal?.isFinal && (
              <View style={styles.finalHint}>
                <Text style={styles.finalHintText}>🌱 {t('finalHarvestHint')}</Text>
              </View>
            )}

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
              onChangeText={v => setHYieldKg(sanitizeDecimal(v))}
              keyboardType="decimal-pad"
              placeholder={hUnit === 'kg' ? '0.5' : '1'}
              placeholderTextColor="#bbb"
            />

            {/* Quick-fill buttons */}
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

            {/* Quality picker */}
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

            {/* Notes input */}
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
              style={[styles.saveBtn, hSaving && { opacity: 0.6 }]}
              onPress={saveHarvest}
              disabled={hSaving}
            >
              {hSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>{t('save')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelSheetBtn} onPress={closeHarvestModal}>
              <Text style={styles.cancelSheetText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const GREEN      = '#2d6a4f';
const GREEN_DARK = '#1a3c2d';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f7f4' },

  // Header card
  headerCard: {
    margin: 12, marginBottom: 8,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  headerLeft:  { flex: 1 },
  headerLabel: { fontSize: 22, fontWeight: '800', color: GREEN_DARK },
  headerDims:  { fontSize: 13, color: '#888', marginTop: 4 },
  headerIcon:  { fontSize: 40, marginLeft: 12 },

  // Rotation card
  rotationCard: {
    margin: 12, marginTop: 4,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    borderLeftWidth: 4,
  },
  rotationTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  rotationTitle:    { fontSize: 15, fontWeight: '700', color: GREEN_DARK },
  statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText:  { fontSize: 12, fontWeight: '700' },
  rotationReason:   { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 4 },
  divider:          { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  nextTitle:        { fontSize: 14, fontWeight: '700', color: GREEN_DARK, marginBottom: 8 },
  chipGroupLabel:   { fontSize: 12, color: '#2e7d32', fontWeight: '600', marginBottom: 6, marginTop: 4 },
  chipGroupLabelBad:{ color: '#c62828', marginTop: 10 },
  chipsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chipGood: {
    backgroundColor: '#e8f5e9', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#a5d6a7',
  },
  chipGoodText:       { fontSize: 13, color: '#1b5e20', fontWeight: '600' },
  chipBad: {
    backgroundColor: '#ffebee', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#ef9a9a',
  },
  chipBadText:        { fontSize: 13, color: '#b71c1c', fontWeight: '600' },
  noSuggestionsText:  { fontSize: 13, color: '#aaa', fontStyle: 'italic' },

  // Section
  sectionTitle: {
    fontSize: 17, fontWeight: '700', color: GREEN_DARK,
    marginHorizontal: 12, marginTop: 8, marginBottom: 8,
  },
  emptyText: { textAlign: 'center', marginVertical: 36, fontSize: 15, color: '#aaa' },

  // Past crop card
  pastCard: {
    marginHorizontal: 12, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  pastDeleteBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  pastDeleteBtnText: { fontSize: 14, color: '#ef5350', lineHeight: 18 },
  pastTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 30, marginBottom: 10 },
  pastIconWrap: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#f5ede0', alignItems: 'center', justifyContent: 'center',
  },
  pastIcon:   { fontSize: 22 },
  pastInfo:   { flex: 1 },
  pastName:   { fontSize: 15, fontWeight: '700', color: GREEN_DARK },
  pastDate:   { fontSize: 12, color: '#999', marginTop: 3 },
  pastHarvestRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  pastExpandArrow:  { fontSize: 13, color: '#bbb', marginLeft: 4 },
  pastYield:        { fontSize: 13, color: '#555', fontWeight: '500', flex: 1 },
  pastNoYield:      { fontSize: 13, color: '#bbb', fontStyle: 'italic', flex: 1 },
  pastEntriesHint:  { fontSize: 12, color: '#bbb' },

  // Expanded harvest list inside past crop card
  pastExpandedList: {
    marginTop: 10,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    paddingTop: 8, gap: 0,
  },
  pastHarvestEntry: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 8,
  },
  pastHarvestEntryInfo:    { flex: 1, gap: 3 },
  pastHarvestEntryDate:    { fontSize: 12, color: '#999' },
  pastHarvestEntryAmount:  { fontSize: 13, fontWeight: '700', color: '#1a3c2d' },
  pastHarvestEntryQuality: { fontSize: 12, color: '#555' },
  pastHarvestEntryNotes:   { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  pastHarvestEntryBtns:    { flexDirection: 'row', gap: 4 },
  pastEntryIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  pastEntryDeleteBtn:   { backgroundColor: '#ffebee' },
  pastEntryEditIcon:    { fontSize: 15 },
  pastEntryDeleteIcon:  { fontSize: 15 },
  pastAddHarvestBtn: {
    marginTop: 10, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#f0f7f4', alignItems: 'center',
    borderWidth: 1, borderColor: '#a5d6a7', borderStyle: 'dashed',
  },
  pastAddHarvestBtnText: { fontSize: 13, color: GREEN, fontWeight: '600' },

  pastEditBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#f0f7f4',
    borderWidth: 1, borderColor: '#a5d6a7',
  },
  pastEditBtnText: { fontSize: 12, color: GREEN, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  fabText: { fontSize: 32, color: '#fff', lineHeight: 36 },

  // Harvest modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#ddd',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: GREEN_DARK, textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 16 },

  finalHint: {
    backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#a5d6a7',
  },
  finalHintText: { fontSize: 13, color: '#2e7d32', textAlign: 'center' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 4 },

  yieldInput: {
    backgroundColor: '#f4f4f4', borderRadius: 12, padding: 14,
    fontSize: 18, fontWeight: '700', color: '#1a1a1a',
    borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 16,
    textAlign: 'center',
  },

  qualityRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  qualityBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#f4f4f4', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e0e0e0',
  },
  qualityBtnActive: { backgroundColor: '#e8f5e9', borderColor: GREEN },
  qualityEmoji:   { fontSize: 18, marginBottom: 3 },
  qualityBtnText: { fontSize: 11, color: '#888', fontWeight: '600' },
  qualityBtnTextActive: { color: GREEN_DARK },

  notesInput: {
    backgroundColor: '#f4f4f4', borderRadius: 12, padding: 12,
    fontSize: 14, color: '#1a1a1a', borderWidth: 1, borderColor: '#e0e0e0',
    marginBottom: 20, minHeight: 80, textAlignVertical: 'top',
  },

  // Unit toggle
  unitToggle: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  unitBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#f4f4f4', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e0e0e0',
  },
  unitBtnActive:     { backgroundColor: '#e8f5e9', borderColor: GREEN },
  unitBtnText:       { fontSize: 13, color: '#888', fontWeight: '600' },
  unitBtnTextActive: { color: GREEN_DARK },

  // Quick-fill buttons
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
  quickBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f4f4f4', borderWidth: 1.5, borderColor: '#e0e0e0',
  },
  quickBtnActive:     { backgroundColor: '#e8f5e9', borderColor: GREEN },
  quickBtnText:       { fontSize: 13, color: '#777', fontWeight: '600' },
  quickBtnTextActive: { color: GREEN_DARK },

  saveBtn: {
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, elevation: 2,
  },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelSheetBtn:  { paddingVertical: 12, alignItems: 'center' },
  cancelSheetText: { color: '#999', fontSize: 15 },
});
