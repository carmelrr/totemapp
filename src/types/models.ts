/**
 * @fileoverview Unified Data Models - Type definitions matching TopLogger's API structure
 * @description Centralized type definitions for the entire application
 * Follows TopLogger's patterns:
 * - Clear entity types (Gym, Climb, User, Ascent)
 * - Consistent naming conventions
 * - Statistics and ranking types
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Core Entity Types (matching TopLogger pattern)
// ============================================

/**
 * Gym/Wall entity - equivalent to TopLogger's gym endpoint
 */
export interface Gym {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  width: number;  // Wall dimensions for topo map
  height: number;
  isPublic: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  settings?: GymSettings;
  createdAt: Timestamp | Date;
  createdBy: string;
  updatedAt?: Timestamp | Date;
}

export interface GymSettings {
  allowPublicRoutes: boolean;
  requireApproval: boolean;
  defaultGradeSystem: GradeSystem;
  supportedGradeSystems: GradeSystem[];
}

export type GradeSystem = 'v-scale' | 'font' | 'yds' | 'french';

/**
 * Route/Climb entity - equivalent to TopLogger's climb endpoint
 */
export interface Route {
  id: string;
  gymId?: string;  // Optional for walls with single gym
  name: string;
  grade: string;           // Original grade set by setter
  calculatedGrade?: string; // Community consensus grade
  color: string;           // Hex color for display
  
  // Position on topo map (normalized 0-1)
  xNorm: number;
  yNorm: number;
  
  // Metadata
  setter?: string;
  setDate?: Timestamp | Date;
  stripDate?: Timestamp | Date;  // Date route will be removed
  status: RouteStatus;
  type: RouteType;
  tags: string[];
  description?: string;
  
  // Statistics (computed from feedback)
  stats: RouteStats;
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export type RouteStatus = 'active' | 'archived' | 'draft' | 'scheduled';
export type RouteType = 'boulder' | 'lead' | 'toprope';

export interface RouteStats {
  averageStarRating: number;    // 1-5 scale
  ratingCount: number;
  feedbackCount: number;
  completionCount: number;      // Number of users who topped
  attemptCount: number;         // Number of attempts logged
  flashCount: number;           // Number of flashes
  repeatCount: number;          // Number of repeat sends
}

/**
 * User entity - equivalent to TopLogger's user
 */
export interface User {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isAdmin: boolean;
  
  // Profile settings
  preferences: UserPreferences;
  
  // Stats (computed)
  stats: UserStats;
  
  // Privacy
  privacySettings: PrivacySettings;
  
  // Timestamps
  createdAt: Timestamp | Date;
  lastActiveAt?: Timestamp | Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'he' | 'en' | 'es' | 'fr' | 'de';
  units: 'metric' | 'imperial';
  defaultGradeSystem: GradeSystem;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  newRoutes: boolean;
  achievements: boolean;
  comments: boolean;
  rankings: boolean;
}

export interface PrivacySettings {
  showProfile: boolean;
  showStats: boolean;
  showAscents: boolean;
}

export interface UserStats {
  totalRoutesSent: number;
  totalAttempts: number;
  highestGrade: string;
  averageGrade: string;
  totalFeedbacks: number;
  averageStarRating: number;
  flashRate: number;           // Percentage of flashes
  completionRate: number;      // Percentage of routes completed
  activeStreak: number;        // Days in a row climbing
  totalDaysClimbed: number;
}

/**
 * Ascent/Log entity - equivalent to TopLogger's ascent
 * Records when a user completes a route
 */
export interface Ascent {
  id: string;
  userId: string;
  routeId: string;
  gymId?: string;
  
  // Ascent details
  type: AscentType;
  attempts: number;
  rating?: number;            // 1-5 star rating
  comment?: string;
  
  // Media
  mediaUrls?: string[];
  
  // Timestamps
  climbedAt: Timestamp | Date;
  createdAt: Timestamp | Date;
}

export type AscentType = 'flash' | 'send' | 'repeat' | 'project' | 'attempt';

/**
 * Feedback entity - detailed route feedback
 */
export interface Feedback {
  id: string;
  routeId: string;
  userId: string;
  
  // Feedback content
  starRating: number;         // 1-5
  suggestedGrade?: string;
  comment?: string;
  closedRoute: boolean;       // Whether user completed the route
  
