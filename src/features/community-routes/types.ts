// src/features/community-routes/types.ts
// Types for Community Routes feature - temporary user-uploaded routes on real wall photos

import { Hold, HoldType } from '@/features/spraywall/types';

// Re-export hold types for convenience
export { Hold, HoldType, HOLD_TYPES } from '@/features/spraywall/types';

/**
 * Community Route - a temporary route created by a user on a real wall photo
 * Routes expire after 30 days and are automatically deleted
 */
export interface CommunityRoute {
  id?: string;
  
  // Image info
  imageUrl: string;           // URL to the uploaded wall photo
  imageWidth: number;         // Original image width
  imageHeight: number;        // Original image height
  
  // Route info
  name: string;
  description?: string;
  grade: string;              // V-grade (VB, V0, V1, etc.)
  holds: Hold[];              // Array of hold positions on the image
  
  // Location info (optional)
  gymName?: string;           // Name of the gym
  wallSection?: string;       // Section of the wall (e.g., "Left Side", "Overhang")
  
  // Creator info
  createdBy: string;          // User ID
  creatorName: string;        // Display name
  createdAt: any;             // Firestore Timestamp
  
  // Expiration
  expiresAt: any;             // Firestore Timestamp - 30 days after creation
  
  // Statistics
  viewCount?: number;         // How many times viewed
  likeCount?: number;         // Number of likes
  commentCount?: number;      // Number of comments
  
  // Tags for filtering
  tags?: string[];            // e.g., ["overhang", "crimpy", "slab"]
}

/**
 * Community Route Comment
 */
export interface CommunityRouteComment {
  id?: string;
  routeId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
}

/**
 * Community Route Like
 */
export interface CommunityRouteLike {
  routeId: string;
  userId: string;
  createdAt: any;
}

/**
 * Filter options for community routes list
 */
export interface CommunityRouteFilters {
  gymName?: string;
  minGrade?: string;
  maxGrade?: string;
  tags?: string[];
  sortBy: 'newest' | 'popular' | 'expiring-soon';
  createdByMe?: boolean;
}

/**
 * V-Scale grades for calculations
 */
export const V_GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 
  'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'
];

/**
 * Common route tags
 */
export const COMMON_TAGS = [
  'overhang',    // אוברהנג
  'slab',        // סלאב
  'vertical',    // אנכי
  'crimpy',      // קרימפי
  'juggy',       // ג׳אגים
  'sloper',      // סלופרים
  'pinch',       // פינצ׳ים
  'dynamic',     // דינמי
  'technical',   // טכני
  'powerful',    // כוחני
] as const;

export type RouteTag = typeof COMMON_TAGS[number];

/**
 * Duration in days before routes expire
 */
export const ROUTE_EXPIRATION_DAYS = 30;
