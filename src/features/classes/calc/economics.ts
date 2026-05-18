/**
 * @fileoverview Pure economics calculations for the Class Planning module.
 *
 * Revenue & coach cost are computed at the GROUP level. Sessions are only
 * the calendar placement; no economics happen per-session except for an
 * optional even split of profit for display ("profit per session").
 *
 * All functions here are pure and deterministic — they are the unit-tested
 * surface of the module.
 */

import type { ClassGroup, ClassSettings } from "../types";

/** Monthly revenue for a single group. */
export function groupMonthlyRevenue(group: ClassGroup): number {
  return Math.max(0, group.participantsCount) *
    Math.max(0, group.monthlyPricePerParticipant);
}

/** Weekly session-hours for a group (used for coach cost). */
export function groupWeeklySessionHours(group: ClassGroup): number {
  return Math.max(0, group.sessionsPerWeek) *
    Math.max(0, group.defaultSessionDurationHours);
}

/** Monthly coach cost (incl. employer multiplier). */
export function groupMonthlyCoachCost(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  const weeklyHours = groupWeeklySessionHours(group);
  return weeklyHours *
    group.coachHourlyRate *
    settings.employerCostMultiplier *
    settings.weeksPerMonth;
}

/** Monthly assistant cost (0 if not enabled). */
export function groupMonthlyAssistantCost(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  if (!group.assistantEnabled) return 0;
  return Math.max(0, group.assistantHoursPerWeek) *
    Math.max(0, group.assistantHourlyRate) *
    settings.employerCostMultiplier *
    settings.weeksPerMonth;
}

/** Monthly total direct cost. */
export function groupMonthlyTotalCost(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  return groupMonthlyCoachCost(group, settings) +
    groupMonthlyAssistantCost(group, settings);
}

/** Monthly profit (revenue − cost). */
export function groupMonthlyProfit(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  return groupMonthlyRevenue(group) - groupMonthlyTotalCost(group, settings);
}

/** Margin = profit / revenue. NaN-safe → returns 0 when revenue is 0. */
export function groupMargin(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  const rev = groupMonthlyRevenue(group);
  if (rev <= 0) return 0;
  return groupMonthlyProfit(group, settings) / rev;
}

/**
 * Break-even participant count for a group: ceil(cost / monthly_price).
 * Returns Infinity when price is 0 (cannot break even).
 */
export function groupBreakEvenParticipants(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  const price = group.monthlyPricePerParticipant;
  if (price <= 0) return Infinity;
  return Math.ceil(groupMonthlyTotalCost(group, settings) / price);
}

/** Available seats = capacity − participants (never negative). */
export function groupAvailableSeats(group: ClassGroup): number {
  return Math.max(0, group.capacity - group.participantsCount);
}

/**
 * Required wall meters for a group. Uses override if present, else
 * participants × default-meters-per-participant from settings.
 */
export function groupRequiredWallMeters(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  if (group.requiredWallMetersOverride != null &&
      group.requiredWallMetersOverride >= 0) {
    return group.requiredWallMetersOverride;
  }
  const per = settings.defaultMetersPerParticipant[group.groupType] ?? 1.5;
  return group.participantsCount * per;
}

/** Even profit split per session (display-only convenience). */
export function profitPerSession(
  group: ClassGroup,
  settings: ClassSettings,
): number {
  const sessionsMonthly = group.sessionsPerWeek * settings.weeksPerMonth;
  if (sessionsMonthly <= 0) return 0;
  return groupMonthlyProfit(group, settings) / sessionsMonthly;
}
