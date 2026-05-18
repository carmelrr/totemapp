/**
 * @fileoverview Firestore CRUD for pricing programs (מסלולי תשלום).
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
import type { ClassProgram } from "../types";

const COLL = "classPrograms";

export function listenToClassPrograms(
  callback: (programs: ClassProgram[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLL), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClassProgram[] = [];
      snap.forEach((d) =>
        list.push({ id: d.id, ...(d.data() as ClassProgram) }),
      );
      callback(list);
    },
    (err) => onError?.(err as Error),
  );
}

export async function addClassProgram(
  payload: Omit<ClassProgram, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COLL), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClassProgram(
  id: string,
  patch: Partial<Omit<ClassProgram, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, COLL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClassProgram(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}
