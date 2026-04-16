import AsyncStorage from '@react-native-async-storage/async-storage';

const ARCHIVE_KEY = 'gardenmap_archive';
const DRY_DAYS_KEY = 'gardenmap_dry_days';

export async function getArchive() {
  const raw = await AsyncStorage.getItem(ARCHIVE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addHarvest(harvest) {
  const archive = await getArchive();
  archive.push({ ...harvest, id: Date.now().toString() });
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
}

export async function updateHarvest(id, updates) {
  const archive = await getArchive();
  const updated = archive.map(h => h.id === id ? { ...h, ...updates } : h);
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
}

export async function deleteHarvest(id) {
  const archive = await getArchive();
  const filtered = archive.filter(h => h.id !== id);
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(filtered));
}

export async function getDryDays() {
  const raw = await AsyncStorage.getItem(DRY_DAYS_KEY);
  return raw ? JSON.parse(raw) : { count: 0, lastChecked: null };
}

export async function setDryDays(data) {
  await AsyncStorage.setItem(DRY_DAYS_KEY, JSON.stringify(data));
}
