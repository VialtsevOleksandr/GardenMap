import { db, auth } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';

export async function addPlant({ name, variety, harvestDays, photoUri, notes }) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const ref = await addDoc(collection(db, 'plants'), {
    userId,
    name,
    variety: variety || '',
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

  const q = query(
    collection(db, 'plants'),
    where('userId', '==', userId),
    orderBy('name', 'asc')
  );
  
  const sn = await getDocs(q);
  return sn.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deletePlant(plantId) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');
  await deleteDoc(doc(db, 'plants', plantId));
}
