/**
 * @fileoverview Competition System Constants
 * @description Scoring rules, default settings, and constants for competitions
 */

import { CompetitionSettings, ScoringConfig, ZoneTopScoringConfig } from './types';

// =============== Grade Points (National League) ===============

/**
 * Points per grade in National League format
 * V0 = 100, V1 = 200, ... V8 = 900
 */
export const NATIONAL_LEAGUE_GRADE_POINTS: Record<string, number> = {
  'VB': 50,   // Beginner grade (optional)
  'V0': 100,
  'V1': 200,
  'V2': 300,
  'V3': 400,
  'V4': 500,
  'V5': 600,
  'V6': 700,
  'V7': 800,
  'V8': 900,
  'V9': 1000,  // Extended grades (if needed)
  'V10': 1100,
};

/**
 * All valid grades for competition routes
 */
export const COMPETITION_GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'
] as const;

export type CompetitionGrade = typeof COMPETITION_GRADES[number];

// =============== Default Settings ===============

/**
 * Default settings for National League format
 */
export const NATIONAL_LEAGUE_SETTINGS: CompetitionSettings = {
  maxRoutes: 30,
  maxAttempts: 5,
  topRoutesForScoring: 7,       // TOP7 scoring
  attemptPenalty: 10,           // -10 points per extra attempt
  allowSelfEntry: false,        // Judges only
  judgesOnly: true,
  enableCategories: true,
  enableRounds: false,
};

/**
 * Default settings for Totemtition format
 */
export const TOTEMTITION_SETTINGS: CompetitionSettings = {
  maxRoutes: 20,
  maxAttempts: 999,             // Unlimited attempts
  topRoutesForScoring: 999,     // All routes count
  attemptPenalty: 0,            // No penalty
  allowSelfEntry: true,         // Self-reporting allowed
  judgesOnly: false,
  enableCategories: false,
  enableRounds: false,
  basePointsPerRoute: 1000,     // Points pool per route
};

/**
 * Default settings for Custom format
 */
export const CUSTOM_FORMAT_SETTINGS: CompetitionSettings = {
  maxRoutes: 30,
  maxAttempts: 5,
  topRoutesForScoring: 10,
  attemptPenalty: 5,
  allowSelfEntry: false,
  judgesOnly: true,
  enableCategories: true,
  enableRounds: false,
};

/**
 * Default settings for Zone/Top format (Zone + Top scoring with configurable penalties)
 */
export const ZONE_TOP_SETTINGS: CompetitionSettings = {
  maxRoutes: 20,
  maxAttempts: 10,
  topRoutesForScoring: 999,          // all routes count by default
  attemptPenalty: 0,                 // uses zone/top penalties instead
  allowSelfEntry: false,
  judgesOnly: true,
  enableCategories: true,
  enableRounds: false,
  resultsEntryMode: 'judgesOnly',
  registrationMode: 'openRegistration',
  enableZone: true,
  defaultPointsTop: 25,
  defaultPointsZone: 10,
  attemptPenaltyZone: 0.1,
  attemptPenaltyTop: 0.1,
  freeFirstAttempt: true,
  separateTopZonePenalty: false,
};

/**
 * Get default settings by format
 */
export function getDefaultSettingsForFormat(format: string): CompetitionSettings {
  switch (format) {
    case 'national_league':
      return { ...NATIONAL_LEAGUE_SETTINGS };
    case 'totemtition':
      return { ...TOTEMTITION_SETTINGS };
    case 'zone_top':
      return { ...ZONE_TOP_SETTINGS };
    case 'custom':
    default:
      return { ...CUSTOM_FORMAT_SETTINGS };
  }
}

// =============== Scoring Configuration ===============

/**
 * National League scoring configuration
 */
export const NATIONAL_LEAGUE_SCORING: ScoringConfig = {
  gradePoints: NATIONAL_LEAGUE_GRADE_POINTS,
  attemptPenalty: 10,
  topRoutesCount: 7,
  maxAttempts: 5,
};

// =============== UI Constants ===============

/**
 * Competition status display info
 */
export const COMPETITION_STATUS_INFO = {
  draft: {
    label: 'טיוטה',
    labelEn: 'Draft',
    color: '#6b7280',  // gray
    icon: '📝',
  },
  upcoming: {
    label: 'פתוח להרשמה',
    labelEn: 'Upcoming',
    color: '#3b82f6',  // blue
    icon: '📅',
  },
  active: {
    label: 'פעיל',
    labelEn: 'Active',
    color: '#10b981',  // green
    icon: '🔥',
  },
  closed: {
    label: 'סגור להזנה',
    labelEn: 'Closed',
    color: '#f59e0b',  // amber
    icon: '🔒',
  },
  completed: {
    label: 'הסתיים',
    labelEn: 'Completed',
    color: '#6366f1',  // indigo
    icon: '🏆',
  },
  cancelled: {
    label: 'בוטל',
    labelEn: 'Cancelled',
    color: '#ef4444',  // red
    icon: '❌',
  },
} as const;

