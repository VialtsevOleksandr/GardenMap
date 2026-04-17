import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Platform, Keyboard, Dimensions, KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import { addPlot } from '../services/plotsService';

const MAX_POINTS = 20;


// Shoelace (Gauss) formula: GPS degrees → square meters
function calcArea(coords) {
  if (coords.length < 3) return 0;
  const D = 111320;
  let a = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = coords[i].longitude * D * Math.cos((coords[i].latitude * Math.PI) / 180);
    const yi = coords[i].latitude * D;
    const xj = coords[j].longitude * D * Math.cos((coords[j].latitude * Math.PI) / 180);
    const yj = coords[j].latitude * D;
    a += xi * yj - xj * yi;
  }
  return Math.abs(a / 2);
}

const DEFAULT_REGION = {
  latitude: 50.4501,
  longitude: 30.5234,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

export default function MapScreen({ navigation }) {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const debounceRef = useRef(null);

  const [points, setPoints]         = useState([]);
  const [plotName, setPlotName]     = useState('');
  const [cityQuery, setCityQuery]   = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  // hybrid = satellite + назви вулиць/міст (зручніше для орієнтування)
  const [mapType, setMapType] = useState('hybrid');

  useEffect(() => {
    navigation.setOptions({ title: t('mapTitle') });

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setIsKeyboardOpen(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardOpen(false);
    });

    return () => {
      clearTimeout(debounceRef.current);
      showSub.remove();
      hideSub.remove();
    };
  }, [navigation, t]);

  // ── Search with debounce ────────────────────────────────────────────────
  function handleCityChange(text) {
    setCityQuery(text);
    clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 500);
  }

  async function fetchSuggestions(text) {
    setLoadingSuggest(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1&countrycodes=ua`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'GardenMapApp/1.0' } });
      const data = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggest(false);
    }
  }

  function selectSuggestion(item) {
    Keyboard.dismiss();
    setCityQuery(item.display_name.split(',')[0]);
    setSuggestions([]);
    mapRef.current?.animateToRegion({
      latitude:      parseFloat(item.lat),
      longitude:     parseFloat(item.lon),
      latitudeDelta:  0.005,
      longitudeDelta: 0.005,
    }, 800);
  }

  // ── Map tap — fix: read coordinate immediately before event is nullified ─
  function handleMapPress(e) {
    Keyboard.dismiss();
    const coord = e?.nativeEvent?.coordinate;
    if (!coord) return;
    if (points.length >= MAX_POINTS) {
      Alert.alert(t('maxPointsReached', { max: MAX_POINTS }));
      return;
    }
    setPoints(prev => [...prev, { latitude: coord.latitude, longitude: coord.longitude }]);
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (points.length < 3) { Alert.alert(t('needMorePoints')); return; }
    if (!plotName.trim())  { Alert.alert(t('enterPlotName'));  return; }
    setSaving(true);
    try {
      await addPlot(plotName.trim(), points, Math.round(calcArea(points)));
      navigation.popToTop();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  const area    = calcArea(points);
  const canSave = points.length >= 3 && plotName.trim().length > 0;

  return (
    <KeyboardAvoidingView 
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <View style={styles.container}>
        {/* ── Search section (renders above map via elevation/zIndex) ───── */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchCity')}
            value={cityQuery}
            onChangeText={handleCityChange}
            returnKeyType="search"
            onSubmitEditing={() => fetchSuggestions(cityQuery)}
          />
          {loadingSuggest && (
            <ActivityIndicator color="#2d6a4f" size="small" style={styles.searchSpinner} />
          )}
        </View>

        {/* Dropdown suggestions */}
        {suggestions.length > 0 && (
          <ScrollView
            style={styles.dropdown}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {suggestions.map((item, i) => (
              <TouchableOpacity
                key={item.place_id ?? i}
                style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggestionDivider]}
                onPress={() => selectSuggestion(item)}
              >
                <Text style={styles.suggestionMain} numberOfLines={1}>
                  {item.display_name.split(',')[0]}
                </Text>
                <Text style={styles.suggestionSub} numberOfLines={1}>
                  {item.display_name.split(',').slice(1, 3).join(', ').trim()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Map mode toggle ────────────────────────────────────────────── */}
      <View style={styles.tileToggle}>
        {['hybrid', 'satellite', 'standard'].map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.tileBtn, mapType === mode && styles.tileBtnActive]}
            onPress={() => setMapType(mode)}
          >
            <Text style={[styles.tileTxt, mapType === mode && styles.tileTxtActive]}>
              {mode === 'hybrid' ? t('tileHybrid') : mode === 'satellite' ? t('tileSatellite') : t('tileMap')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={DEFAULT_REGION}
        onPress={handleMapPress}
      >

        {points.map((pt, i) => (
          <Marker
            key={i}
            coordinate={pt}
            anchor={{ x: 0.5, y: 0.5 }}
            draggable
            onDragEnd={(e) => {
              const c = e?.nativeEvent?.coordinate;
              if (!c) return;
              setPoints(prev =>
                prev.map((p, idx) =>
                  idx === i ? { latitude: c.latitude, longitude: c.longitude } : p
                )
              );
            }}
          >
            <View style={styles.pin}>
              <Text style={styles.pinNum}>{i + 1}</Text>
            </View>
          </Marker>
        ))}

        {points.length >= 3 && (
          <Polygon
            coordinates={points}
            fillColor="rgba(45,106,79,0.22)"
            strokeColor="#00e676"
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* ── Bottom panel ──────────────────────────────────────────────── */}
      <View style={[
        styles.panel,
        isKeyboardOpen && styles.panelCompact,
      ]}>
        {!isKeyboardOpen && (
          <>
            {/* Status line */}
            <View style={styles.statusRow}>
              {points.length === 0 ? (
                <Text style={styles.hint}>{t('tapToMark')}</Text>
              ) : (
                <>
                  <Text style={styles.counter}>
                    {t('pointsCount', { count: points.length, max: MAX_POINTS })}
                  </Text>
                  {points.length >= 3 && (
                    <Text style={styles.areaLabel}>
                      {t('areaM2', { area: Math.round(area) })}
                    </Text>
                  )}
                </>
              )}
            </View>

            {/* Undo / Clear */}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btnSec, !points.length && styles.btnSecOff]}
                onPress={() => setPoints(p => p.slice(0, -1))}
                disabled={!points.length}
              >
                <Text style={[styles.btnSecTxt, !points.length && styles.btnSecTxtOff]}>
                  {t('undoPoint')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSec, !points.length && styles.btnSecOff]}
                onPress={() =>
                  Alert.alert(t('clearAll'), t('clearConfirm'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('clearAll'), style: 'destructive', onPress: () => setPoints([]) },
                  ])
                }
                disabled={!points.length}
              >
                <Text style={[styles.btnSecTxt, !points.length && styles.btnSecTxtOff]}>
                  {t('clearAll')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isKeyboardOpen && (
          <View style={styles.compactMetaRow}>
            <Text style={styles.counter}>{t('pointsCount', { count: points.length, max: MAX_POINTS })}</Text>
            {points.length >= 3 && (
              <Text style={styles.areaLabel}>{t('areaM2', { area: Math.round(area) })}</Text>
            )}
          </View>
        )}

        {/* Plot name */}
        <TextInput
          style={styles.nameInput}
          placeholder={t('plotName')}
          placeholderTextColor="#7a7a7a"
          value={plotName}
          onChangeText={setPlotName}
        />

        {/* Save */}
        <TouchableOpacity
          style={[styles.btnSave, !canSave && styles.btnSaveOff]}
          onPress={handleSave}
          disabled={saving || !canSave}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnSaveTxt}>{t('savePlot')}</Text>}
        </TouchableOpacity>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  container: { flex: 1 },

  // Search floats over the map via elevation
  searchSection: {
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'transparent',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 7,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#1f1f1f',
    backgroundColor: '#fafafa',
  },
  searchSpinner: { marginLeft: 8 },

  dropdown: {
    backgroundColor: '#fff',
    maxHeight: 210,
    elevation: 50,
    zIndex: 50,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  suggestionMain: { fontSize: 14, color: '#222', fontWeight: '500' },
  suggestionSub:  { fontSize: 12, color: '#888', marginTop: 1 },

  tileToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tileBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  tileBtnActive: { backgroundColor: '#2d6a4f' },
  tileTxt:       { fontSize: 12, color: '#aaa' },
  tileTxtActive: { color: '#fff', fontWeight: 'bold' },

  map: { flex: 1 },

  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#00e676',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  pinNum: { fontSize: 11, fontWeight: 'bold', color: '#000' },

  panel: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 14,
    zIndex: 30,
    elevation: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  panelCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  compactMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 20,
  },
  hint:      { flex: 1, textAlign: 'center', color: '#999', fontSize: 13 },
  counter:   { color: '#2d6a4f', fontWeight: '600', fontSize: 13 },
  areaLabel: { color: '#555', fontSize: 13 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },

  btnSec: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#2d6a4f',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnSecOff:    { borderColor: '#e0e0e0' },
  btnSecTxt:    { color: '#2d6a4f', fontSize: 13, fontWeight: '600' },
  btnSecTxtOff: { color: '#ccc' },

  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#1f1f1f',
    marginBottom: 10,
    backgroundColor: '#fff',
  },

  btnSave: {
    backgroundColor: '#2d6a4f',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnSaveOff: { backgroundColor: '#c0c0c0' },
  btnSaveTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
