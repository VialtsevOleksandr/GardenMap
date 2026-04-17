import AsyncStorage from '@react-native-async-storage/async-storage';

const ARCHIVE_KEY = 'gardenmap_archive';
const DRY_DAYS_KEY = 'gardenmap_dry_days';

// ── Harvests (офлайн-кеш + вимога курсу "взаємодія з файлом") ──

export async function getLocalHarvests() {
  const raw = await AsyncStorage.getItem(ARCHIVE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function syncHarvestToLocal(harvest) {
  const list = await getLocalHarvests();
  const exists = list.findIndex(h => h.id === harvest.id);
  if (exists >= 0) {
    list[exists] = harvest;
  } else {
    list.unshift(harvest);
  }
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
}

export async function deleteLocalHarvest(id) {
  const list = await getLocalHarvests();
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(list.filter(h => h.id !== id)));
}

export async function clearLocalHarvests() {
  await AsyncStorage.removeItem(ARCHIVE_KEY);
}

// ── Dry days counter (лічильник днів без дощу) — per-plot ──

const plotDryDaysKey = (plotId) => `gardenmap_dry_days_${plotId}`;

export async function getPlotDryDays(plotId) {
  const raw = await AsyncStorage.getItem(plotDryDaysKey(plotId));
  return raw ? JSON.parse(raw) : { count: 0, lastRainAt: null, lastChecked: null };
}

export async function setPlotDryDays(plotId, data) {
  await AsyncStorage.setItem(plotDryDaysKey(plotId), JSON.stringify(data));
}

export async function resetPlotDryDays(plotId) {
  await AsyncStorage.setItem(plotDryDaysKey(plotId), JSON.stringify({
    count: 0,
    lastRainAt: new Date().toISOString(),
    lastChecked: new Date().toISOString(),
  }));
}

// ── Legacy app-wide dry days (kept for backward compat) ──

export async function getDryDays() {
  const raw = await AsyncStorage.getItem(DRY_DAYS_KEY);
  return raw ? JSON.parse(raw) : { count: 0, lastRainAt: null, lastChecked: null };
}

export async function setDryDays(data) {
  await AsyncStorage.setItem(DRY_DAYS_KEY, JSON.stringify(data));
}

export async function resetDryDays() {
  await AsyncStorage.setItem(DRY_DAYS_KEY, JSON.stringify({
    count: 0,
    lastRainAt: new Date().toISOString(),
    lastChecked: new Date().toISOString(),
  }));
}

// ── Weather location (місце для відстеження погоди/засухи) ──

const WEATHER_LOCATION_KEY = 'gardenmap_weather_location';

export async function getWeatherLocation() {
  const raw = await AsyncStorage.getItem(WEATHER_LOCATION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setWeatherLocation(location) {
  await AsyncStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(location));
}

export async function clearWeatherLocation() {
  await AsyncStorage.removeItem(WEATHER_LOCATION_KEY);
}
