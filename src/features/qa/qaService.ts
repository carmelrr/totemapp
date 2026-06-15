/**
 * @fileoverview Q&A Service
 * @description Firestore CRUD for the staff knowledge base (`questions`) and folders
 * (`qaFolders`). Access is staff-only and enforced in firestore.rules.
 */

import { db } from '@/features/data/firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Question, QAFolder, QAMedia, QAStep } from './types';

const QUESTIONS_COLLECTION = 'questions';
const FOLDERS_COLLECTION = 'qaFolders';

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return null;
}

/** Drop undefined values (Firestore rejects them). */
function pruneUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out as T;
}

function mapMedia(raw: any): QAMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: any) => ({
    id: String(m?.id ?? ''),
    kind: m?.kind === 'video' ? 'video' : 'image',
    source: m?.source === 'link' ? 'link' : 'upload',
    url: String(m?.url ?? ''),
    thumbnailUrl: m?.thumbnailUrl ?? undefined,
  }));
}

function mapSteps(raw: any): QAStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any, i: number) => ({
    id: String(s?.id ?? `step_${i}`),
    text: String(s?.text ?? ''),
    media: mapMedia(s?.media),
    links: Array.isArray(s?.links)
      ? s.links.map((l: any) => ({
          questionId: String(l?.questionId ?? ''),
          stepId: l?.stepId ?? null,
          label: l?.label ?? undefined,
        }))
      : [],
  }));
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
    folderId: docData.folderId ?? null,
    media: mapMedia(docData.media),
    steps: mapSteps(docData.steps),
  };
}

// Newest first; createdAt may be null briefly until serverTimestamp resolves.
function byNewest(a: Question, b: Question): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

// Serialize structured content for Firestore (plain objects, no undefined).
function serializeMedia(media?: QAMedia[]): any[] {
  return (media || []).map((m) =>
    pruneUndefined({
      id: m.id,
      kind: m.kind,
      source: m.source,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
    }),
  );
}

function serializeSteps(steps?: QAStep[]): any[] {
  return (steps || []).map((s) => ({
    id: s.id,
    text: (s.text || '').trim(),
    media: serializeMedia(s.media),
    links: (s.links || []).map((l) =>
      pruneUndefined({ questionId: l.questionId, stepId: l.stepId ?? null, label: l.label }),
    ),
  }));
}

// ==================== Question mutations ====================

/** Worker asks a question (status open, hidden until answered). */
export async function askQuestion(
  authorUid: string,
  authorName: string,
  title: string,
  body: string,
  media?: QAMedia[],
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
    folderId: null,
    media: serializeMedia(media),
    steps: [],
    createdAt: serverTimestamp(),
  });
}

/**
 * Save question/answer content (manager). Handles plain edits, structured steps, media,
 * folder assignment, and — with `opts.markAnswered` — publishing an answer (sets status
 * 'answered' + visible). Only provided fields are written.
 */
export interface QuestionContent {
  title?: string;
  body?: string;
  answer?: string | null;
  folderId?: string | null;
  media?: QAMedia[];
  steps?: QAStep[];
  visible?: boolean;
}

export async function saveQuestionContent(
  id: string,
  data: QuestionContent,
  opts?: { answeredBy?: string; markAnswered?: boolean },
): Promise<void> {
  const update: Record<string, any> = {};
  if (data.title !== undefined) update.title = data.title.trim();
  if (data.body !== undefined) update.body = data.body.trim();
  if (data.answer !== undefined) update.answer = data.answer ? data.answer.trim() : null;
  if (data.folderId !== undefined) update.folderId = data.folderId ?? null;
  if (data.media !== undefined) update.media = serializeMedia(data.media);
  if (data.steps !== undefined) update.steps = serializeSteps(data.steps);
  if (data.visible !== undefined) update.visible = data.visible;
  if (opts?.markAnswered) {
    update.status = 'answered';
    update.answeredBy = opts.answeredBy ?? null;
    update.answeredAt = serverTimestamp();
  }
  await updateDoc(doc(db, QUESTIONS_COLLECTION, id), update);
}

/**
 * Manager/admin creates a knowledge-base entry directly (no prior worker question).
 * Created answered + visible by default; gated to staff in firestore.rules.
 */
export async function createKbEntry(
  data: QuestionContent,
  author: { uid: string; name: string },
): Promise<string> {
  const ref = await addDoc(collection(db, QUESTIONS_COLLECTION), {
    authorUid: author.uid,
    authorName: author.name,
    title: (data.title || '').trim(),
    body: (data.body || '').trim(),
    status: 'answered',
    answer: data.answer ? data.answer.trim() : null,
    answeredBy: author.uid,
    answeredAt: serverTimestamp(),
    visible: data.visible ?? true,
    folderId: data.folderId ?? null,
    media: serializeMedia(data.media),
    steps: serializeSteps(data.steps),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Manager answers with plain text → status answered, visible in the knowledge base. */
export async function answerQuestion(id: string, answer: string, answeredBy: string): Promise<void> {
  await saveQuestionContent(id, { answer, visible: true }, { answeredBy, markAnswered: true });
}

export async function setQuestionVisible(id: string, visible: boolean): Promise<void> {
  await updateDoc(doc(db, QUESTIONS_COLLECTION, id), { visible });
}

export async function deleteQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, QUESTIONS_COLLECTION, id));
}

export async function getQuestion(id: string): Promise<Question | null> {
  const snap = await getDoc(doc(db, QUESTIONS_COLLECTION, id));
  return snap.exists() ? mapQuestion(snap.data(), snap.id) : null;
}

// ==================== Folder mutations ====================

function mapFolder(docData: any, id: string): QAFolder {
  return {
    id,
    name: docData.name || '',
    order: typeof docData.order === 'number' ? docData.order : 0,
    createdBy: docData.createdBy || '',
    createdAt: toDate(docData.createdAt) || new Date(),
  };
}

export async function createFolder(name: string, createdBy: string, order = 0): Promise<string> {
  const ref = await addDoc(collection(db, FOLDERS_COLLECTION), {
    name: name.trim(),
    order,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, FOLDERS_COLLECTION, id), { name: name.trim() });
}

export async function reorderFolders(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, FOLDERS_COLLECTION, id), { order: index });
  });
  await batch.commit();
}

/** Delete a folder; member questions are kept and moved to "uncategorized" (folderId = null). */
export async function deleteFolder(id: string): Promise<void> {
  const members = await getDocs(
    query(collection(db, QUESTIONS_COLLECTION), where('folderId', '==', id)),
  );
  const batch = writeBatch(db);
  members.forEach((m) => batch.update(m.ref, { folderId: null }));
  batch.delete(doc(db, FOLDERS_COLLECTION, id));
  await batch.commit();
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

/** All folders, ordered by `order` then name. */
export function subscribeToFolders(callback: (items: QAFolder[]) => void): () => void {
  return onSnapshot(collection(db, FOLDERS_COLLECTION), (snap) =>
    callback(
      snap.docs
        .map((d) => mapFolder(d.data(), d.id))
        .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name))),
    ),
  );
}
