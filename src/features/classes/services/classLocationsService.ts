/**
 * @fileoverview Firestore CRUD for class-planning physical locations
 * (walls, kids area, training area, …).
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
import type { ClassLocation } from "../types";

const COLL = "classLocations";

export function listenToClassLocations(
  callback: (locations: ClassLocation[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLL), orderBy("order", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClassLocation[] = [];
      snap.forEach((d) =>
        list.push({ id: d.id, ...(d.data() as ClassLocation) }),
      );
      callback(list);
    },
    (err) => onError?.(err as Error),
  );
}

export async function addClassLocation(
  payload: Omit<ClassLocation, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COLL), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClassLocation(
  id: string,
  patch: Partial<Omit<ClassLocation, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, COLL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClassLocation(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}