/**
 * Competition format display info
 */
export const COMPETITION_FORMAT_INFO = {
  national_league: {
    label: 'ליגה ארצית',
    labelEn: 'National League',
    description: 'פורמט רשמי עם TOP7 וניקוד לפי דירוג וניסיונות',
    descriptionEn: 'Official format with TOP7 scoring by grade and attempts',
    icon: '🏅',
  },
  totemtition: {
    label: 'תחרוטוטם',
    labelEn: 'Totemtition',
    description: 'פורמט קהילתי - 1000 נקודות מתחלקות בין מי שסגר',
    descriptionEn: 'Community format - 1000 points shared among completers',
    icon: '🎯',
  },
  custom: {
    label: 'מותאם אישית',
    labelEn: 'Custom',
    description: 'הגדר את חוקי התחרות בעצמך',
    descriptionEn: 'Define competition rules yourself',
    icon: '⚙️',
  },
  zone_top: {
    label: 'Zone / Top',
    labelEn: 'Zone / Top',
    description: 'ניקוד Zone ו-Top לכל מסלול, עם קנסות ניסיונות. ניתן להגדיר ניקוד שונה לכל מסלול.',
    descriptionEn: 'Zone & Top scoring per route with attempt penalties. Per-route points are customizable.',
    icon: '🏆',
  },
} as const;

/**
 * Default categories
 */
export const DEFAULT_CATEGORIES = [
  { id: 'men', name: 'גברים', nameEn: 'Men' },
  { id: 'women', name: 'נשים', nameEn: 'Women' },
  { id: 'youth_male', name: 'נוער בנים', nameEn: 'Youth Male' },
  { id: 'youth_female', name: 'נוער בנות', nameEn: 'Youth Female' },
  { id: 'kids_male', name: 'ילדים בנים', nameEn: 'Kids Male' },
  { id: 'kids_female', name: 'ילדות בנות', nameEn: 'Kids Female' },
  { id: 'masters', name: 'מאסטרס 40+', nameEn: 'Masters 40+' },
] as const;

// =============== Calculation Functions ===============

/**
 * Calculate points for a completed route
 * @param grade - Route grade (V0-V8)
 * @param attempts - Number of attempts (1-5)
 * @param config - Scoring configuration
 * @returns Points earned for the route
 */
export function calculateRoutePoints(
  grade: string,
  attempts: number,
  config: ScoringConfig = NATIONAL_LEAGUE_SCORING
): number {
  const basePoints = config.gradePoints[grade] || 0;
  const penalty = Math.max(0, attempts - 1) * config.attemptPenalty;
  return Math.max(0, basePoints - penalty);
}

/**
 * Calculate TOP N points from route results
 * @param routePoints - Array of points for each completed route
 * @param topN - Number of top routes to count
 * @returns Sum of top N points
 */
export function calculateTopNPoints(
  routePoints: number[],
  topN: number = 7
): number {
  // Sort descending and take top N
  const sorted = [...routePoints].sort((a, b) => b - a);
  const topRoutes = sorted.slice(0, topN);
  return topRoutes.reduce((sum, points) => sum + points, 0);
}

/**
 * Calculate Totemtition points for a route
 * @param totalPool - Total points in pool (e.g., 1000)
 * @param completionCount - Number of climbers who completed
 * @returns Points per climber
 */
export function calculateTotemtitionPoints(
  totalPool: number,
  completionCount: number
): number {
  if (completionCount <= 0) return 0;
  return Math.floor(totalPool / completionCount);
}

/**
 * Get points display string
 * @param points - Number of points
 * @returns Formatted string (e.g., "720 נק'")
 */
export function formatPoints(points: number): string {
  // Show decimals for zone/top scores, whole numbers for others
  if (points % 1 !== 0) {
    return `${points.toFixed(2)} נק'`;
  }
  return `${points.toLocaleString('he-IL')} נק'`;
}

/**
 * Format IFSC-style result string: "4T4z 4 4"
 * tops T zones z totalTopAttempts totalZoneAttempts
 */
export function formatIFSCResult(
  tops: number,
  zones: number,
  topAttempts: number,
  zoneAttempts: number
): string {
  return `${tops}T${zones}z ${topAttempts} ${zoneAttempts}`;
}

/**
 * Get grade base points
 * @param grade - Route grade
 * @returns Base points for the grade
 */
export function getGradeBasePoints(grade: string): number {
  return NATIONAL_LEAGUE_GRADE_POINTS[grade] || 0;
}

