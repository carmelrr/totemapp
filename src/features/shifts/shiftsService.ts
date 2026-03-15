/**
 * @fileoverview Shifts Service
 * @description Firestore CRUD operations for the shift management system
 */

import { db, auth } from '@/features/data/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import type {
  ShiftRole,
  UserShiftRole,
  Shift,
  ShiftRegistration,
  ShiftHistoryEntry,
  ShiftStatus,
  RegistrationStatus,
  ShiftHistoryAction,
  ShiftFilter,
  ShiftSwapRequest,
  SwapRequestStatus,
} from './types';

// ==================== Collection Names ====================
const SHIFT_ROLES_COLLECTION = 'shiftRoles';
const USER_SHIFT_ROLES_COLLECTION = 'userShiftRoles';
const SHIFTS_COLLECTION = 'shifts';
const SHIFT_REGISTRATIONS_COLLECTION = 'shiftRegistrations';
const SHIFT_HISTORY_COLLECTION = 'shiftHistory';
const SHIFT_SWAP_REQUESTS_COLLECTION = 'shiftSwapRequests';

// ==================== Helper Functions ====================

function toDate(val: any): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return new Date();
}

function mapShiftRole(docData: any, id: string): ShiftRole {
  return {
    id,
    name: docData.name || '',
    nameEn: docData.nameEn || '',
    description: docData.description || '',
    color: docData.color || '#3B82F6',
    icon: docData.icon || '👤',
    isActive: docData.isActive !== false,
    createdAt: toDate(docData.createdAt),
    updatedAt: toDate(docData.updatedAt),
  };
}

function mapShift(docData: any, id: string): Shift {
  const recurrence = docData.recurrence || { type: 'none' };
  return {
    id,
    requiredRoleIds: docData.requiredRoleIds || [],
    title: docData.title || undefined,
    description: docData.description || undefined,
    startTime: toDate(docData.startTime),
    endTime: toDate(docData.endTime),
    maxWorkers: docData.maxWorkers || 1,
    minWorkers: docData.minWorkers || undefined,
    status: docData.status || 'open',
    recurrence: {
      ...recurrence,
      endDate: recurrence.endDate ? toDate(recurrence.endDate) : undefined,
    },
    parentShiftId: docData.parentShiftId || undefined,
    assignedWorkerIds: docData.assignedWorkerIds || [],
    createdBy: docData.createdBy || '',
    createdAt: toDate(docData.createdAt),
    updatedAt: toDate(docData.updatedAt),
  };
}

function mapRegistration(docData: any, id: string): ShiftRegistration {
  return {
    id,
    shiftId: docData.shiftId || '',
    userId: docData.userId || '',
    userName: docData.userName || '',
    shiftRoleId: docData.shiftRoleId || '',
    status: docData.status || 'pending',
    note: docData.note || undefined,
    adminNote: docData.adminNote || undefined,
    waitlistPosition: docData.waitlistPosition || undefined,
    createdAt: toDate(docData.createdAt),
    updatedAt: toDate(docData.updatedAt),
    handledBy: docData.handledBy || undefined,
  };
}

// ==================== Shift Roles ====================

