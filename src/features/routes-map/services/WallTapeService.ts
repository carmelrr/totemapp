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
 * Find the wall tape whose grade range contains the given grade.
 * Returns the first matching tape (by catalog order), or undefined when no
 * tape with a valid range covers the grade.
 *
 * Used to auto-suggest the correct tape ("טייפ") when a route setter picks a
 * grade (e.g. V2 -> black, V3 -> yellow), based on the gradeMin/gradeMax
 * ranges that admins configure in WallTapeManagementScreen.
 */
export function findTapeForGrade(
  grade: string,
  tapes: WallTape[],
): WallTape | undefined {
  const routeIdx = gradeIndex(grade);
  if (routeIdx === -1) return undefined;

  return tapes.find((tape) => {
    if (!tape.gradeMin || !tape.gradeMax) return false;
    const minIdx = gradeIndex(tape.gradeMin);
    const maxIdx = gradeIndex(tape.gradeMax);
    if (minIdx === -1 || maxIdx === -1) return false;
    const lo = Math.min(minIdx, maxIdx);
    const hi = Math.max(minIdx, maxIdx);
    return routeIdx >= lo && routeIdx <= hi;
  });
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

// ---------------------------------------------------------------------------
// Diagnostics & normalization
// ---------------------------------------------------------------------------

export interface TapeDiagnosticsReport {
  totalActive: number;
  withTape: number;
  empty: number;
  matchedById: number;
  matchedByHex: number;
  matchedByName: number;
  unresolved: number;
  samples: {
    matchedById: Array<{ routeId: string; wallTape: string }>;
    matchedByHex: Array<{ routeId: string; wallTape: string }>;
    matchedByName: Array<{ routeId: string; wallTape: string }>;
    unresolved: Array<{ routeId: string; wallTape: string }>;
  };
}

function normalizeRef(v: string | undefined | null): string {
  return (v || '').trim().toLowerCase();
}

/**
 * Scan the routes collection and categorize how each route's `wallTape` value
 * maps to the current wall-tapes catalog. Useful for diagnosing legacy data.
 */
export async function diagnoseRouteWallTapes(): Promise<TapeDiagnosticsReport> {
  const tapes = await getWallTapes();
  const byId = new Map<string, string>();   // normalized id -> canonical id
  const byHex = new Map<string, string>();  // normalized hex -> canonical id
  const byName = new Map<string, string>(); // normalized name -> canonical id
  for (const tape of tapes) {
    byId.set(normalizeRef(tape.id), tape.id);
    if (tape.hex) byHex.set(normalizeRef(tape.hex), tape.id);
    if (tape.nameHe) byName.set(normalizeRef(tape.nameHe), tape.id);
    if (tape.nameEn) byName.set(normalizeRef(tape.nameEn), tape.id);
  }

  const snapshot = await getDocs(collection(db, 'routes'));
  const activeDocs = snapshot.docs.filter((d) => {
    const s = d.data().status;
    return !s || s === 'active';
  });

  const report: TapeDiagnosticsReport = {
    totalActive: activeDocs.length,
    withTape: 0,
    empty: 0,
    matchedById: 0,
    matchedByHex: 0,
    matchedByName: 0,
    unresolved: 0,
    samples: {
      matchedById: [],
      matchedByHex: [],
      matchedByName: [],
      unresolved: [],
    },
  };

  const MAX_SAMPLES = 5;
  for (const docSnap of activeDocs) {
    const raw = (docSnap.data() as any).wallTape as string | undefined;
    if (!raw) {
      report.empty++;
      continue;
    }
    report.withTape++;
    const n = normalizeRef(raw);
    const entry = { routeId: docSnap.id, wallTape: raw };
    if (byId.has(n)) {
      report.matchedById++;
      if (report.samples.matchedById.length < MAX_SAMPLES) report.samples.matchedById.push(entry);
    } else if (byHex.has(n)) {
      report.matchedByHex++;
      if (report.samples.matchedByHex.length < MAX_SAMPLES) report.samples.matchedByHex.push(entry);
    } else if (byName.has(n)) {
      report.matchedByName++;
      if (report.samples.matchedByName.length < MAX_SAMPLES) report.samples.matchedByName.push(entry);
    } else {
      report.unresolved++;
      if (report.samples.unresolved.length < MAX_SAMPLES) report.samples.unresolved.push(entry);
    }
  }

  return report;
}

export interface NormalizeReport {
  total: number;
  matchedById: number;        // already canonical, no write
  rewrittenFromHex: number;
  rewrittenFromName: number;
  autoAssignedEmpty: number;  // empty wallTape filled via grade range
  unresolved: number;         // left as-is
}

/**
 * Normalize the `wallTape` field on all active routes so it always holds the
 * canonical tape id. Legacy values (hex / name) are rewritten when a unique
 * tape match exists. Empty values receive an auto-assigned id when the route's
 * grade falls within a tape's grade range.
 */
export async function normalizeRouteWallTapes(): Promise<NormalizeReport> {
  const tapes = await getWallTapes();
  const byId = new Set<string>(tapes.map((t) => t.id));
  const normIdMap = new Map<string, string>();
  const byHex = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const tape of tapes) {
    normIdMap.set(normalizeRef(tape.id), tape.id);
    if (tape.hex) byHex.set(normalizeRef(tape.hex), tape.id);
    if (tape.nameHe) byName.set(normalizeRef(tape.nameHe), tape.id);
    if (tape.nameEn) byName.set(normalizeRef(tape.nameEn), tape.id);
  }
  const tapesWithRange = tapes.filter(
    (t) => t.gradeMin && t.gradeMax && gradeIndex(t.gradeMin) !== -1 && gradeIndex(t.gradeMax) !== -1,
  );

  const snapshot = await getDocs(collection(db, 'routes'));
  const activeDocs = snapshot.docs.filter((d) => {
    const s = d.data().status;
    return !s || s === 'active';
  });

  const report: NormalizeReport = {
    total: activeDocs.length,
    matchedById: 0,
    rewrittenFromHex: 0,
    rewrittenFromName: 0,
    autoAssignedEmpty: 0,
    unresolved: 0,
  };

  const batches: ReturnType<typeof writeBatch>[] = [writeBatch(db)];
  let batchIndex = 0;
  let opsInBatch = 0;
  const enqueue = (ref: any, value: string) => {
    if (opsInBatch >= 499) {
      batches.push(writeBatch(db));
      batchIndex++;
      opsInBatch = 0;
    }
    batches[batchIndex].update(ref, { wallTape: value });
    opsInBatch++;
  };

  for (const docSnap of activeDocs) {
    const data = docSnap.data() as any;
    const raw = data.wallTape as string | undefined;
    if (raw) {
      // Fast path: already a canonical id
      if (byId.has(raw)) {
        report.matchedById++;
        continue;
      }
      const n = normalizeRef(raw);
      const fromId = normIdMap.get(n); // case-mismatched id
      if (fromId) {
        if (fromId !== raw) enqueue(docSnap.ref, fromId);
        report.matchedById++;
        continue;
      }
      const fromHex = byHex.get(n);
      if (fromHex) {
        enqueue(docSnap.ref, fromHex);
        report.rewrittenFromHex++;
        continue;
      }
      const fromName = byName.get(n);
      if (fromName) {
        enqueue(docSnap.ref, fromName);
        report.rewrittenFromName++;
        continue;
      }
      report.unresolved++;
      continue;
    }
    // Empty wallTape: try auto-assign by grade range
    const routeGradeIdx = gradeIndex(data.grade || '');
    if (routeGradeIdx === -1) {
      report.unresolved++;
      continue;
    }
    const matchingTape = tapesWithRange.find((tape) => {
      const minIdx = gradeIndex(tape.gradeMin!);
      const maxIdx = gradeIndex(tape.gradeMax!);
      return routeGradeIdx >= minIdx && routeGradeIdx <= maxIdx;
    });
    if (matchingTape) {
      enqueue(docSnap.ref, matchingTape.id);
      report.autoAssignedEmpty++;
    } else {
      report.unresolved++;
    }
  }

  for (const batch of batches) {
    await batch.commit();
  }

  return report;
}

/**
 * Validate a list of tapes for overlapping grade ranges. Returns pairs of
 * tapes whose `[gradeMin, gradeMax]` intervals overlap; an empty array means
 * the configuration is unambiguous for auto-assignment.
 */
export function findOverlappingTapeRanges(
  tapes: WallTape[],
): Array<{ a: WallTape; b: WallTape }> {
  const withRange = tapes.filter(
    (t) => t.gradeMin && t.gradeMax && gradeIndex(t.gradeMin) !== -1 && gradeIndex(t.gradeMax) !== -1,
  );
  const overlaps: Array<{ a: WallTape; b: WallTape }> = [];
  for (let i = 0; i < withRange.length; i++) {
    for (let j = i + 1; j < withRange.length; j++) {
      const a = withRange[i];
      const b = withRange[j];
      const aMin = gradeIndex(a.gradeMin!);
      const aMax = gradeIndex(a.gradeMax!);
      const bMin = gradeIndex(b.gradeMin!);
      const bMax = gradeIndex(b.gradeMax!);
      if (aMin <= bMax && bMin <= aMax) {
        overlaps.push({ a, b });
      }
    }
  }
  return overlaps;
}