// =============== Validation ===============

/**
 * Validate attempts count
 */
export function isValidAttempts(attempts: number, maxAttempts: number): boolean {
  return Number.isInteger(attempts) && attempts >= 1 && attempts <= maxAttempts;
}

/**
 * Validate grade
 */
export function isValidCompetitionGrade(grade: string): boolean {
  return COMPETITION_GRADES.includes(grade as CompetitionGrade);
}

// =============== Zone/Top Scoring ===============

/**
 * Default Zone/Top scoring configuration
 */
export const ZONE_TOP_SCORING_CONFIG: ZoneTopScoringConfig = {
  defaultPointsTop: 25,
  defaultPointsZone: 10,
  enableZone: true,
  attemptPenaltyZone: 0.1,
  attemptPenaltyTop: 0.1,
  freeFirstAttempt: true,
  separateTopZonePenalty: false,
};

/**
 * Build ZoneTopScoringConfig from competition settings
 */
export function buildZoneTopScoringConfig(settings: CompetitionSettings): ZoneTopScoringConfig {
  return {
    defaultPointsTop: settings.defaultPointsTop ?? 25,
    defaultPointsZone: settings.defaultPointsZone ?? 10,
    enableZone: settings.enableZone ?? true,
    attemptPenaltyZone: settings.attemptPenaltyZone ?? 0.1,
    attemptPenaltyTop: settings.attemptPenaltyTop ?? 0.01,
    freeFirstAttempt: settings.freeFirstAttempt ?? true,
    separateTopZonePenalty: settings.separateTopZonePenalty ?? true,
  };
}

/**
 * Calculate points for a single route in Zone/Top format.
 * 
 * All calculations use integer math internally (x1000) to avoid floating-point drift.
 * The returned value is a decimal (e.g., 24.78).
 * 
 * @param params.topAchieved   - Did the climber top the route?
 * @param params.topAttempt    - Attempt number top was achieved (1-based)
 * @param params.zoneAchieved  - Did the climber reach zone?
 * @param params.zoneAttempt   - Attempt number zone was achieved (1-based)
 * @param params.pointsTop     - Points for topping (per-route override or default)
 * @param params.pointsZone    - Points for zone (per-route override or default)
 * @param config               - Scoring configuration
 * @returns Score for this route (clamped to >= 0)
 */
export function calculateZoneTopRoutePoints(
  params: {
    topAchieved: boolean;
    topAttempt?: number;
    zoneAchieved: boolean;
    zoneAttempt?: number;
    pointsTop: number;
    pointsZone: number;
  },
  config: ZoneTopScoringConfig
): number {
  const { topAchieved, zoneAchieved } = params;
  const SCALE = 1000; // internal integer math

  // Nothing achieved → 0
  if (!topAchieved && !zoneAchieved) return 0;

  const freeOffset = config.freeFirstAttempt ? 1 : 0;

  if (topAchieved) {
    const At = params.topAttempt ?? 1;
    // If zone achieved: use zoneAttempt, otherwise default to topAttempt
    const Az = params.zoneAchieved ? (params.zoneAttempt ?? At) : At;

    const baseTop = Math.round(params.pointsTop * SCALE);

    if (config.separateTopZonePenalty) {
      // Enhanced: score = pointsTop - penaltyZone*(Az-1) - penaltyTop*(At-Az)
      const zonePenaltyExtraAttempts = Math.max(0, Az - freeOffset);
      const topPenaltyExtraAttempts = Math.max(0, At - Az);
      const penaltyZone = Math.round(config.attemptPenaltyZone * SCALE) * zonePenaltyExtraAttempts;
      const penaltyTop = Math.round(config.attemptPenaltyTop * SCALE) * topPenaltyExtraAttempts;
      return Math.max(0, (baseTop - penaltyZone - penaltyTop) / SCALE);
    } else {
      // Standard IFSC: score = pointsTop - penaltyTop*(At-1)
      const extraAttempts = Math.max(0, At - freeOffset);
      const penalty = Math.round(config.attemptPenaltyTop * SCALE) * extraAttempts;
      return Math.max(0, (baseTop - penalty) / SCALE);
    }
  }

  // Zone only
  if (zoneAchieved) {
    const Az = params.zoneAttempt ?? 1;
    const baseZone = Math.round(params.pointsZone * SCALE);
    const extraAttempts = Math.max(0, Az - freeOffset);
    const penalty = Math.round(config.attemptPenaltyZone * SCALE) * extraAttempts;
    return Math.max(0, (baseZone - penalty) / SCALE);
  }

  return 0;
}

/**
 * Check if a competition format uses Zone/Top scoring
 */
export function isZoneTopFormat(format: string): boolean {
  return format === 'zone_top';
}
