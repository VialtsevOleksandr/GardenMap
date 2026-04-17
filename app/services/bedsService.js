import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

const COL = 'beds';

export async function getBeds(plotId) {
  const q = query(collection(db, COL), where('plotId', '==', plotId), orderBy('row'), orderBy('col'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addBed(plotId, label, row, col, spanRows = 1, spanCols = 1, widthM = 1.0, heightM = 1.0) {
  const ref = await addDoc(collection(db, COL), {
    plotId, label, row, col,
    spanRows: Number(spanRows),
    spanCols: Number(spanCols),
    widthM: Number(widthM),
    heightM: Number(heightM),
    notes: '',
  });
  return ref.id;
}

export async function updateBed(id, updates) {
  await updateDoc(doc(db, COL, id), updates);
}

export async function deleteBed(id) {
  await deleteDoc(doc(db, COL, id));
}
