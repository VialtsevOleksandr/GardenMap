import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { syncHarvestToLocal, deleteLocalHarvest, getPendingHarvests, getLocalHarvests } from './storageService';

const COL = 'harvests';

// ── Sync any locally-pending harvests to Firestore ───────────────────────────
// Called automatically before every addHarvest so offline data eventually lands in DB.
export async function syncPendingHarvests() {
  const pending = await getPendingHarvests();
  for (const h of pending) {
    try {
      const { id: localId, _pending, harvestedAt, ...rest } = h;
      const ref = await addDoc(collection(db, COL), { ...rest, harvestedAt: serverTimestamp() });
      await deleteLocalHarvest(localId);
      await syncHarvestToLocal({ ...rest, id: ref.id, harvestedAt });
    } catch (_) {
      break; // Still offline — stop and try again next time
    }
  }
}

// ── Offline-first add ─────────────────────────────────────────────────────────
// 1. Saves to AsyncStorage immediately (works without internet)
// 2. Tries to sync any previously pending harvests
// 3. Saves current harvest to Firestore; if it fails, leaves it as _pending
export async function addHarvest({ cropId, bedId, plotId, cropName, plantId, varietyId, variety, icon, yieldKg, quality, notes, unit }) {
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const data = {
    cropId,
    bedId,
    plotId,
    cropName: cropName || '',
    plantId: plantId || null,
    varietyId: varietyId || null,
    variety: variety || '',
    icon: icon || null,
    yieldKg: Number(yieldKg),
    quality: quality || 'good',
    notes: notes || '',
    unit: unit || 'kg',
    harvestedAt: now,
  };

  // Step 1: flush previously pending items (from prior offline sessions)
  await syncPendingHarvests();

  // Step 2: try Firestore first (online case)
  try {
    const ref = await addDoc(collection(db, COL), { ...data, harvestedAt: serverTimestamp() });
    await syncHarvestToLocal({ ...data, id: ref.id }); // save confirmed entry locally
    return ref.id;
  } catch (_) {
    // Step 3: offline — save as pending so it syncs next time
    await syncHarvestToLocal({ ...data, id: localId, _pending: true });
    return localId;
  }
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

export async function updateHarvest(id, updates) {
  await updateDoc(doc(db, COL, id), updates);
  const list = await getLocalHarvests();
  const entry = list.find(h => h.id === id);
  if (entry) await syncHarvestToLocal({ ...entry, ...updates });
}

export async function deleteHarvest(id) {
  await deleteDoc(doc(db, COL, id));
  await deleteLocalHarvest(id);
}
