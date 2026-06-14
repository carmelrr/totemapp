/**
 * @fileoverview Q&A Service
 * @description Firestore CRUD for the staff knowledge base (questions collection).
 * Access is staff-only and enforced in firestore.rules.
 */

import { db } from '@/features/data/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Question } from './types';

const QUESTIONS_COLLECTION = 'questions';

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return null;
}

function mapQuestion(docData: any, id: string): Question {
  return {
    id,
    authorUid: docData.authorUid || '',
    authorName: docData.authorName || 'עובד',
    title: docData.title || '',
    body: docData.body || '',
    status: docData.status === 'answered' ? 'answered' : 'open',
    answer: docData.answer ?? null,
    answeredBy: docData.answeredBy ?? null,
    answeredAt: toDate(docData.answeredAt),
    visible: docData.visible === true,
    createdAt: toDate(docData.createdAt) || new Date(),
  };
}

// Newest first; createdAt may be null briefly until serverTimestamp resolves.
function byNewest(a: Question, b: Question): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

// ==================== Mutations ====================

/** Worker asks a question (status open, hidden until answered). */
export async function askQuestion(
  authorUid: string,
  authorName: string,
  title: string,
  body: string,
): Promise<void> {
  await addDoc(collection(db, QUESTIONS_COLLECTION), {
    authorUid,
    authorName,
    title: title.trim(),
    body: body.trim(),
    status: 'open',
    answer: null,
    answeredBy: null,
    answeredAt: null,
    visible: false,
    createdAt: serverTimestamp(),
  });
}

/** Manager answers → status answered, visible in the knowledge base. */
export async function answerQuestion(id: string, answer: string, answeredBy: string): Promise<void> {
  await updateDoc(doc(db, QUESTIONS_COLLECTION, id), {
    status: 'answered',
    answer: answer.trim(),
    answeredBy,
    answeredAt: serverTimestamp(),
    visible: true,
  });
}

/** Manager edits an existing question/answer. */
export async function editQuestion(
  id: string,
  data: { title: string; body: string; answer: string },
): Promise<void> {
  await updateDoc(doc(db, QUESTIONS_COLLECTION, id), {
    title: data.title.trim(),
    body: data.body.trim(),
    answer: data.answer.trim(),
  });
}

export async function setQuestionVisible(id: string, visible: boolean): Promise<void> {
  await updateDoc(doc(db, QUESTIONS_COLLECTION, id), { visible });
}

export async function deleteQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, QUESTIONS_COLLECTION, id));
}

// ==================== Subscriptions ====================

/** Knowledge base: answered + visible questions, newest first. */
export function subscribeToKnowledgeBase(callback: (items: Question[]) => void): () => void {
  const q = query(
    collection(db, QUESTIONS_COLLECTION),
    where('visible', '==', true),
    where('status', '==', 'answered'),
  );
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => mapQuestion(d.data(), d.id)).sort(byNewest)),
  );
}

/** The current user's own questions. */
export function subscribeToMyQuestions(
  uid: string,
  callback: (items: Question[]) => void,
): () => void {
  const q = query(collection(db, QUESTIONS_COLLECTION), where('authorUid', '==', uid));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => mapQuestion(d.data(), d.id)).sort(byNewest)),
  );
}

/** Pending questions awaiting an answer (manager). */
export function subscribeToPendingQuestions(callback: (items: Question[]) => void): () => void {
  const q = query(collection(db, QUESTIONS_COLLECTION), where('status', '==', 'open'));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => mapQuestion(d.data(), d.id)).sort(byNewest)),
  );
}

/** All answered questions incl. hidden — for KB management (manager). */
export function subscribeToAllAnswered(callback: (items: Question[]) => void): () => void {
  const q = query(collection(db, QUESTIONS_COLLECTION), where('status', '==', 'answered'));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => mapQuestion(d.data(), d.id)).sort(byNewest)),
  );
}
