/**
 * @fileoverview Roles Context
 * @description Global context for managing user roles state
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { auth } from '@/features/data/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { UserRole, Permission } from './types';
import { getUserRoles, subscribeToUserRoles } from './rolesService';
import {
  getPermissionsForRoles,
  hasPermission as checkPermission,
  canEditRoutes as checkCanEditRoutes,
  canEnterResults as checkCanEnterResults,
  canEditResults as checkCanEditResults,
  canManageRoles as checkCanManageRoles,
  canManageJudges as checkCanManageJudges,
  canManageParticipants as checkCanManageParticipants,
  canManageCompetitionRoutes as checkCanManageCompetitionRoutes,
  isJudgeRole as checkIsJudgeRole,
  canManageAnnouncements as checkCanManageAnnouncements,
  canManageClasses as checkCanManageClasses,
} from './constants';

interface RolesContextType {
  userId: string | null;
  roles: UserRole[];
  permissions: Permission[];
  loading: boolean;
  // Role checks
  isAdmin: boolean;
  isRouteSetter: boolean;
  isJudge: boolean;
  isHeadJudge: boolean;
  isSocialManager: boolean;
  // Permission checks
  canEditRoutes: boolean;
  canEnterResults: boolean;
  canEditResults: boolean;
  canManageRoles: boolean;
  // Competition-specific permissions
  canManageJudges: boolean;
  canManageParticipants: boolean;
  canManageCompetitionRoutes: boolean;
  isJudgeRole: boolean;
  // Announcements permissions
  canManageAnnouncements: boolean;
  // Classes permissions
  canManageClasses: boolean;
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
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const rolesUnsubscribeRef = useRef<(() => void) | null>(null);

  // Cleanup roles subscription
  const cleanupRolesSubscription = useCallback(() => {
    if (rolesUnsubscribeRef.current) {
      rolesUnsubscribeRef.current();
      rolesUnsubscribeRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Cleanup previous roles subscription
      cleanupRolesSubscription();
      
      if (user) {
        setUserId(user.uid);
        setLoading(true);
        
        // Subscribe to real-time roles updates
        rolesUnsubscribeRef.current = subscribeToUserRoles(
          user.uid,
          (userRoles) => {
            setRoles(userRoles);
            setLoading(false);
          },
          (error) => {
            console.error('Error in roles subscription:', error);
            setRoles([]);
            setLoading(false);
          }
        );
      } else {
        setUserId(null);
        setRoles([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      cleanupRolesSubscription();
    };
  }, [cleanupRolesSubscription]);

  const refreshRoles = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      // For manual refresh, we still use the one-time fetch
      // The subscription will automatically update after this
      setLoading(true);
      try {
        const userRoles = await getUserRoles(user.uid);
        setRoles(userRoles);
      } catch (error) {
        console.error('Error refreshing roles:', error);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const permissions = getPermissionsForRoles(roles);

  const value: RolesContextType = {
    userId,
    roles,
    permissions,
    loading,
    // Role checks
    isAdmin: roles.includes('admin'),
    isRouteSetter: roles.includes('route_setter'),
    isJudge: roles.includes('judge'),
    isHeadJudge: roles.includes('head_judge'),
    isSocialManager: roles.includes('social_manager'),
    // Permission checks
    canEditRoutes: checkCanEditRoutes(roles),
    canEnterResults: checkCanEnterResults(roles),
    canEditResults: checkCanEditResults(roles),
    canManageRoles: checkCanManageRoles(roles),
    // Competition-specific permissions
    canManageJudges: checkCanManageJudges(roles),
    canManageParticipants: checkCanManageParticipants(roles),
    canManageCompetitionRoutes: checkCanManageCompetitionRoutes(roles),
    isJudgeRole: checkIsJudgeRole(roles),
    // Announcements permissions
    canManageAnnouncements: checkCanManageAnnouncements(roles),
    // Classes permissions
    canManageClasses: checkCanManageClasses(roles),
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
