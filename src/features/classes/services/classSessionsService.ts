/**
 * @fileoverview Firestore CRUD for class Sessions — individual placements on
 * the weekly board (day × time × location).
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
} from "firebase/firestore";
import { db } from "@/features/data/firebase";
import type { ClassSession } from "../types";

const COLL = "classSessions";

export function listenToClassSessions(
  callback: (sessions: ClassSession[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLL), orderBy("dayOfWeek", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClassSession[] = [];
      snap.forEach((d) =>
        list.push({ id: d.id, ...(d.data() as ClassSession) }),
      );
      callback(list);
    },
    (err) => onError?.(err as Error),
  );
}

export async function addClassSession(
  payload: Omit<ClassSession, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COLL), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClassSession(
  id: string,
  patch: Partial<Omit<ClassSession, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, COLL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClassSession(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}
