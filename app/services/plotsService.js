import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getBeds, deleteBed } from './bedsService';

const COL = 'plots';

export async function getPlots() {
  const userId = auth.currentUser?.uid;
  if (!userId) return [];
  const q = query(collection(db, COL), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addPlot(name, polygon, area, widthM = null, lengthM = null) {
  const userId = auth.currentUser?.uid || null;
  const data = { name, polygon, area, createdAt: serverTimestamp(), userId };
  if (widthM != null) data.widthM = Number(widthM);
  if (lengthM != null) data.lengthM = Number(lengthM);
  const ref = await addDoc(collection(db, COL), data);
  return ref.id;
}

export async function updatePlot(id, updates) {
  await updateDoc(doc(db, COL, id), updates);
}

// Cascade: deletes all beds (and their crops, harvests, photos) before deleting the plot.
export async function deletePlot(id) {
  const beds = await getBeds(id);
  await Promise.all(beds.map(b => deleteBed(b.id)));
  await deleteDoc(doc(db, COL, id));
}
