import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const COL = 'plots';

export async function getPlots() {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addPlot(name, polygon, area) {
  const ref = await addDoc(collection(db, COL), {
    name,
    polygon,
    area,
    createdAt: serverTimestamp(),
    userId: null,
  });
  return ref.id;
}

export async function updatePlot(id, updates) {
  await updateDoc(doc(db, COL, id), updates);
}

export async function deletePlot(id) {
  await deleteDoc(doc(db, COL, id));
}
