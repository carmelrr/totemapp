/**
 * @fileoverview useRoles Hook
 * @description React hook for accessing user roles and permissions
 */

import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/features/data/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { UserRole, Permission } from './types';
import { getUserRoles } from './rolesService';
import {
  getPermissionsForRoles,
  hasPermission,
  canEditRoutes,
  canEnterResults,
  canEditResults,
  canManageRoles,
} from './constants';

interface UseRolesReturn {
  roles: UserRole[];
  permissions: Permission[];
  loading: boolean;
  // Role checks
  isAdmin: boolean;
  isRouteSetter: boolean;
  isJudge: boolean;
  isHeadJudge: boolean;
  // Permission checks
  canEditRoutes: boolean;
  canEnterResults: boolean;
  canEditResults: boolean;
  canManageRoles: boolean;
  // Methods
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  refreshRoles: () => Promise<void>;
}

/**
 * Hook for accessing current user's roles and permissions
 */
export function useRoles(): UseRolesReturn {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async (userId: string) => {
    try {
      const userRoles = await getUserRoles(userId);
      setRoles(userRoles);
    } catch (error) {
      console.error('Error loading user roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadRoles(user.uid);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [loadRoles]);

  const refreshRoles = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      await loadRoles(user.uid);
    }
  }, [loadRoles]);

  const permissions = getPermissionsForRoles(roles);

  return {
    roles,
    permissions,
    loading,
    // Role checks
    isAdmin: roles.includes('admin'),
    isRouteSetter: roles.includes('route_setter'),
    isJudge: roles.includes('judge'),
    isHeadJudge: roles.includes('head_judge'),
    // Permission checks
    canEditRoutes: canEditRoutes(roles),
    canEnterResults: canEnterResults(roles),
    canEditResults: canEditResults(roles),
    canManageRoles: canManageRoles(roles),
    // Methods
    hasRole: (role: UserRole) => roles.includes(role),
    hasAnyRole: (requiredRoles: UserRole[]) => requiredRoles.some(r => roles.includes(r)),
    hasPermission: (permission: Permission) => hasPermission(roles, permission),
    refreshRoles,
  };
}
