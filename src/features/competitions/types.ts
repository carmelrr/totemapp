/**
 * @fileoverview Competition System Types
 * @description TypeScript types and interfaces for the competition system
 */

// =============== Enums & Constants ===============

export type CompetitionFormat = 'national_league' | 'totemtition' | 'custom' | 'custom_points' | 'ifsc_points';
export type ResultsEntryMode = 'selfEntry' | 'judgesOnly';
export type RegistrationMode = 'openRegistration' | 'adminsOrJudgesOnly';
export type CompetitionStatus = 'draft' | 'upcoming' | 'active' | 'closed' | 'completed' | 'cancelled';
export type RegistrationStatus = 'closed' | 'open';
export type RoundStatus = 'pending' | 'active' | 'completed';
export type ParticipantStatus = 'not_registered' | 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
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
  registrationStatus?: RegistrationStatus;  // For Totemtition - registration open/closed
  registrationStartDate?: Date;              // When registration opens
  registrationEndDate?: Date;                // When registration closes
  resultsVisible?: boolean;                  // Whether results are visible to non-admin users
  startDate: Date;
  endDate: Date;
  rounds?: Round[];
  settings: CompetitionSettings;
  wallImageUrl?: string;
  roomId?: string;                           // Wall editor room ID for the dynamic map
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

  // New format settings (custom_points / ifsc_points)
  resultsEntryMode?: ResultsEntryMode;       // who enters results
  registrationMode?: RegistrationMode;       // who can register
  enableZone?: boolean;                      // whether Zone is tracked
  defaultPointsTop?: number;                 // default Top points per route (e.g., 25)
  defaultPointsZone?: number;                // default Zone points per route (e.g., 10)
  attemptPenaltyZone?: number;               // penalty per zone attempt (e.g., 0.1)
  attemptPenaltyTop?: number;                // penalty per top attempt (e.g., 0.01)
  freeFirstAttempt?: boolean;                // if true, penalty = (attempts - 1)
  separateTopZonePenalty?: boolean;           // if true, top penalty is on (At - Az) not (At - 1)
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
  color?: string;                       // route color (hex, e.g., '#FF0000')
  isActive: boolean;
  setBy?: string;                       // who set the route
  createdAt: Date;
  createdBy?: string;

  // Per-route scoring overrides (custom_points format)
  pointsTop?: number;                   // custom top points for this route
  pointsZone?: number;                  // custom zone points for this route
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

export type Gender = 'male' | 'female';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

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
  photoURL?: string;                    // profile picture URL
  
  // Category assignment fields
  gender?: Gender;                      // male/female - required for category assignment
  birthYear?: number;                   // e.g., 1995 - required for category assignment
  skillLevel?: SkillLevel;              // optional skill level override
  
  category?: string;                    // auto-assigned category ID
  categoryName?: string;                // denormalized for display
  status: ParticipantStatus;            // pending, approved, rejected
  registeredAt: Date;
  registeredBy: string;                 // judge/admin who registered
  isActive: boolean;
}

/**
 * Competition category (age group, gender, skill level)
 * Categories can be defined with rules for automatic participant assignment
 */
export interface Category {
  id: string;
  competitionId?: string;
  name: string;                         // e.g., "נשים 16-18", "גברים מתקדמים"
  description?: string;
  
  // Category rules for auto-assignment
  gender?: Gender;                      // 'male' | 'female' - null means both
  minAge?: number;                      // e.g., 16 (minimum age for category)
  maxAge?: number;                      // e.g., 18 (maximum age for category)
  skillLevels?: SkillLevel[];           // if specified, only these skill levels qualify
  isProCategory?: boolean;              // true = advanced/pro category (optional override)
  
  // Legacy fields (kept for backward compatibility)
  type?: 'age' | 'gender' | 'skill';
  value?: string;
  minBirthYear?: number;                // @deprecated - use minAge/maxAge instead
  maxBirthYear?: number;                // @deprecated - use minAge/maxAge instead
  
  order?: number;                       // display order
  participantCount?: number;            // cached count of participants
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

  // Zone/Top fields for IFSC & custom_points formats
  topAchieved?: boolean;                // did the climber top the route?
  topAttempt?: number;                  // attempt number top was achieved (1-based)
  zoneAchieved?: boolean;               // did the climber reach zone?
  zoneAttempt?: number;                 // attempt number zone was achieved (1-based)
}

/**
 * Participant's complete results
 */
export interface ParticipantResult {
  id?: string;
  competitionId: string;
  participantId: string;
  participantName?: string;
  userName?: string;                    // alias for participantName
  photoURL?: string | null;             // profile picture URL
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
  photoURL?: string | null;             // profile picture URL
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
 * Scoring configuration (national_league)
 */
export interface ScoringConfig {
  gradePoints: Record<string, number>;  // V0: 100, V1: 200, etc.
  attemptPenalty: number;               // points deducted per extra attempt
  topRoutesCount: number;               // how many routes count for final score
  maxAttempts: number;                  // max attempts per route
}

/**
 * Per-route scoring config for custom_points format
 * Stored in each CompetitionRoute document
 */
export interface RoutePointsConfig {
  pointsTop: number;                    // e.g., 25
  pointsZone: number;                   // e.g., 10, or 0 if no zone
}

/**
 * IFSC / custom_points scoring config (competition-level)
 */
export interface ZoneTopScoringConfig {
  defaultPointsTop: number;             // 25 for IFSC
  defaultPointsZone: number;            // 10 for IFSC
  enableZone: boolean;
  attemptPenaltyZone: number;           // 0.1 for IFSC
  attemptPenaltyTop: number;            // 0.01 for separate penalty, 0.1 for standard IFSC
  freeFirstAttempt: boolean;            // penalty on (attempts - 1)
  separateTopZonePenalty: boolean;      // top penalty relative to zone attempt
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
