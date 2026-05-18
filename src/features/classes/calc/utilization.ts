/**
 * @fileoverview Utilization calculations: how many groups occupy each
 * location at any moment, peak concurrency and wall-meter peak load.
 */

import type {
  ClassGroup,
  ClassLocation,
  ClassSession,
  ClassSettings,
  DayOfWeek,
} from "../types";
import { groupRequiredWallMeters } from "./economics";

export interface UtilizationPoint {
  dayOfWeek: DayOfWeek;
  atMinutes: number;
  concurrentGroups: number;
  totalMeters: number;
}

/**
 * Build a list of "transition" timestamps and aggregate metrics at each one
 * for a given location. This is an O(n log n) sweep-line.
 */
export function locationUtilizationTimeline(
  locationId: string,
  sessions: ClassSession[],
  groups: ClassGroup[],
  settings: ClassSettings,
): UtilizationPoint[] {
  const groupsById = new Map<string, ClassGroup>();
  for (const g of groups) if (g.id) groupsById.set(g.id, g);

  const here = sessions.filter((s) => s.locationId === locationId);

  // events: at each session start +1 / +meters, at end -1 / -meters
  type Ev = { day: DayOfWeek; min: number; dGroups: number; dMeters: number };
  const events: Ev[] = [];
  for (const s of here) {
    const g = groupsById.get(s.groupId);
    if (!g) continue;
    const m = groupRequiredWallMeters(g, settings);
    events.push({
      day: s.dayOfWeek,
      min: s.startMinutes,
      dGroups: 1,
      dMeters: m,
    });
    events.push({
      day: s.dayOfWeek,
      min: s.endMinutes,
      dGroups: -1,
      dMeters: -m,
    });
  }

  events.sort((a, b) => (a.day - b.day) || (a.min - b.min));

  const out: UtilizationPoint[] = [];
  let curGroups = 0;
  let curMeters = 0;
  let curDay: DayOfWeek | null = null;

  for (const ev of events) {
    if (ev.day !== curDay) {
      curGroups = 0;
      curMeters = 0;
      curDay = ev.day;
    }
    curGroups += ev.dGroups;
    curMeters += ev.dMeters;
    out.push({
      dayOfWeek: ev.day,
      atMinutes: ev.min,
      concurrentGroups: curGroups,
      totalMeters: curMeters,
    });
  }
  return out;
}

/**
 * Peak concurrent groups at a location (across the whole week).
 */
export function locationPeakConcurrent(
  location: ClassLocation,
  sessions: ClassSession[],
  groups: ClassGroup[],
  settings: ClassSettings,
): { peak: number; peakMeters: number } {
  const timeline = locationUtilizationTimeline(
    location.id!,
    sessions,
    groups,
    settings,
  );
  let peak = 0;
  let peakMeters = 0;
  for (const p of timeline) {
    if (p.concurrentGroups > peak) peak = p.concurrentGroups;
    if (p.totalMeters > peakMeters) peakMeters = p.totalMeters;
  }
  return { peak, peakMeters };
}

/**
 * Weekly used hours at a location (sum of session durations).
 */
export function locationWeeklyHours(
  location: ClassLocation,
  sessions: ClassSession[],
): number {
  let total = 0;
  for (const s of sessions) {
    if (s.locationId !== location.id) continue;
    total += Math.max(0, s.endMinutes - s.startMinutes) / 60;
  }
  return total;
}

/**
 * Wall-meter utilization ratio (peakMeters / usableLengthMeters).
 * Returns 0 when location has no usable length defined.
 */
export function wallMetersUtilization(
  location: ClassLocation,
  sessions: ClassSession[],
  groups: ClassGroup[],
  settings: ClassSettings,
): number {
  if (location.usableLengthMeters <= 0) return 0;
  const { peakMeters } = locationPeakConcurrent(
    location,
    sessions,
    groups,
    settings,
  );
  return peakMeters / location.usableLengthMeters;
}
