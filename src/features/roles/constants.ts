/**
 * @fileoverview User Roles Constants
 * @description Constants and configurations for the roles system
 */

import { RoleInfo, UserRole, Permission, RolePermissions } from './types';

/**
 * Role information with display details
 */
export const ROLES: Record<UserRole, RoleInfo> = {
  route_setter: {
    id: 'route_setter',
    name: 'בונה מסלולים',
    nameEn: 'Route Setter',
    description: 'יכול להוסיף, לערוך ולמחוק מסלולים במפת הקיר',
    icon: '🧗',
    color: '#10B981', // green
  },
  judge: {
    id: 'judge',
    name: 'שופט',
    nameEn: 'Judge',
    description: 'יכול להזין תוצאות בתחרויות',
    icon: '⚖️',
    color: '#3B82F6', // blue
  },
  head_judge: {
    id: 'head_judge',
    name: 'שופט ראשי',
    nameEn: 'Head Judge',
    description: 'יכול לערוך ולתקן תוצאות בתחרויות',
    icon: '👨‍⚖️',
    color: '#8B5CF6', // purple
  },
  social_manager: {
    id: 'social_manager',
    name: 'מנהל סושיאל',
    nameEn: 'Social Manager',
    description: 'יכול ליצור, לערוך ולתזמן הודעות מערכת בפיד',
    icon: '📢',
    color: '#F59E0B', // amber
  },
  admin: {
    id: 'admin',
    name: 'אדמין',
    nameEn: 'Admin',
    description: 'גישה מלאה למערכת כולל ניהול תפקידים',
    icon: '👑',
    color: '#EF4444', // red
  },
};

/**
 * All available roles in order of hierarchy
 */
export const ALL_ROLES: UserRole[] = ['route_setter', 'judge', 'head_judge', 'social_manager', 'admin'];

/**
 * Role hierarchy - higher index = more permissions
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  route_setter: 1,
  judge: 2,
  head_judge: 3,
  social_manager: 3, // Same level as head_judge
  admin: 4,
};

/**
 * Permissions granted by each role
 */
export const ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'route_setter',
    permissions: [
      'routes.view',
      'routes.create',
      'routes.edit',
      'routes.delete',
    ],
  },
  {
    role: 'judge',
    permissions: [
      'competitions.view',
      'competitions.enter_results',
      'competitions.manage_participants',
    ],
  },
  {
    role: 'head_judge',
    permissions: [
      'competitions.view',
      'competitions.enter_results',
      'competitions.edit_results',
      'competitions.manage_participants',
    ],
  },
  {
    role: 'social_manager',
    permissions: [
      'announcements.view',
      'announcements.create',
      'announcements.edit',
      'announcements.delete',
      'announcements.schedule',
    ],
  },
  {
    role: 'admin',
    permissions: [
      // Route permissions
      'routes.view',
      'routes.create',
      'routes.edit',
      'routes.delete',
      // Competition permissions
      'competitions.view',
      'competitions.create',
      'competitions.edit',
      'competitions.delete',
      'competitions.enter_results',
      'competitions.edit_results',
      'competitions.manage_participants',
      // Announcements permissions
      'announcements.view',
      'announcements.create',
      'announcements.edit',
      'announcements.delete',
      'announcements.schedule',
      // Admin permissions
      'admin.manage_roles',
      'admin.manage_users',
      'admin.full_access',
    ],
  },
];

/**
 * Get all permissions for a set of roles
 */
export function getPermissionsForRoles(roles: UserRole[]): Permission[] {
  const permissions = new Set<Permission>();
  
  roles.forEach(role => {
    const rolePerms = ROLE_PERMISSIONS.find(rp => rp.role === role);
    if (rolePerms) {
      rolePerms.permissions.forEach(p => permissions.add(p));
    }
  });
  
  return Array.from(permissions);
}

/**
 * Check if a set of roles has a specific permission
 */
export function hasPermission(roles: UserRole[], permission: Permission): boolean {
  return getPermissionsForRoles(roles).includes(permission);
}

/**
 * Check if user can edit routes
 */
export function canEditRoutes(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('route_setter');
}

/**
 * Check if user can enter competition results
 */
export function canEnterResults(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('judge') || roles.includes('head_judge');
}

/**
 * Check if user can edit competition results
 */
export function canEditResults(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('head_judge');
}

/**
 * Check if user can manage roles
 */
export function canManageRoles(roles: UserRole[]): boolean {
  return roles.includes('admin');
}

// ==================== Competition-specific Permissions ====================

/**
 * Check if user can manage competition judges
 * Only Admin and Head Judge can manage judges
 */
export function canManageJudges(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('head_judge');
}

/**
 * Check if user can manage competition participants
 * Only Head Judge and Admin can manage participants
 */
export function canManageParticipants(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('head_judge');
}

/**
 * Check if user can manage competition routes
 * Only Head Judge and Admin can manage routes
 */
export function canManageCompetitionRoutes(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('head_judge');
}

/**
 * Check if user has any judge-like role (can work with competitions)
 */
export function isJudgeRole(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('judge') || roles.includes('head_judge');
}

/**
 * Get role display info
 */
export function getRoleInfo(role: UserRole): RoleInfo {
  return ROLES[role];
}

/**
 * Get roles that a user can assign based on their own roles
 * Admins can assign all roles
 */
export function getAssignableRoles(userRoles: UserRole[]): UserRole[] {
  if (userRoles.includes('admin')) {
    return ALL_ROLES;
  }
  return [];
}

/**
 * Check if user can manage announcements
 * Social Manager and Admin can manage announcements
 */
export function canManageAnnouncements(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('social_manager');
}
