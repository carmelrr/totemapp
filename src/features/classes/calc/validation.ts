/**
 * @fileoverview Cross-entity validation: produces a list of `ClassAlert`s
 * for the current state. Pure function — feeds the alerts view + dashboard.
 *
 * The translator function `t` is injected so messages are produced in the
 * caller's language (Hebrew or English).
 */

import {
  type ClassAlert,
  type ClassGroup,
  type ClassLocation,
  type ClassSession,
  type ClassSettings,
} from "../types";
import {
  groupBreakEvenParticipants,
  groupRequiredWallMeters,
} from "./economics";
import { locationUtilizationTimeline } from "./utilization";

/**
 * Minimal translator interface — matches the relevant subset of
 * `t.classes.*` from features/language. We accept any object with those
 * fields so tests can pass a stub.
 */
export interface AlertTranslator {
  alertExceedsParallelCapacity: (loc: string) => string;
  alertExceedsWallLength: (loc: string) => string;
  alertKidsNotInKidsArea: (group: string) => string;
  alertRegularInKidsArea: (group: string) => string;
  alertDisallowedGroupType: (group: string, loc: string) => string;
  alertCoachDoubleBooked: (coach: string) => string;
  alertSessionInvalidTimes: string;
  alertKidsBelowMinimum: (group: string) => string;
  alertKidsAboveMaximum: (group: string) => string;
  alertBelowBreakEven: (group: string) => string;
}

export interface ValidationInput {
  settings: ClassSettings;
  locations: ClassLocation[];
  groups: ClassGroup[];
  sessions: ClassSession[];
  t: AlertTranslator;
}

/** Do two intervals on the same day overlap? Touching edges do NOT overlap. */
function overlaps(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function computeAlerts(input: ValidationInput): ClassAlert[] {
  const { settings, locations, groups, sessions, t } = input;
  const alerts: ClassAlert[] = [];

  const groupsById = new Map<string, ClassGroup>();
  for (const g of groups) if (g.id) groupsById.set(g.id, g);
  const locsById = new Map<string, ClassLocation>();
  for (const l of locations) if (l.id) locsById.set(l.id, l);

  // ── per-session sanity ─────────────────────────────────────────────
  for (const s of sessions) {
    if (s.endMinutes <= s.startMinutes) {
      alerts.push({
        code: "session_invalid_times",
        severity: "error",
        message: t.alertSessionInvalidTimes,
        sessionIds: s.id ? [s.id] : undefined,
      });
    }

    const g = groupsById.get(s.groupId);
    const loc = locsById.get(s.locationId);
    if (!g || !loc) continue;

    // Kids must be in kids area, regular groups must NOT be in kids area.
    if (g.requiredLocationType === "kidsArea" && loc.type !== "kidsArea") {
      alerts.push({
        code: "kids_not_in_kids_area",
        severity: "error",
        message: t.alertKidsNotInKidsArea(g.name),
        groupIds: g.id ? [g.id] : undefined,
        sessionIds: s.id ? [s.id] : undefined,
        locationId: loc.id,
      });
    }
    if (loc.type === "kidsArea" && g.requiredLocationType !== "kidsArea") {
      alerts.push({
        code: "regular_in_kids_area",
        severity: "warning",
        message: t.alertRegularInKidsArea(g.name),
        groupIds: g.id ? [g.id] : undefined,
        sessionIds: s.id ? [s.id] : undefined,
        locationId: loc.id,
      });
    }

    if (loc.allowedGroupTypes && loc.allowedGroupTypes.length > 0 &&
        !loc.allowedGroupTypes.includes(g.groupType)) {
      alerts.push({
        code: "disallowed_group_type",
        severity: "warning",
        message: t.alertDisallowedGroupType(g.name, loc.name),
        groupIds: g.id ? [g.id] : undefined,
        sessionIds: s.id ? [s.id] : undefined,
        locationId: loc.id,
      });
    }
  }

  // ── per-location capacity & wall length (using sweep) ──────────────
  for (const loc of locations) {
    if (!loc.id) continue;
    const timeline = locationUtilizationTimeline(
      loc.id,
      sessions,
      groups,
      settings,
    );
    let parallelHit = false;
    let lengthHit = false;
    for (const p of timeline) {
      if (!parallelHit &&
          loc.maxParallelGroups > 0 &&
          p.concurrentGroups > loc.maxParallelGroups) {
        alerts.push({
          code: "exceeds_parallel_capacity",
          severity: "error",
          message: t.alertExceedsParallelCapacity(loc.name),
          locationId: loc.id,
          atMinutes: p.atMinutes,
          dayOfWeek: p.dayOfWeek,
        });
        parallelHit = true;
      }
      if (!lengthHit &&
          loc.usableLengthMeters > 0 &&
          p.totalMeters > loc.usableLengthMeters + 0.0001) {
        alerts.push({
          code: "exceeds_wall_length",
          severity: "error",
          message: t.alertExceedsWallLength(loc.name),
          locationId: loc.id,
          atMinutes: p.atMinutes,
          dayOfWeek: p.dayOfWeek,
        });
        lengthHit = true;
      }
      if (parallelHit && lengthHit) break;
    }
  }

  // ── coach double booking (same coach, overlapping sessions) ────────
  const byCoach = new Map<string, { s: ClassSession; g: ClassGroup }[]>();
  for (const s of sessions) {
    const g = groupsById.get(s.groupId);
    if (!g) continue;
    const coach = (s.coachNameOverride ?? g.coachName ?? "").trim();
    if (!coach) continue;
    const arr = byCoach.get(coach) ?? [];
    arr.push({ s, g });
    byCoach.set(coach, arr);
  }
  for (const [coach, items] of byCoach) {
    let hit = false;
    for (let i = 0; i < items.length && !hit; i++) {
      for (let j = i + 1; j < items.length && !hit; j++) {
        const a = items[i].s;
        const b = items[j].s;
        if (a.dayOfWeek === b.dayOfWeek &&
            overlaps(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes)) {
          alerts.push({
            code: "coach_double_booked",
            severity: "error",
            message: t.alertCoachDoubleBooked(coach),
            sessionIds: [a.id, b.id].filter(Boolean) as string[],
            dayOfWeek: a.dayOfWeek,
          });
          hit = true;
        }
      }
    }
  }

  // ── per-group: kids bounds + break-even (informational) ────────────
  for (const g of groups) {
    if (g.groupType === "kids") {
      if (g.participantsCount < settings.kidsMinPerGroup) {
        alerts.push({
          code: "kids_below_minimum",
          severity: "warning",
          message: t.alertKidsBelowMinimum(g.name),
          groupIds: g.id ? [g.id] : undefined,
        });
      }
      if (g.participantsCount > settings.kidsMaxPerGroup) {
        alerts.push({
          code: "kids_above_maximum",
          severity: "warning",
          message: t.alertKidsAboveMaximum(g.name),
          groupIds: g.id ? [g.id] : undefined,
        });
      }
    }
    const be = groupBreakEvenParticipants(g, settings);
    if (Number.isFinite(be) && g.participantsCount < be) {
      alerts.push({
        code: "below_break_even",
        severity: "warning",
        message: t.alertBelowBreakEven(g.name),
        groupIds: g.id ? [g.id] : undefined,
      });
    }
  }

  return alerts;
}

/** Convenience: returns true if a group exceeds the location wall length on its own. */
export function groupExceedsLocationLength(
  group: ClassGroup,
  location: ClassLocation,
  settings: ClassSettings,
): boolean {
  if (location.usableLengthMeters <= 0) return false;
  return groupRequiredWallMeters(group, settings) > location.usableLengthMeters;
}
