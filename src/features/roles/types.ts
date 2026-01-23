/**
 * @fileoverview User Roles Types
 * @description Type definitions for the roles system
 */

/**
 * Available user roles in the system
 * - route_setter: Can edit routes (add/edit/delete) on the wall map
 * - judge: Can enter results in competitions
 * - head_judge: Can edit/correct competition results + all judge permissions
 * - social_manager: Can create/edit/delete announcements in the feed
 * - admin: Full system access including role management
 */
export type UserRole = 'route_setter' | 'judge' | 'head_judge' | 'social_manager' | 'admin';

/**
 * Role display information
 */
export interface RoleInfo {
  id: UserRole;
  name: string;           // Hebrew name
  nameEn: string;         // English name
  description: string;    // Hebrew description
  icon: string;           // Emoji icon
  color: string;          // Badge color
}

/**
 * User roles document in Firestore
 */
export interface UserRoles {
  userId: string;
  roles: UserRole[];
  updatedAt: Date;
  updatedBy: string;      // Admin who last updated
}

/**
 * Permission types
 */
export type Permission = 
  // Route permissions
  | 'routes.view'
  | 'routes.create'
  | 'routes.edit'
  | 'routes.delete'
  // Competition permissions
  | 'competitions.view'
  | 'competitions.create'
  | 'competitions.edit'
  | 'competitions.delete'
  | 'competitions.enter_results'
  | 'competitions.edit_results'
  | 'competitions.manage_participants'
  // Announcements permissions
  | 'announcements.view'
  | 'announcements.create'
  | 'announcements.edit'
  | 'announcements.delete'
  | 'announcements.schedule'
  // Admin permissions
  | 'admin.manage_roles'
  | 'admin.manage_users'
  | 'admin.full_access';

/**
 * Role permissions mapping
 */
export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

/**
 * User with roles for display
 */
export interface UserWithRoles {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  roles: UserRole[];
  isAdmin: boolean;
  createdAt?: Date;
}
