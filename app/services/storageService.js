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

// ── Dry days counter (лічильник днів без дощу) ──

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
