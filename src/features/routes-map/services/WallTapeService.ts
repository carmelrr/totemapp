/**
 * WallTapeService — manages wall tape definitions stored in Firestore.
 *
 * Collection: wallTapes
 * Each document represents a tape color that admins can create/delete.
 * Routes reference a tape by its document ID (wallTape field on RouteDoc).
 */
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';

export interface WallTape {
  id: string;
  /** Display name in Hebrew */
  nameHe: string;
  /** Display name in English */
  nameEn: string;
  /** Hex color representing the tape, e.g. '#FF0000' */
  hex: string;
  /** Minimum V-scale grade for this tape (e.g. 'V0') */
  gradeMin?: string;
  /** Maximum V-scale grade for this tape (e.g. 'V2') */
  gradeMax?: string;
  /** Creation timestamp */
  createdAt?: any;
}

const COLLECTION = 'wallTapes';

/**
 * Subscribe to all wall tapes in real-time.
 * Returns an unsubscribe function.
 */
export function listenToWallTapes(
  callback: (tapes: WallTape[]) => void,
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const tapes: WallTape[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WallTape, 'id'>),
      }));
      callback(tapes);
    },
    (err) => {
      console.error('[WallTapeService] listener error:', err);
      callback([]);
    },
  );
}

/**
 * One-time fetch of all wall tapes.
 */
export async function getWallTapes(): Promise<WallTape[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<WallTape, 'id'>),
  }));
}

/**
 * Create a new wall tape.
 */
export async function addWallTape(tape: {
  nameHe: string;
  nameEn: string;
  hex: string;
  gradeMin?: string;
  gradeMax?: string;
}): Promise<string> {
  const data: Record<string, any> = {
    nameHe: tape.nameHe,
    nameEn: tape.nameEn,
    hex: tape.hex,
    createdAt: serverTimestamp(),
  };
  if (tape.gradeMin) data.gradeMin = tape.gradeMin;
  if (tape.gradeMax) data.gradeMax = tape.gradeMax;
  const docRef = await addDoc(collection(db, COLLECTION), data);
  return docRef.id;
}

/**
 * Update an existing wall tape.
 */
export async function updateWallTape(
  tapeId: string,
  updates: Partial<Omit<WallTape, 'id' | 'createdAt'>>,
): Promise<void> {
  const cleanUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }
  await updateDoc(doc(db, COLLECTION, tapeId), cleanUpdates);
}

/**
 * Delete a wall tape by ID.
 */
export async function deleteWallTape(tapeId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, tapeId));
}

// V-Scale grade ordering for comparisons
const GRADE_ORDER = [
  'VB', 'V0', 'V0+', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
  'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18',
];

function gradeIndex(grade: string): number {
  return GRADE_ORDER.indexOf(grade);
}

/**
 * Auto-assign wall tapes to existing routes based on grade ranges.
 * Each tape with gradeMin/gradeMax defines a grade range.
 * Routes whose grade falls within that range are assigned the tape.
 * Overwrites any existing wallTape assignment.
 * Returns { updated, skipped, total }.
 */
export async function autoAssignTapesToRoutes(): Promise<{
  updated: number;
  skipped: number;
  total: number;
}> {
  // 1. Fetch all tapes with grade ranges
  const tapes = await getWallTapes();
  const tapesWithRange = tapes.filter(
    (t) => t.gradeMin && t.gradeMax && gradeIndex(t.gradeMin) !== -1 && gradeIndex(t.gradeMax) !== -1,
  );

  if (tapesWithRange.length === 0) {
    return { updated: 0, skipped: 0, total: 0 };
  }

  // 2. Fetch all routes
  const routesRef = collection(db, 'routes');
  const snapshot = await getDocs(routesRef);

  if (snapshot.empty) {
    return { updated: 0, skipped: 0, total: 0 };
  }

  // Filter to active routes (missing status defaults to active)
  const activeDocs = snapshot.docs.filter((d) => {
    const s = d.data().status;
    return !s || s === 'active';
  });

  const total = activeDocs.length;
  let updated = 0;
  let skipped = 0;

  // Firestore batches limited to 500 operations
  const batches: ReturnType<typeof writeBatch>[] = [writeBatch(db)];
  let batchIndex = 0;
  let opsInBatch = 0;

  for (const docSnap of activeDocs) {
    const data = docSnap.data();

    const routeGrade = data.grade || '';
    const routeGradeIdx = gradeIndex(routeGrade);

    if (routeGradeIdx === -1) {
      skipped++;
      continue;
    }

    // Find the first matching tape by grade range
    const matchingTape = tapesWithRange.find((tape) => {
      const minIdx = gradeIndex(tape.gradeMin!);
      const maxIdx = gradeIndex(tape.gradeMax!);
      return routeGradeIdx >= minIdx && routeGradeIdx <= maxIdx;
    });

    if (!matchingTape) {
      skipped++;
      continue;
    }

    // Skip if already assigned to the correct tape
    if (data.wallTape === matchingTape.id) {
      skipped++;
      continue;
    }

    // Need a new batch?
    if (opsInBatch >= 499) {
      batches.push(writeBatch(db));
      batchIndex++;
      opsInBatch = 0;
    }

    batches[batchIndex].update(docSnap.ref, { wallTape: matchingTape.id });
    opsInBatch++;
    updated++;
  }

  // Commit all batches
  for (const batch of batches) {
    await batch.commit();
  }

  return { updated, skipped, total };
}
