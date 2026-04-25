import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import { db } from './firebase';
import { getHarvestsForCrop, deleteHarvest } from './harvestsService';

const COL = 'crops';

export async function getCrops(bedId) {
  const q = query(collection(db, COL), where('bedId', '==', bedId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllCropsForPlot(plotId) {
  const q = query(collection(db, COL), where('plotId', '==', plotId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveCropsForPlot(plotId) {
  const q = query(collection(db, COL), where('plotId', '==', plotId), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCrop({ bedId, plotId, plantId, name, variety, varietyId, photoUri, icon, harvestDays, notes }) {
  const ref = await addDoc(collection(db, COL), {
    bedId,
    plotId,
    plantId: plantId || null,
    name,
    variety: variety || '',
    varietyId: varietyId || null,
    photoUri: photoUri || null,
    icon: icon || null,
    plantedAt: serverTimestamp(),
    harvestDays: Number(harvestDays),
    notes: notes || '',
    isActive: true,
    lastWateredAt: null,
  });
  return ref.id;
}

export async function updateCrop(id, updates) {
  await updateDoc(doc(db, COL, id), updates);
}

export async function markWatered(id) {
  await updateDoc(doc(db, COL, id), { lastWateredAt: serverTimestamp() });
}

export async function deactivateCrop(id) {
  await updateDoc(doc(db, COL, id), { isActive: false });
}

// Cascade: deletes all harvests for this crop, then the crop document,
// then the local photo file on disk (if any).
export async function deleteCrop(id, photoUri = null) {
  const harvests = await getHarvestsForCrop(id);
  await Promise.all(harvests.map(h => deleteHarvest(h.id)));
  await deleteDoc(doc(db, COL, id));
  if (photoUri?.startsWith('file://')) {
    try { await FileSystem.deleteAsync(photoUri); } catch (_) {}
  }
}
