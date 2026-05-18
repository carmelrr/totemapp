/**
 * @fileoverview Constants for the Class Planning module — labels for group
 * types, days of the week, formatting helpers, and view-mode metadata.
 */

import type { BoardViewMode, DayOfWeek, GroupType } from "./types";

export const GROUP_TYPE_LABELS_HE: Record<GroupType, string> = {
  kids: "ילדים",
  beginner: "מתחילים",
  advanced: "מתקדמים",
  team: "נבחרת",
  reserve: "עתודה",
  achievement: "הישגית",
  youth_team: "נבחרת צעירה",
  senior_team: "נבחרת בוגרת",
  adult: "בוגרים",
};

export const GROUP_TYPE_LABELS_EN: Record<GroupType, string> = {
  kids: "Kids",
  beginner: "Beginners",
  advanced: "Advanced",
  team: "Team",
  reserve: "Reserve",
  achievement: "Achievement",
  youth_team: "Youth Team",
  senior_team: "Senior Team",
  adult: "Adults",
};

export const ALL_GROUP_TYPES: GroupType[] = [
  "kids",
  "beginner",
  "advanced",
  "team",
  "reserve",
  "achievement",
  "youth_team",
  "senior_team",
  "adult",
];

/** 0 = Sunday … 6 = Saturday. Hebrew labels. */
export const DAY_LABELS_HE: Record<DayOfWeek, string> = {
  0: "א'",
  1: "ב'",
  2: "ג'",
  3: "ד'",
  4: "ה'",
  5: "ו'",
  6: "ש'",
};

export const DAY_LABELS_EN: Record<DayOfWeek, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

export const VIEW_MODE_LABELS_HE: Record<BoardViewMode, string> = {
  schedule: "מערכת שעות",
  utilization: "עומס קירות",
  profitability: "רווחיות",
  alerts: "התראות",
};

export const VIEW_MODE_LABELS_EN: Record<BoardViewMode, string> = {
  schedule: "Schedule",
  utilization: "Wall Load",
  profitability: "Profitability",
  alerts: "Alerts",
};

/** Format minutes-since-midnight to "HH:MM". */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60, Math.floor(minutes)));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format ILS currency without trailing decimals when round. */
export function formatCurrencyIls(value: number): string {
  const rounded = Math.round(value);
  return `₪${rounded.toLocaleString("he-IL")}`;
}

/** Format a 0..1 ratio as a percent with no decimals. */
export function formatPercent(ratio: number): string {
  if (!isFinite(ratio)) return "—";
  return `${Math.round(ratio * 100)}%`;
}

/** Clamp to slot grid. */
export function snapToSlot(minutes: number, slotMinutes: number): number {
  if (slotMinutes <= 0) return minutes;
  return Math.round(minutes / slotMinutes) * slotMinutes;
}
