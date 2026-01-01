/**
 * @fileoverview Competition System Constants
 * @description Scoring rules, default settings, and constants for competitions
 */

import { CompetitionSettings, ScoringConfig } from './types';

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
 * Get default settings by format
 */
export function getDefaultSettingsForFormat(format: string): CompetitionSettings {
  switch (format) {
    case 'national_league':
      return { ...NATIONAL_LEAGUE_SETTINGS };
    case 'totemtition':
      return { ...TOTEMTITION_SETTINGS };
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
    icon: '🏅',
  },
  totemtition: {
    label: 'תחרוטוטם',
    labelEn: 'Totemtition',
    description: 'פורמט קהילתי - 1000 נקודות מתחלקות בין מי שסגר',
    icon: '🎯',
  },
  custom: {
    label: 'מותאם אישית',
    labelEn: 'Custom',
    description: 'הגדר את חוקי התחרות בעצמך',
    icon: '⚙️',
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
  return `${points.toLocaleString('he-IL')} נק'`;
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
