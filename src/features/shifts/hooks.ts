/**
 * @fileoverview Shift Management Hooks
 * @description React hooks for the shift management system
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { auth } from '@/features/data/firebase';
import type {
  ShiftRole,
  UserShiftRole,
  Shift,
  ShiftRegistration,
  ShiftFilter,
  ShiftWithDetails,
  ShiftSwapRequest,
} from './types';
import {
  subscribeToShiftRoles,
  subscribeToMyShiftRoles,
  subscribeToAllUserShiftRoles,
  subscribeToShifts,
  subscribeToShiftRegistrations,
  subscribeToUserRegistrations,
  subscribeToIncomingSwapRequests,
  subscribeToOutgoingSwapRequests,
  getUserShiftRoles,
} from './shiftsService';

/** Hook for all shift roles */
export function useShiftRoles() {
  const [roles, setRoles] = useState<ShiftRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToShiftRoles((data) => {
      setRoles(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { roles, loading };
}

/** Hook for current user's shift roles */
export function useMyShiftRoles() {
  const [userShiftRole, setUserShiftRole] = useState<UserShiftRole | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToMyShiftRoles(userId, (data) => {
      setUserShiftRole(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  const isWorker = useMemo(() => {
    return userShiftRole !== null && userShiftRole.isActive && userShiftRole.shiftRoleIds.length > 0;
  }, [userShiftRole]);

  const isShiftManager = useMemo(() => {
    return userShiftRole?.isShiftManager === true;
  }, [userShiftRole]);

  return { userShiftRole, isWorker, isShiftManager, loading };
}

/** Hook for all user shift roles (admin use) */
export function useAllUserShiftRoles() {
  const [users, setUsers] = useState<UserShiftRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAllUserShiftRoles((data) => {
      setUsers(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { users, loading };
}

/** Hook for shifts with filtering */
export function useShifts(filter: ShiftFilter = {}) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToShifts(filter, (data) => {
      setShifts(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [filter.dateFrom?.getTime(), filter.dateTo?.getTime(), filter.status, filter.roleId]);

  return { shifts, loading };
}

/** Hook for shifts visible to current user (filtered by their roles) */
export function useMyVisibleShifts(filter: ShiftFilter = {}) {
  const { userShiftRole, loading: rolesLoading } = useMyShiftRoles();
  const { shifts, loading: shiftsLoading } = useShifts(filter);

  const visibleShifts = useMemo(() => {
    if (!userShiftRole || !userShiftRole.isActive) return [];
    const myRoleIds = new Set(userShiftRole.shiftRoleIds);
    return shifts.filter((shift) =>
      shift.requiredRoleIds.some((roleId) => myRoleIds.has(roleId))
    );
  }, [shifts, userShiftRole]);

  return {
    shifts: visibleShifts,
    loading: rolesLoading || shiftsLoading,
  };
}

/** Hook for registrations on a specific shift */
export function useShiftRegistrations(shiftId: string | null) {
  const [registrations, setRegistrations] = useState<ShiftRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shiftId) {
      setRegistrations([]);
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToShiftRegistrations(shiftId, (data) => {
      setRegistrations(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [shiftId]);

  return { registrations, loading };
}

/** Hook for current user's registrations */
export function useMyRegistrations() {
  const [registrations, setRegistrations] = useState<ShiftRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToUserRegistrations(userId, (data) => {
      setRegistrations(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { registrations, loading };
}

/** Hook that enriches shifts with role details and registration info */
export function useShiftsWithDetails(shifts: Shift[], roles: ShiftRole[]): ShiftWithDetails[] {
  const { registrations } = useMyRegistrations();
  const userId = auth.currentUser?.uid;

  return useMemo(() => {
    const roleMap = new Map(roles.map((r) => [r.id, r]));
    const regByShift = new Map<string, ShiftRegistration>();
    registrations.forEach((reg) => {
      if (reg.userId === userId && reg.status !== 'cancelled' && reg.status !== 'rejected') {
        regByShift.set(reg.shiftId, reg);
      }
    });

    return shifts.map((shift) => ({
      ...shift,
      roles: shift.requiredRoleIds.map((id) => roleMap.get(id)).filter(Boolean) as ShiftRole[],
      approvedCount: shift.assignedWorkerIds.length,
      pendingCount: 0, // Will be computed by admin view with full registrations
      userRegistration: regByShift.get(shift.id),
    }));
  }, [shifts, roles, registrations, userId]);
}

/** Hook for incoming swap requests (someone is asking me to take their shift) */
export function useIncomingSwapRequests() {
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToIncomingSwapRequests(userId, (data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { requests, loading };
}

/** Hook for outgoing swap requests (I asked someone to take my shift) */
export function useOutgoingSwapRequests() {
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToOutgoingSwapRequests(userId, (data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { requests, loading };
}
