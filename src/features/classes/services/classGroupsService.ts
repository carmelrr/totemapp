/**
 * @fileoverview Firestore CRUD for class Groups (the economic units).
 *
 * Revenue is computed at the group level, NEVER per session. A group with
 * 4 sessions/week and 8 children produces ONE monthly revenue figure.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/features/data/firebase";
import type { ClassGroup, ClassSession } from "../types";

const COLL = "classGroups";
const SESSIONS_COLL = "classSessions";

export function listenToClassGroups(
  callback: (groups: ClassGroup[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLL), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClassGroup[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as ClassGroup) }));
      callback(list);
    },
    (err) => onError?.(err as Error),
  );
}

export async function addClassGroup(
  payload: Omit<ClassGroup, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COLL), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClassGroup(
  id: string,
  patch: Partial<Omit<ClassGroup, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, COLL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a group and cascade-delete all of its sessions.
 */
export async function deleteClassGroup(
  id: string,
  sessions: ClassSession[],
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, COLL, id));
  for (const s of sessions) {
    if (s.groupId === id && s.id) {
      batch.delete(doc(db, SESSIONS_COLL, s.id));
    }
  }
  await batch.commit();
}
