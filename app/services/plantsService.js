import { db, auth } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';

export async function addPlant({ plantId, variety, varietyId, harvestDays, photoUri, notes }) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const ref = await addDoc(collection(db, 'plants'), {
    userId,
    plantId: plantId || null,
    variety: variety || '',
    varietyId: varietyId || null,
    harvestDays: Number(harvestDays),
    photoUri: photoUri || null,
    notes: notes || '',
    createdAt: new Date(),
  });
  return { id: ref.id };
}

export async function getPlants() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const q = query(collection(db, 'plants'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const sn = await getDocs(q);
  return sn.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllPlants() {
  const q = query(
    collection(db, 'plants'),
    where('userId', '==', 'community'),
    orderBy('plantId', 'asc')
  );
  const sn = await getDocs(q);
  return sn.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updatePlant(docId, { plantId, variety, varietyId, harvestDays, photoUri, notes }) {
  await updateDoc(doc(db, 'plants', docId), {
    plantId: plantId || null,
    variety: variety || '',
    varietyId: varietyId || null,
    harvestDays: Number(harvestDays),
    photoUri: photoUri || null,
    notes: notes || '',
  });
}

export async function deletePlant(plantId) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');
  await deleteDoc(doc(db, 'plants', plantId));
}
