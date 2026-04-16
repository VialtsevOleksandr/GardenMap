import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { syncHarvestToLocal } from './storageService';

const COL = 'harvests';

export async function addHarvest({ cropId, bedId, plotId, yieldKg, quality, notes }) {
  const data = {
    cropId,
    bedId,
    plotId,
    harvestedAt: serverTimestamp(),
    yieldKg: Number(yieldKg),
    quality: quality || 'good',
    notes: notes || '',
  };
  const ref = await addDoc(collection(db, COL), data);
  // Дублюємо в AsyncStorage як офлайн-кеш
  await syncHarvestToLocal({ id: ref.id, ...data, harvestedAt: new Date().toISOString() });
  return ref.id;
}

export async function getHarvestsForCrop(cropId) {
  const q = query(collection(db, COL), where('cropId', '==', cropId), orderBy('harvestedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getHarvestsForPlot(plotId) {
  const q = query(collection(db, COL), where('plotId', '==', plotId), orderBy('harvestedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getHarvestsForBed(bedId) {
  const q = query(collection(db, COL), where('bedId', '==', bedId), orderBy('harvestedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteHarvest(id) {
  await deleteDoc(doc(db, COL, id));
}