/** Create a new shift role */
export async function createShiftRole(role: Omit<ShiftRole, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, SHIFT_ROLES_COLLECTION), {
    ...role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Update a shift role */
export async function updateShiftRole(roleId: string, updates: Partial<ShiftRole>): Promise<void> {
  const { id, createdAt, ...data } = updates as any;
  await updateDoc(doc(db, SHIFT_ROLES_COLLECTION, roleId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a shift role */
export async function deleteShiftRole(roleId: string): Promise<void> {
  await deleteDoc(doc(db, SHIFT_ROLES_COLLECTION, roleId));
}

/** Subscribe to all shift roles */
export function subscribeToShiftRoles(callback: (roles: ShiftRole[]) => void): () => void {
  const q = query(collection(db, SHIFT_ROLES_COLLECTION), orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    const roles = snapshot.docs.map((d) => mapShiftRole(d.data(), d.id));
    callback(roles);
  });
}

/** Get all shift roles (one-time) */
export async function getShiftRoles(): Promise<ShiftRole[]> {
  const q = query(collection(db, SHIFT_ROLES_COLLECTION), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => mapShiftRole(d.data(), d.id));
}

// ==================== User Shift Roles ====================

/** Assign shift roles to a user */
export async function setUserShiftRoles(
  userId: string,
  userName: string,
  shiftRoleIds: string[],
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, USER_SHIFT_ROLES_COLLECTION, userId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    await updateDoc(docRef, {
      shiftRoleIds,
      userName,
      isActive: true,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  } else {
    await setDoc(docRef, {
      userId,
      userName,
      shiftRoleIds,
      isActive: true,
      isShiftManager: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  }
}

/** Toggle shift manager status for a user */
export async function setUserShiftManager(userId: string, isShiftManager: boolean, updatedBy: string): Promise<void> {
  await updateDoc(doc(db, USER_SHIFT_ROLES_COLLECTION, userId), {
    isShiftManager,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

/** Get user shift roles */
export async function getUserShiftRoles(userId: string): Promise<UserShiftRole | null> {
  const docSnap = await getDoc(doc(db, USER_SHIFT_ROLES_COLLECTION, userId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    userName: data.userName || '',
    shiftRoleIds: data.shiftRoleIds || [],
    isActive: data.isActive !== false,
    isShiftManager: data.isShiftManager === true,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    updatedBy: data.updatedBy || '',
  };
}

/** Subscribe to current user's shift roles */
export function subscribeToMyShiftRoles(userId: string, callback: (roles: UserShiftRole | null) => void): () => void {
  return onSnapshot(doc(db, USER_SHIFT_ROLES_COLLECTION, userId), (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }
    const data = docSnap.data();
    callback({
      id: docSnap.id,
      userId: data.userId,
      userName: data.userName || '',
      shiftRoleIds: data.shiftRoleIds || [],
      isActive: data.isActive !== false,
      isShiftManager: data.isShiftManager === true,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      updatedBy: data.updatedBy || '',
    });
  });
}

/** Subscribe to all user shift roles (for admin) */
export function subscribeToAllUserShiftRoles(callback: (users: UserShiftRole[]) => void): () => void {
  const q = query(collection(db, USER_SHIFT_ROLES_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userName: data.userName || '',
        shiftRoleIds: data.shiftRoleIds || [],
        isActive: data.isActive !== false,
        isShiftManager: data.isShiftManager === true,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        updatedBy: data.updatedBy || '',
      } as UserShiftRole;
    });
    callback(users);
  });
}

// ==================== Shifts ====================

/** Serialize recurrence pattern for Firestore (convert Date to Timestamp) */
function serializeRecurrence(recurrence: Shift['recurrence']): any {
  if (!recurrence) return { type: 'none' };
  return {
    ...recurrence,
    endDate: recurrence.endDate
      ? Timestamp.fromDate(recurrence.endDate instanceof Date ? recurrence.endDate : new Date(recurrence.endDate as any))
      : null,
  };
}

/** Remove undefined values from an object (Firestore rejects undefined) */
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

/** Create a new shift */
export async function createShift(shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, SHIFTS_COLLECTION), stripUndefined({
    ...shift,
    startTime: Timestamp.fromDate(shift.startTime instanceof Date ? shift.startTime : new Date(shift.startTime)),
    endTime: Timestamp.fromDate(shift.endTime instanceof Date ? shift.endTime : new Date(shift.endTime)),
    recurrence: serializeRecurrence(shift.recurrence),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return docRef.id;
}

/** Create recurring shift instances */
export async function createRecurringShifts(
  baseShift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>,
  dates: Date[]
): Promise<string[]> {
  const batch = writeBatch(db);
  const ids: string[] = [];

  for (const date of dates) {
    const ref = doc(collection(db, SHIFTS_COLLECTION));
    const startTime = new Date(date);
    startTime.setHours(baseShift.startTime.getHours(), baseShift.startTime.getMinutes());
    const endTime = new Date(date);
    endTime.setHours(baseShift.endTime.getHours(), baseShift.endTime.getMinutes());
    // Handle overnight shifts
    if (endTime <= startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    batch.set(ref, stripUndefined({
      ...baseShift,
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      recurrence: serializeRecurrence(baseShift.recurrence),
      assignedWorkerIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    ids.push(ref.id);
  }

  await batch.commit();
  return ids;
}

/** Update a shift */
export async function updateShift(shiftId: string, updates: Partial<Shift>): Promise<void> {
  const { id, createdAt, ...data } = updates as any;
  if (data.startTime && !(data.startTime instanceof Timestamp)) {
    data.startTime = Timestamp.fromDate(data.startTime instanceof Date ? data.startTime : new Date(data.startTime));
  }
  if (data.endTime && !(data.endTime instanceof Timestamp)) {
    data.endTime = Timestamp.fromDate(data.endTime instanceof Date ? data.endTime : new Date(data.endTime));
  }
  if (data.recurrence) {
    data.recurrence = serializeRecurrence(data.recurrence);
  }
  await updateDoc(doc(db, SHIFTS_COLLECTION, shiftId), stripUndefined({
    ...data,
    updatedAt: serverTimestamp(),
  }));
}

/** Delete a shift */
export async function deleteShift(shiftId: string): Promise<void> {
  await deleteDoc(doc(db, SHIFTS_COLLECTION, shiftId));
}

/** Duplicate a shift to a new date */
export async function duplicateShift(shiftId: string, newStartTime: Date, newEndTime: Date): Promise<string> {
  const shiftDoc = await getDoc(doc(db, SHIFTS_COLLECTION, shiftId));
  if (!shiftDoc.exists()) throw new Error('Shift not found');

  const data = shiftDoc.data();
  const docRef = await addDoc(collection(db, SHIFTS_COLLECTION), {
    requiredRoleIds: data.requiredRoleIds,
    title: data.title,
    description: data.description,
    startTime: Timestamp.fromDate(newStartTime),
    endTime: Timestamp.fromDate(newEndTime),
    maxWorkers: data.maxWorkers,
    minWorkers: data.minWorkers,
    status: 'open',
    recurrence: { type: 'none' },
    assignedWorkerIds: [],
    createdBy: auth.currentUser?.uid || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Subscribe to shifts (with optional filter) */
export function subscribeToShifts(
  filter: ShiftFilter,
  callback: (shifts: Shift[]) => void
): () => void {
  const constraints: any[] = [];

  // Server-side date filtering – dramatically reduces data transfer
  if (filter.dateFrom) {
    constraints.push(where('startTime', '>=', Timestamp.fromDate(filter.dateFrom)));
  }
  if (filter.dateTo) {
    constraints.push(where('startTime', '<=', Timestamp.fromDate(filter.dateTo)));
  }
  constraints.push(orderBy('startTime', 'asc'));

  const q = query(collection(db, SHIFTS_COLLECTION), ...constraints);

  return onSnapshot(q, (snapshot) => {
    let shifts = snapshot.docs.map((d) => mapShift(d.data(), d.id));

    // Light client-side filtering for fields not in the query
    if (filter.status) {
      shifts = shifts.filter((s) => s.status === filter.status);
    }
    if (filter.roleId) {
      shifts = shifts.filter((s) => s.requiredRoleIds.includes(filter.roleId!));
    }

    callback(shifts);
  });
}

/** Get a single shift */
export async function getShift(shiftId: string): Promise<Shift | null> {
  const docSnap = await getDoc(doc(db, SHIFTS_COLLECTION, shiftId));
  if (!docSnap.exists()) return null;
  return mapShift(docSnap.data(), docSnap.id);
}

/** Subscribe to a single shift (real-time) */
export function subscribeToShift(shiftId: string, callback: (shift: Shift | null) => void): () => void {
  return onSnapshot(doc(db, SHIFTS_COLLECTION, shiftId), (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }
    callback(mapShift(docSnap.data(), docSnap.id));
  });
}

// ==================== Shift Registrations ====================

/** Register for a shift */
export async function registerForShift(
  shiftId: string,
  userId: string,
  userName: string,
  shiftRoleId: string,
  note?: string
): Promise<string> {
  // Check for conflicts (user already registered for overlapping shift)
  const shift = await getShift(shiftId);
  if (!shift) throw new Error('Shift not found');
  if (shift.status !== 'open') throw new Error('Shift is not open for registration');

  // Check for existing registration
  const existingQ = query(
    collection(db, SHIFT_REGISTRATIONS_COLLECTION),
    where('shiftId', '==', shiftId),
    where('userId', '==', userId)
  );
  const existing = await getDocs(existingQ);
  if (!existing.empty) {
    const existingReg = existing.docs[0].data();
    if (existingReg.status !== 'cancelled' && existingReg.status !== 'rejected') {
      throw new Error('Already registered for this shift');
    }
  }

  const docRef = await addDoc(collection(db, SHIFT_REGISTRATIONS_COLLECTION), {
    shiftId,
    userId,
    userName,
    shiftRoleId,
    status: 'pending',
    note: note || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Log history
  await addShiftHistory(shiftId, 'registration_submitted', userId, userName);

  return docRef.id;
}

/** Cancel a registration */
export async function cancelRegistration(registrationId: string): Promise<void> {
  const regDoc = await getDoc(doc(db, SHIFT_REGISTRATIONS_COLLECTION, registrationId));
  if (!regDoc.exists()) throw new Error('Registration not found');
  const data = regDoc.data();

  await updateDoc(doc(db, SHIFT_REGISTRATIONS_COLLECTION, registrationId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });

  // If was approved, remove from assigned workers
  if (data.status === 'approved') {
    const shift = await getShift(data.shiftId);
    if (shift) {
      await updateShift(data.shiftId, {
        assignedWorkerIds: shift.assignedWorkerIds.filter((id: string) => id !== data.userId),
      });
    }
  }

  await addShiftHistory(data.shiftId, 'registration_cancelled', data.userId, data.userName);
}

/** Handle registration (admin approve/reject/waitlist) */
export async function handleRegistration(
  registrationId: string,
  newStatus: RegistrationStatus,
  adminId: string,
  adminNote?: string
): Promise<void> {
  const regDoc = await getDoc(doc(db, SHIFT_REGISTRATIONS_COLLECTION, registrationId));
  if (!regDoc.exists()) throw new Error('Registration not found');
  const data = regDoc.data();

  const updateData: any = {
    status: newStatus,
    handledBy: adminId,
    updatedAt: serverTimestamp(),
  };
  if (adminNote) updateData.adminNote = adminNote;

  await updateDoc(doc(db, SHIFT_REGISTRATIONS_COLLECTION, registrationId), updateData);

  // If approved, add to shift's assigned workers
  if (newStatus === 'approved') {
    const shift = await getShift(data.shiftId);
    if (shift && !shift.assignedWorkerIds.includes(data.userId)) {
      const newAssigned = [...shift.assignedWorkerIds, data.userId];
      const updates: Partial<Shift> = { assignedWorkerIds: newAssigned };

      // Auto-close: if we reached maxWorkers, set status to 'assigned'
      if (newAssigned.length >= shift.maxWorkers && (shift.status === 'open' || shift.status === 'closed')) {
        updates.status = 'assigned';
      }

      await updateShift(data.shiftId, updates);
    }
  }

  // If rejected and was approved, remove from assigned workers
  if (newStatus === 'rejected' && data.status === 'approved') {
    const shift = await getShift(data.shiftId);
    if (shift) {
      await updateShift(data.shiftId, {
        assignedWorkerIds: shift.assignedWorkerIds.filter((id: string) => id !== data.userId),
      });
    }
  }

  const actionMap: Record<string, ShiftHistoryAction> = {
    approved: 'registration_approved',
    rejected: 'registration_rejected',
    waitlisted: 'registration_waitlisted',
  };
  if (actionMap[newStatus]) {
    await addShiftHistory(data.shiftId, actionMap[newStatus], adminId, '', data.userId, data.userName);
  }
}

/** Subscribe to registrations for a shift */
export function subscribeToShiftRegistrations(
  shiftId: string,
  callback: (registrations: ShiftRegistration[]) => void
): () => void {
  const q = query(
    collection(db, SHIFT_REGISTRATIONS_COLLECTION),
    where('shiftId', '==', shiftId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const registrations = snapshot.docs.map((d) => mapRegistration(d.data(), d.id));
    callback(registrations);
  });
}

/** Subscribe to user's active registrations (excludes cancelled/rejected) */
export function subscribeToUserRegistrations(
  userId: string,
  callback: (registrations: ShiftRegistration[]) => void
): () => void {
  const q = query(
    collection(db, SHIFT_REGISTRATIONS_COLLECTION),
    where('userId', '==', userId),
    where('status', 'in', ['pending', 'approved', 'waitlisted'])
  );
  return onSnapshot(q, (snapshot) => {
    const registrations = snapshot.docs.map((d) => mapRegistration(d.data(), d.id));
    callback(registrations);
  });
}

/** Check for shift time conflicts for a user */
export async function checkShiftConflict(userId: string, startTime: Date, endTime: Date, excludeShiftId?: string): Promise<Shift | null> {
  // Get user's approved registrations
  const regQ = query(
    collection(db, SHIFT_REGISTRATIONS_COLLECTION),
    where('userId', '==', userId),
    where('status', '==', 'approved')
  );
  const regSnap = await getDocs(regQ);
  const approvedShiftIds = regSnap.docs
    .map((d) => d.data().shiftId)
    .filter((id: string) => id !== excludeShiftId);

  if (approvedShiftIds.length === 0) return null;

  // Check each approved shift for overlap
  for (const shiftId of approvedShiftIds) {
    const shift = await getShift(shiftId);
    if (!shift) continue;
    // Check overlap: shifts overlap if one starts before the other ends
    if (startTime < shift.endTime && endTime > shift.startTime) {
      return shift;
    }
  }
  return null;
}

// ==================== Shift History ====================

/** Add a history entry */
async function addShiftHistory(
  shiftId: string,
  action: ShiftHistoryAction,
  performedBy: string,
  performedByName?: string,
  targetUserId?: string,
  targetUserName?: string,
  details?: string
): Promise<void> {
  await addDoc(collection(db, SHIFT_HISTORY_COLLECTION), {
    shiftId,
    action,
    performedBy,
    performedByName: performedByName || '',
    targetUserId: targetUserId || null,
    targetUserName: targetUserName || null,
    details: details || null,
    timestamp: serverTimestamp(),
  });
}

/** Get shift history */
export async function getShiftHistory(shiftId: string): Promise<ShiftHistoryEntry[]> {
  const q = query(
    collection(db, SHIFT_HISTORY_COLLECTION),
    where('shiftId', '==', shiftId),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      shiftId: data.shiftId,
      action: data.action,
      performedBy: data.performedBy,
      performedByName: data.performedByName || '',
      targetUserId: data.targetUserId || undefined,
      targetUserName: data.targetUserName || undefined,
      details: data.details || undefined,
      timestamp: toDate(data.timestamp),
    } as ShiftHistoryEntry;
  });
}

// ==================== Shift Swap Requests ====================

function mapSwapRequest(docData: any, id: string): ShiftSwapRequest {
  return {
    id,
    shiftId: docData.shiftId || '',
    registrationId: docData.registrationId || '',
    requesterId: docData.requesterId || '',
    requesterName: docData.requesterName || '',
    targetUserId: docData.targetUserId || '',
    targetUserName: docData.targetUserName || '',
    shiftRoleId: docData.shiftRoleId || '',
    status: docData.status || 'pending',
    message: docData.message || undefined,
    createdAt: toDate(docData.createdAt),
    updatedAt: toDate(docData.updatedAt),
  };
}

/** Create a swap request */
export async function createSwapRequest(
  shiftId: string,
  registrationId: string,
  requesterId: string,
  requesterName: string,
  targetUserId: string,
  targetUserName: string,
  shiftRoleId: string,
  message?: string
): Promise<string> {
  // Check no existing pending swap request for this registration
  const existingQ = query(
    collection(db, SHIFT_SWAP_REQUESTS_COLLECTION),
    where('registrationId', '==', registrationId),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(existingQ);
  if (!existing.empty) {
    throw new Error('כבר קיימת בקשת החלפה פעילה למשמרת זו');
  }

  const docRef = await addDoc(collection(db, SHIFT_SWAP_REQUESTS_COLLECTION), {
    shiftId,
    registrationId,
    requesterId,
    requesterName,
    targetUserId,
    targetUserName,
    shiftRoleId,
    status: 'pending',
    message: message || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addShiftHistory(shiftId, 'swap_requested', requesterId, requesterName, targetUserId, targetUserName);
  return docRef.id;
}

/** Accept a swap request – transfers the shift to the target user */
export async function acceptSwapRequest(swapRequestId: string): Promise<void> {
  const swapDoc = await getDoc(doc(db, SHIFT_SWAP_REQUESTS_COLLECTION, swapRequestId));
  if (!swapDoc.exists()) throw new Error('בקשת ההחלפה לא נמצאה');
  const swap = swapDoc.data();

  if (swap.status !== 'pending') throw new Error('בקשה זו כבר טופלה');

  const batch = writeBatch(db);

  // 1. Mark old registration as cancelled
  batch.update(doc(db, SHIFT_REGISTRATIONS_COLLECTION, swap.registrationId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });

  // 2. Create new registration for the target user
  const newRegRef = doc(collection(db, SHIFT_REGISTRATIONS_COLLECTION));
  batch.set(newRegRef, {
    shiftId: swap.shiftId,
    userId: swap.targetUserId,
    userName: swap.targetUserName,
    shiftRoleId: swap.shiftRoleId,
    status: 'approved',
    note: `החלפה מ-${swap.requesterName}`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    handledBy: 'swap_system',
  });

  // 3. Update shift's assigned workers: remove requester, add target
  const shift = await getShift(swap.shiftId);
  if (shift) {
    const newAssigned = shift.assignedWorkerIds
      .filter((id: string) => id !== swap.requesterId);
    if (!newAssigned.includes(swap.targetUserId)) {
      newAssigned.push(swap.targetUserId);
    }
    batch.update(doc(db, SHIFTS_COLLECTION, swap.shiftId), {
      assignedWorkerIds: newAssigned,
      updatedAt: serverTimestamp(),
    });
  }

  // 4. Mark swap request as accepted
  batch.update(doc(db, SHIFT_SWAP_REQUESTS_COLLECTION, swapRequestId), {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  await addShiftHistory(
    swap.shiftId,
    'swap_accepted',
    swap.targetUserId,
    swap.targetUserName,
    swap.requesterId,
    swap.requesterName
  );
}

/** Reject a swap request */
export async function rejectSwapRequest(swapRequestId: string): Promise<void> {
  const swapDoc = await getDoc(doc(db, SHIFT_SWAP_REQUESTS_COLLECTION, swapRequestId));
  if (!swapDoc.exists()) throw new Error('בקשת ההחלפה לא נמצאה');
  const swap = swapDoc.data();

  if (swap.status !== 'pending') throw new Error('בקשה זו כבר טופלה');

  await updateDoc(doc(db, SHIFT_SWAP_REQUESTS_COLLECTION, swapRequestId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });

  await addShiftHistory(
    swap.shiftId,
    'swap_rejected',
    swap.targetUserId,
    swap.targetUserName,
    swap.requesterId,
    swap.requesterName
  );
}

/** Get eligible users who can take a shift (same role, active, excluding the requester) */
export async function getEligibleSwapUsers(
  shiftRoleId: string,
  excludeUserId: string
): Promise<UserShiftRole[]> {
  const q = query(collection(db, USER_SHIFT_ROLES_COLLECTION));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userName: data.userName || '',
        shiftRoleIds: data.shiftRoleIds || [],
        isActive: data.isActive !== false,
        isShiftManager: data.isShiftManager === true,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        updatedBy: data.updatedBy || '',
      } as UserShiftRole;
    })
    .filter(
      (u) =>
        u.isActive &&
        u.userId !== excludeUserId &&
        u.shiftRoleIds.includes(shiftRoleId)
    );
}

/** Subscribe to incoming swap requests for a user */
export function subscribeToIncomingSwapRequests(
  userId: string,
  callback: (requests: ShiftSwapRequest[]) => void
): () => void {
  const q = query(
    collection(db, SHIFT_SWAP_REQUESTS_COLLECTION),
    where('targetUserId', '==', userId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => mapSwapRequest(d.data(), d.id));
    callback(requests);
  });
}

/** Subscribe to outgoing swap requests for a user */
export function subscribeToOutgoingSwapRequests(
  userId: string,
  callback: (requests: ShiftSwapRequest[]) => void
): () => void {
  const q = query(
    collection(db, SHIFT_SWAP_REQUESTS_COLLECTION),
    where('requesterId', '==', userId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => mapSwapRequest(d.data(), d.id));
    callback(requests);
  });
}
