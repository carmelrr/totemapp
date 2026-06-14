/**
 * @fileoverview Shift Tasks Service
 * @description Firestore CRUD for staff task checklists.
 *  - taskLists: reusable ordered checklists, attached to shift roles
 *  - shiftTasks: per-worker, per-shift task instances (materialized on assignment)
 * Staff-only; access enforced in firestore.rules (isWorker / isShiftManager).
 */

import { db } from '@/features/data/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import type { TaskItem, TaskList, ShiftTask } from './types';

// ==================== Collection Names ====================
const TASK_LISTS_COLLECTION = 'taskLists';
const SHIFT_TASKS_COLLECTION = 'shiftTasks';
const SHIFT_ROLES_COLLECTION = 'shiftRoles';

// ==================== Helpers ====================

function toDate(val: any): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return new Date();
}

function mapTaskList(docData: any, id: string): TaskList {
  const items: TaskItem[] = (docData.items || []).map((it: any) => ({
    id: it.id,
    title: it.title || '',
    order: typeof it.order === 'number' ? it.order : 0,
  }));
  items.sort((a, b) => a.order - b.order);
  return { id, name: docData.name || '', items };
}

function mapShiftTask(docData: any, id: string): ShiftTask {
  return {
    id,
    shiftId: docData.shiftId || '',
    uid: docData.uid || '',
    shiftRoleId: docData.shiftRoleId || '',
    title: docData.title || '',
    listName: docData.listName || '',
    source: docData.source === 'manager' ? 'manager' : 'template',
    done: docData.done === true,
    doneAt: docData.doneAt ? toDate(docData.doneAt) : null,
    createdAt: toDate(docData.createdAt),
  };
}

/** Deterministic id for a template task → re-materialization is idempotent. */
function templateTaskId(shiftId: string, uid: string, listId: string, itemId: string): string {
  return `${shiftId}__${uid}__${listId}__${itemId}`;
}

// ==================== Task Lists ====================

export async function createTaskList(name: string, items: TaskItem[] = []): Promise<string> {
  const ref = await addDoc(collection(db, TASK_LISTS_COLLECTION), {
    name: name.trim(),
    items,
  });
  return ref.id;
}

export async function updateTaskList(
  id: string,
  data: { name: string; items: TaskItem[] },
): Promise<void> {
  await updateDoc(doc(db, TASK_LISTS_COLLECTION, id), {
    name: data.name.trim(),
    items: data.items,
  });
}

export async function deleteTaskList(id: string): Promise<void> {
  await deleteDoc(doc(db, TASK_LISTS_COLLECTION, id));
}

export async function getTaskLists(): Promise<TaskList[]> {
  const snap = await getDocs(query(collection(db, TASK_LISTS_COLLECTION), orderBy('name')));
  return snap.docs.map((d) => mapTaskList(d.data(), d.id));
}

export function subscribeToTaskLists(callback: (lists: TaskList[]) => void): () => void {
  const q = query(collection(db, TASK_LISTS_COLLECTION), orderBy('name'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapTaskList(d.data(), d.id))));
}

// ==================== Materialization ====================

/**
 * Create the worker's shift tasks from the task lists attached to their role.
 * Called when a worker is approved/assigned to a shift. Idempotent (deterministic ids).
 */
export async function materializeTasksForAssignment(
  shiftId: string,
  uid: string,
  shiftRoleId: string,
): Promise<void> {
  if (!shiftId || !uid || !shiftRoleId) return;

  const roleSnap = await getDoc(doc(db, SHIFT_ROLES_COLLECTION, shiftRoleId));
  if (!roleSnap.exists()) return;
  const taskListIds: string[] = roleSnap.data()?.taskListIds || [];
  if (taskListIds.length === 0) return;

  const batch = writeBatch(db);
  let count = 0;
  for (const listId of taskListIds) {
    const listSnap = await getDoc(doc(db, TASK_LISTS_COLLECTION, listId));
    if (!listSnap.exists()) continue;
    const list = mapTaskList(listSnap.data(), listSnap.id);
    for (const item of list.items) {
      batch.set(doc(db, SHIFT_TASKS_COLLECTION, templateTaskId(shiftId, uid, listId, item.id)), {
        shiftId,
        uid,
        shiftRoleId,
        title: item.title,
        listName: list.name,
        source: 'template',
        done: false,
        doneAt: null,
        createdAt: serverTimestamp(),
      });
      count++;
    }
  }
  if (count > 0) await batch.commit();
}

/** Move a worker's open shift tasks to another worker (used on swap accept). */
export async function reassignShiftTasks(
  shiftId: string,
  fromUid: string,
  toUid: string,
): Promise<void> {
  if (!shiftId || !fromUid || !toUid || fromUid === toUid) return;
  const snap = await getDocs(
    query(
      collection(db, SHIFT_TASKS_COLLECTION),
      where('shiftId', '==', shiftId),
      where('uid', '==', fromUid),
    ),
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { uid: toUid }));
  await batch.commit();
}

// ==================== Worker: toggle ====================

export async function setTaskDone(taskId: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, SHIFT_TASKS_COLLECTION, taskId), {
    done,
    doneAt: done ? serverTimestamp() : null,
  });
}

// ==================== Manager: live add ====================

export async function addManagerTask(
  shiftId: string,
  uid: string,
  shiftRoleId: string,
  title: string,
  listName: string,
): Promise<void> {
  await addDoc(collection(db, SHIFT_TASKS_COLLECTION), {
    shiftId,
    uid,
    shiftRoleId: shiftRoleId || '',
    title: title.trim(),
    listName: listName.trim() || 'מהמנהל',
    source: 'manager',
    done: false,
    doneAt: null,
    createdAt: serverTimestamp(),
  });
}

/** Add the same task to every assigned worker on a shift. */
export async function addManagerTaskForAll(
  shiftId: string,
  uids: string[],
  title: string,
  listName: string,
): Promise<void> {
  if (uids.length === 0) return;
  const batch = writeBatch(db);
  for (const uid of uids) {
    batch.set(doc(collection(db, SHIFT_TASKS_COLLECTION)), {
      shiftId,
      uid,
      shiftRoleId: '',
      title: title.trim(),
      listName: listName.trim() || 'מהמנהל',
      source: 'manager',
      done: false,
      doneAt: null,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function deleteShiftTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, SHIFT_TASKS_COLLECTION, taskId));
}

// ==================== Subscriptions ====================

/** A worker's tasks on a specific shift. */
export function subscribeToMyShiftTasks(
  shiftId: string,
  uid: string,
  callback: (tasks: ShiftTask[]) => void,
): () => void {
  const q = query(
    collection(db, SHIFT_TASKS_COLLECTION),
    where('shiftId', '==', shiftId),
    where('uid', '==', uid),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapShiftTask(d.data(), d.id))));
}

/** All tasks on a shift (manager monitoring). */
export function subscribeToShiftTasks(
  shiftId: string,
  callback: (tasks: ShiftTask[]) => void,
): () => void {
  const q = query(collection(db, SHIFT_TASKS_COLLECTION), where('shiftId', '==', shiftId));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapShiftTask(d.data(), d.id))));
}
