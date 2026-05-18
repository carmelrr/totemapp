/**
 * @fileoverview Type definitions for the Class Planning module (תכנון חוגים).
 *
 * The model strictly separates three concepts:
 *  - Program: pricing track / מסלול תשלום.
 *  - Group:   the economic unit (revenue counted ONCE per group, not per session).
 *  - Session: a single placement of a Group on the weekly board.
 *
 * Locations describe physical places in the gym (walls, kids area, etc.) with
 * lengths and capacity. Settings holds editable global knobs (weeksPerMonth,
 * employerCostMultiplier, defaultMetersPerParticipant, board hours, ...).
 */

import type { Timestamp } from "firebase/firestore";

/** Canonical group types. Used for color, validation, default meters/participant. */
export type GroupType =
  | "kids"
  | "beginner"
  | "advanced"
  | "team"
  | "reserve"
  | "achievement"
  | "youth_team"
  | "senior_team"
  | "adult";

/** Physical location categories. */
export type LocationType = "wall" | "kidsArea" | "trainingArea" | "other";

/** Required physical context for a group's session. */
export type RequiredLocationType = "wall" | "kidsArea";

/** Day index: 0 = Sunday … 6 = Saturday (matches JS Date.getDay()). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ===================== Settings =====================

export interface ClassSettings {
  /** Multiplier from weekly to monthly counts. Default 4.33. */
  weeksPerMonth: number;
  /** Employer cost multiplier (gross-to-cost). Default 1.35. */
  employerCostMultiplier: number;
  /** Default linear wall meters required per participant, by group type. */
  defaultMetersPerParticipant: Record<GroupType, number>;
  /** Default block color per group type. */
  groupTypeColors: Record<GroupType, string>;
  /** Display window for the board (minutes since midnight, 0..1440). */
  displayStartMinutes: number;
  displayEndMinutes: number;
  /** Smallest snap unit on the board, in minutes. */
  slotMinutes: number;
  /** Kids group soft bounds (used for warnings, never hard errors). */
  kidsMinPerGroup: number;
  kidsMaxPerGroup: number;
  /** Target gross margin used to color blocks (e.g. 0.3 = 30%). */
  targetMargin: number;
  updatedAt?: Timestamp;
}

/** Defaults used when a settings doc has not been created yet. */
export const DEFAULT_CLASS_SETTINGS: ClassSettings = {
  weeksPerMonth: 4.33,
  employerCostMultiplier: 1.35,
  defaultMetersPerParticipant: {
    kids: 1.0,
    beginner: 1.2,
    advanced: 1.5,
    team: 1.8,
    reserve: 1.8,
    achievement: 1.8,
    youth_team: 1.8,
    senior_team: 1.8,
    adult: 1.5,
  },
  groupTypeColors: {
    kids: "#F59E0B",
    beginner: "#22C55E",
    advanced: "#0EA5E9",
    team: "#8B5CF6",
    reserve: "#6366F1",
    achievement: "#EC4899",
    youth_team: "#A855F7",
    senior_team: "#7C3AED",
    adult: "#10B981",
  },
  displayStartMinutes: 14 * 60,
  displayEndMinutes: 22 * 60,
  slotMinutes: 30,
  kidsMinPerGroup: 6,
  kidsMaxPerGroup: 12,
  targetMargin: 0.3,
};

// ===================== Location =====================

export interface ClassLocation {
  id?: string;
  name: string;
  type: LocationType;
  lengthMeters: number;
  usableLengthMeters: number;
  maxParallelGroups: number;
  allowedGroupTypes: GroupType[];
  notes?: string;
  active: boolean;
  /** Display order on the board. */
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ===================== Program =====================

export interface ClassProgram {
  id?: string;
  name: string;
  defaultGroupType: GroupType;
  monthlyPricePerParticipant: number;
  defaultSessionsPerWeek: number;
  defaultSessionDurationHours: number;
  defaultCoachHourlyRate: number;
  includesMembership: boolean;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ===================== Group =====================

export interface ClassGroup {
  id?: string;
  name: string;
  programId: string | null;
  groupType: GroupType;
  participantsCount: number;
  capacity: number;
  monthlyPricePerParticipant: number;
  sessionsPerWeek: number;
  defaultSessionDurationHours: number;

  coachName?: string;
  coachHourlyRate: number;

  assistantEnabled: boolean;
  assistantHourlyRate: number;
  assistantHoursPerWeek: number;

  requiredLocationType: RequiredLocationType;
  /** Optional override in meters; otherwise computed from participants × default. */
  requiredWallMetersOverride?: number | null;

  /** Optional block color override (otherwise derived from groupType). */
  color?: string | null;

  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ===================== Session (placement) =====================

export interface ClassSession {
  id?: string;
  groupId: string;
  dayOfWeek: DayOfWeek;
  /** Minutes since midnight, inclusive. */
  startMinutes: number;
  /** Minutes since midnight, exclusive. */
  endMinutes: number;
  locationId: string;
  /** Optional coach override for this single placement (rarely used). */
  coachNameOverride?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ===================== Alerts =====================

export type AlertSeverity = "error" | "warning" | "info";

export type AlertCode =
  | "exceeds_parallel_capacity"
  | "exceeds_wall_length"
  | "kids_not_in_kids_area"
  | "regular_in_kids_area"
  | "disallowed_group_type"
  | "coach_double_booked"
  | "session_invalid_times"
  | "kids_below_minimum"
  | "kids_above_maximum"
  | "below_break_even";

export interface ClassAlert {
  code: AlertCode;
  severity: AlertSeverity;
  message: string;
  /** Optional context references. */
  sessionIds?: string[];
  groupIds?: string[];
  locationId?: string;
  /** Minute since midnight, when relevant (e.g. capacity hits). */
  atMinutes?: number;
  dayOfWeek?: DayOfWeek;
}

// ===================== Board view modes =====================

export type BoardViewMode =
  | "schedule"
  | "utilization"
  | "profitability"
  | "alerts";