  // Engagement
  likes?: number;
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  
  // Populated fields (from joins)
  user?: {
    displayName: string;
    photoURL?: string;
  };
}

// ============================================
// Ranking Types (TopLogger's ranked_users pattern)
// ============================================

export type RankingType = 'grade' | 'volume' | 'points' | 'streak';
export type ClimbsType = 'boulders' | 'routes' | 'all';

export interface RankedUser {
  rank: number;
  userId: string;
  displayName: string;
  photoURL?: string;
  
  // Ranking metrics
  score: number;
  maxGrade: string;
  routesCompleted: number;
  points: number;
  
  // Additional stats
  flashRate?: number;
  averageAttempts?: number;
}

export interface GymRankings {
  gymId: string;
  rankingType: RankingType;
  climbsType: ClimbsType;
  period?: RankingPeriod;
  users: RankedUser[];
  lastUpdated: Timestamp | Date;
}

export type RankingPeriod = 'week' | 'month' | 'season' | 'all-time';

// ============================================
// Filter and Sort Types
// ============================================

export interface RouteFilters {
  grades: string[];
  colors: string[];
  status: RouteStatus[];
  types: RouteType[];
  tags: string[];
  setters: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export type RouteSortBy = 
  | 'newest' 
  | 'oldest' 
  | 'grade-asc' 
  | 'grade-desc' 
  | 'rating' 
  | 'popularity' 
  | 'distance';

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// ============================================
// Event Types (for real-time updates)
// ============================================

export type EntityType = 'route' | 'user' | 'ascent' | 'feedback' | 'gym';
export type ChangeType = 'added' | 'modified' | 'removed';

export interface DataChangeEvent<T = any> {
  entityType: EntityType;
  changeType: ChangeType;
  id: string;
  data?: T;
  previousData?: T;
  timestamp: Timestamp | Date;
}

// ============================================
// Grade Utilities Types
// ============================================

export interface GradeInfo {
  display: string;
  numericValue: number;
  system: GradeSystem;
  color: string;  // For grade badge display
}

export const GRADE_ORDER: Record<string, number> = {
  'V0': 0, 'V1': 1, 'V2': 2, 'V3': 3, 'V4': 4,
  'V5': 5, 'V6': 6, 'V7': 7, 'V8': 8, 'V9': 9,
  'V10': 10, 'V11': 11, 'V12': 12, 'V13': 13, 'V14': 14, 'V15': 15, 'V16': 16,
};

// ============================================
// Legacy Compatibility Types
// ============================================

/**
 * RouteDoc - legacy type for backward compatibility
 * Maps to the new Route interface
 */
export interface RouteDoc {
  id: string;
  name: string;
  grade: string;
  color: string;
  xNorm: number;
  yNorm: number;
  createdAt: Timestamp | Date;
  status: RouteStatus;
  rating: number;
  tops: number;
  comments: number;
  setter?: string;
  tags?: string[];
  averageStarRating?: number;
  calculatedGrade?: string;
  feedbackCount?: number;
  completionCount?: number;
}

// Utility function to convert RouteDoc to Route
export function routeDocToRoute(doc: RouteDoc): Route {
  return {
    id: doc.id,
    name: doc.name,
    grade: doc.grade,
    calculatedGrade: doc.calculatedGrade,
    color: doc.color,
    xNorm: doc.xNorm,
    yNorm: doc.yNorm,
    status: doc.status,
    type: 'boulder', // Default
    tags: doc.tags || [],
    setter: doc.setter,
    createdAt: doc.createdAt,
    stats: {
      averageStarRating: doc.averageStarRating || 0,
      ratingCount: 0,
      feedbackCount: doc.feedbackCount || 0,
      completionCount: doc.completionCount || doc.tops || 0,
      attemptCount: 0,
      flashCount: 0,
      repeatCount: 0,
    },
  };
}

// Utility function to convert Route to RouteDoc
export function routeToRouteDoc(route: Route): RouteDoc {
  return {
    id: route.id,
    name: route.name,
    grade: route.grade,
    color: route.color,
    xNorm: route.xNorm,
    yNorm: route.yNorm,
    createdAt: route.createdAt,
    status: route.status,
    rating: route.stats.averageStarRating,
    tops: route.stats.completionCount,
    comments: route.stats.feedbackCount,
    setter: route.setter,
    tags: route.tags,
    averageStarRating: route.stats.averageStarRating,
    calculatedGrade: route.calculatedGrade,
    feedbackCount: route.stats.feedbackCount,
    completionCount: route.stats.completionCount,
  };
}
