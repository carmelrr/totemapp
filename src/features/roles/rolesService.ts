/**
 * @fileoverview Roles Service
 * @description Service for managing user roles in Firestore
 */

import { db, auth } from '@/features/data/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { UserRole, UserRoles, UserWithRoles } from './types';
import { canManageRoles } from './constants';

const USERS_COLLECTION = 'users';

/**
 * Get roles for a specific user
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (!userDoc.exists()) {
      return [];
    }
    
    const userData = userDoc.data();
    
    // Check if user is admin (legacy field)
    if (userData?.isAdmin === true) {
      const roles = userData?.roles || [];
      if (!roles.includes('admin')) {
        return [...roles, 'admin'];
      }
      return roles;
    }
    
    return userData?.roles || [];
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * Set roles for a user (admin only)
 */
export async function setUserRoles(
  targetUserId: string,
  roles: UserRole[]
): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    // Verify current user has permission to manage roles
    const currentUserRoles = await getUserRoles(currentUser.uid);
    if (!canManageRoles(currentUserRoles)) {
      throw new Error('Not authorized to manage roles');
    }
    
    // Update user document with new roles
    const userRef = doc(db, USERS_COLLECTION, targetUserId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    // Determine if user should have isAdmin flag
    const isAdmin = roles.includes('admin');
    
    await updateDoc(userRef, {
      roles,
      isAdmin,
      rolesUpdatedAt: Timestamp.now(),
      rolesUpdatedBy: currentUser.uid,
    });
    
    console.log(`Roles updated for user ${targetUserId}:`, roles);
  } catch (error) {
    console.error('Error setting user roles:', error);
    throw error;
  }
}

/**
 * Add a role to a user
 */
export async function addUserRole(
  targetUserId: string,
  role: UserRole
): Promise<void> {
  const currentRoles = await getUserRoles(targetUserId);
  
  if (currentRoles.includes(role)) {
    console.log(`User ${targetUserId} already has role ${role}`);
    return;
  }
  
  await setUserRoles(targetUserId, [...currentRoles, role]);
}

/**
 * Remove a role from a user
 */
export async function removeUserRole(
  targetUserId: string,
  role: UserRole
): Promise<void> {
  const currentRoles = await getUserRoles(targetUserId);
  
  if (!currentRoles.includes(role)) {
    console.log(`User ${targetUserId} doesn't have role ${role}`);
    return;
  }
  
  const newRoles = currentRoles.filter(r => r !== role);
  await setUserRoles(targetUserId, newRoles);
}

/**
 * Check if user has a specific role
 */
export async function userHasRole(
  userId: string,
  role: UserRole
): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export async function userHasAnyRole(
  userId: string,
  requiredRoles: UserRole[]
): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return requiredRoles.some(r => roles.includes(r));
}

/**
 * Get all users with their roles for admin panel
 */
export async function getAllUsersWithRoles(): Promise<UserWithRoles[]> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    // Verify current user has permission to manage roles
    const currentUserRoles = await getUserRoles(currentUser.uid);
    if (!canManageRoles(currentUserRoles)) {
      throw new Error('Not authorized to view users');
    }
    
    const usersSnapshot = await getDocs(collection(db, USERS_COLLECTION));
    const users: UserWithRoles[] = [];
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        displayName: data.displayName || 'משתמש',
        email: data.email || '',
        photoURL: data.photoURL || null,
        roles: data.roles || [],
        isAdmin: data.isAdmin === true,
        createdAt: data.createdAt?.toDate?.() || undefined,
      });
    });
    
    // Sort by display name
    users.sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
    
    return users;
  } catch (error) {
    console.error('Error getting all users with roles:', error);
    throw error;
  }
}

/**
 * Get users with a specific role
 */
export async function getUsersWithRole(role: UserRole): Promise<UserWithRoles[]> {
  try {
    const usersSnapshot = await getDocs(
      query(
        collection(db, USERS_COLLECTION),
        where('roles', 'array-contains', role)
      )
    );
    
    const users: UserWithRoles[] = [];
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        displayName: data.displayName || 'משתמש',
        email: data.email || '',
        photoURL: data.photoURL || null,
        roles: data.roles || [],
        isAdmin: data.isAdmin === true,
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error getting users with role:', error);
    throw error;
  }
}

/**
 * Search users by name or email
 */
export async function searchUsers(searchQuery: string): Promise<UserWithRoles[]> {
  try {
    const allUsers = await getAllUsersWithRoles();
    const query = searchQuery.toLowerCase();
    
    return allUsers.filter(user => 
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}
