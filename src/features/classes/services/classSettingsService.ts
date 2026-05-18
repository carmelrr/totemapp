/**
 * @fileoverview Firestore service for the global Class Planning settings doc.
 * There is exactly one settings document at `classSettings/global`.
 */

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/features/data/firebase";
import { DEFAULT_CLASS_SETTINGS, type ClassSettings } from "../types";

const SETTINGS_DOC_ID = "global";
const COLL = "classSettings";

export async function getClassSettingsOnce(): Promise<ClassSettings> {
  const snap = await getDoc(doc(db, COLL, SETTINGS_DOC_ID));
  if (!snap.exists()) return DEFAULT_CLASS_SETTINGS;
  return { ...DEFAULT_CLASS_SETTINGS, ...(snap.data() as Partial<ClassSettings>) };
}

export function listenToClassSettings(
  callback: (settings: ClassSettings) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, COLL, SETTINGS_DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_CLASS_SETTINGS);
      } else {
        callback({
          ...DEFAULT_CLASS_SETTINGS,
          ...(snap.data() as Partial<ClassSettings>),
        });
      }
    },
    (err) => onError?.(err as Error),
  );
}

export async function saveClassSettings(
  next: Partial<ClassSettings>,
): Promise<void> {
  await setDoc(
    doc(db, COLL, SETTINGS_DOC_ID),
    { ...next, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
