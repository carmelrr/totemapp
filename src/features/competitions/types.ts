/**
 * @fileoverview Competition System Types
 * @description TypeScript types and interfaces for the competition system
 */

// =============== Enums & Constants ===============

export type CompetitionFormat = 'national_league' | 'totemtition' | 'custom';
export type CompetitionStatus = 'draft' | 'upcoming' | 'active' | 'closed' | 'completed' | 'cancelled';
export type RoundStatus = 'pending' | 'active' | 'completed';
export type ParticipantStatus = 'pending' | 'approved' | 'rejected';
export type JudgeRole = 'judge' | 'head_judge';

// =============== Main Competition Types ===============

/**
 * Main Competition document
 */
export interface Competition {
  id: string;
  name: string;
  description?: string;
  format: CompetitionFormat;
  status: CompetitionStatus;
  startDate: Date;
  endDate: Date;
  rounds?: Round[];
  settings: CompetitionSettings;
  wallImageUrl?: string;
  categories?: Category[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Competition settings - configurable per format
 */
export interface CompetitionSettings {
  maxRoutes: number;                    // 30 for national league
  maxAttempts: number;                  // 5 for national league
  topRoutesForScoring: number;          // 7 for national league (TOP7)
  attemptPenalty: number;               // 10 points for national league
  allowSelfEntry: boolean;              // false for national league
  judgesOnly: boolean;                  // true for national league
  enableCategories: boolean;
  enableRounds: boolean;
  
  // Totemtition specific
  basePointsPerRoute?: number;          // 1000 for totemtition
}

/**
 * Competition round (e.g., heats, semi-finals, finals)
 */
export interface Round {
  id: string;
  name: string;
  order: number;
  startTime: Date;
  endTime: Date;
  status: RoundStatus;
}

// =============== Route Types ===============

/**
 * Competition route (on the wall map)
 */
export interface CompetitionRoute {
  id: string;
  competitionId: string;
  routeNumber: number;                  // 1-30 display number
  number?: number;                      // alias for routeNumber
  grade: string;                        // V0-V8
  basePoints: number;                   // 100-900 for national league
  xNorm?: number;                       // normalized X coordinate (0-1)
  yNorm?: number;                       // normalized Y coordinate (0-1)
  isActive: boolean;
  setBy?: string;                       // who set the route
  createdAt: Date;
  createdBy?: string;
}

/**
 * Totemtition route - extends base with dynamic scoring
 */
export interface TotemtitionRoute extends CompetitionRoute {
  totalPoolPoints: number;              // 1000 initial
  completionCount: number;              // how many climbers completed
  currentPointsPerCompletion: number;   // 1000 / completionCount
}

// =============== Participant Types ===============

/**
 * Competition participant
 */
export interface Participant {
  id: string;
  competitionId: string;
  name: string;
  userName?: string;                    // alias for name
  idNumber?: string;                    // ת.ז. (optional)
  userId?: string;                      // linked app user (optional)
  email?: string;
  phone?: string;
  category?: string;                    // category ID
  categoryName?: string;                // denormalized for display
  status: ParticipantStatus;            // pending, approved, rejected
  registeredAt: Date;
  registeredBy: string;                 // judge/admin who registered
  isActive: boolean;
}

/**
 * Competition category (age group, gender, skill level)
 */
export interface Category {
  id: string;
  competitionId?: string;
  name: string;
  description?: string;
  type?: 'age' | 'gender' | 'skill';
  value?: string;
  minAge?: number;
  maxAge?: number;
  order?: number;
  participantCount?: number;
}

// =============== Results Types ===============

/**
 * Single route result for a participant
 */
export interface RouteResult {
  routeNumber: number;
  routeId: string;
  completed: boolean;
  attempts: number;                     // 1-5
  points: number;                       // calculated: basePoints - (attempts-1)*penalty
  zone?: boolean;                       // for lead climbing (future)
  enteredBy: string;                    // judge userId
  enteredAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
}

/**
 * Participant's complete results
 */
export interface ParticipantResult {
  id?: string;
  competitionId: string;
  participantId: string;
  participantName?: string;
  category?: string;
  categoryName?: string;
  routes: RouteResult[] | Record<number, RouteResult>;  // routeNumber -> result OR array
  routesCompleted?: number;
  totalPoints: number;                  // sum of all points
  totalAttempts?: number;               // sum of all attempts
  top7Points?: number;                  // sum of best 7 routes (for national league)
  rank?: number;                        // calculated rank in competition
  categoryRank?: number;                // rank within category
  lastUpdated: Date;
  updatedBy?: string;
}

// =============== Leaderboard Types ===============

/**
 * Leaderboard entry for display
 */
export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  participantName?: string;
  userName?: string;                    // alias for participantName
  userId?: string;                      // if linked to app user
  points?: number;
  totalPoints?: number;                 // alias for points
  routesCompleted: number;
  totalAttempts?: number;
  category?: string;
  categoryName?: string;
  isCurrentUser?: boolean;              // highlight if viewing user
}

/**
 * Leaderboard with metadata
 */
export interface Leaderboard {
  competitionId: string;
  category?: string;                    // null for overall
  entries: LeaderboardEntry[];
  lastUpdated: Date;
  totalParticipants: number;
}

// =============== Judge Types ===============

/**
 * Competition judge
 */
export interface Judge {
  id: string;
  competitionId: string;
  userId: string;
  displayName?: string;
  userName?: string;                    // alias for displayName
  email?: string;
  role?: JudgeRole;                     // 'judge' or 'head'
  permissions: JudgePermissions;
  addedBy: string;
  addedAt: Date;
}

/**
 * Judge permissions
 */
export interface JudgePermissions {
  canEnterResults: boolean;
  canEditResults: boolean;
  canAddParticipants: boolean;
  canEditParticipants: boolean;
  canManageCategories: boolean;
}

// =============== Admin Types ===============

/**
 * Competition creation/update payload
 */
export interface CompetitionCreateData {
  name: string;
  description?: string;
  format: CompetitionFormat;
  startDate: Date;
  endDate: Date;
  settings: Partial<CompetitionSettings>;
  wallImageUrl?: string;
}

export interface CompetitionUpdateData extends Partial<CompetitionCreateData> {
  status?: CompetitionStatus;
}

// =============== Scoring Types ===============

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  gradePoints: Record<string, number>;  // V0: 100, V1: 200, etc.
  attemptPenalty: number;               // points deducted per extra attempt
  topRoutesCount: number;               // how many routes count for final score
  maxAttempts: number;                  // max attempts per route
}

// =============== Filter & Sort Types ===============

export type LeaderboardSortField = 'rank' | 'points' | 'routesCompleted' | 'name';
export type SortDirection = 'asc' | 'desc';

export interface LeaderboardFilter {
  category?: string;
  search?: string;
  roundId?: string;
}

export interface LeaderboardSort {
  field: LeaderboardSortField;
  direction: SortDirection;
}

// =============== Event Types ===============

/**
 * Competition events for real-time updates
 */
export type CompetitionEventType = 
  | 'result_added'
  | 'result_updated'
  | 'participant_added'
  | 'competition_started'
  | 'competition_ended'
  | 'round_started'
  | 'round_ended';

export interface CompetitionEvent {
  type: CompetitionEventType;
  competitionId: string;
  timestamp: Date;
  data: Record<string, any>;
}
