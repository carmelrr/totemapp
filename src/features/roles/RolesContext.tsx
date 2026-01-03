/**
 * @fileoverview Roles Context
 * @description Global context for managing user roles state
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { auth } from '@/features/data/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { UserRole, Permission } from './types';
import { getUserRoles } from './rolesService';
import {
  getPermissionsForRoles,
  hasPermission as checkPermission,
  canEditRoutes as checkCanEditRoutes,
  canEnterResults as checkCanEnterResults,
  canEditResults as checkCanEditResults,
  canManageRoles as checkCanManageRoles,
} from './constants';

interface RolesContextType {
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

const RolesContext = createContext<RolesContextType | undefined>(undefined);

interface RolesProviderProps {
  children: ReactNode;
}

export function RolesProvider({ children }: RolesProviderProps) {
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

  const value: RolesContextType = {
    roles,
    permissions,
    loading,
    // Role checks
    isAdmin: roles.includes('admin'),
    isRouteSetter: roles.includes('route_setter'),
    isJudge: roles.includes('judge'),
    isHeadJudge: roles.includes('head_judge'),
    // Permission checks
    canEditRoutes: checkCanEditRoutes(roles),
    canEnterResults: checkCanEnterResults(roles),
    canEditResults: checkCanEditResults(roles),
    canManageRoles: checkCanManageRoles(roles),
    // Methods
    hasRole: (role: UserRole) => roles.includes(role),
    hasAnyRole: (requiredRoles: UserRole[]) => requiredRoles.some(r => roles.includes(r)),
    hasPermission: (permission: Permission) => checkPermission(roles, permission),
    refreshRoles,
  };

  return (
    <RolesContext.Provider value={value}>
      {children}
    </RolesContext.Provider>
  );
}

export function useRolesContext(): RolesContextType {
  const context = useContext(RolesContext);
  if (!context) {
    throw new Error('useRolesContext must be used within a RolesProvider');
  }
  return context;
}
