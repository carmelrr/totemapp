/**
 * @fileoverview Top-level dashboard aggregation. Pure function consuming
 * the result of the smaller calculators.
 */

import type {
  ClassGroup,
  ClassLocation,
  ClassSession,
  ClassSettings,
} from "../types";
import {
  groupAvailableSeats,
  groupMargin,
  groupMonthlyAssistantCost,
  groupMonthlyCoachCost,
  groupMonthlyProfit,
  groupMonthlyRevenue,
} from "./economics";
import {
  locationPeakConcurrent,
  locationWeeklyHours,
  wallMetersUtilization,
} from "./utilization";

export interface DashboardSummary {
  totalGroups: number;
  totalWeeklySessions: number;
  totalParticipants: number;
  monthlyRevenue: number;
  monthlyCoachCost: number;
  monthlyAssistantCost: number;
  grossProfit: number;
  overallMargin: number;
  weeklyWallHours: number;
  weeklyKidsHours: number;
  profitPerWallHour: number;
  peakConcurrent: number;
  peakWallUtilization: number;
  losingGroupsCount: number;
  belowBreakEvenCount: number;
  totalAvailableSeats: number;
  capacityViolationsCount: number;
}

export function computeDashboard(input: {
  settings: ClassSettings;
  locations: ClassLocation[];
  groups: ClassGroup[];
  sessions: ClassSession[];
}): DashboardSummary {
  const { settings, locations, groups, sessions } = input;

  let revenue = 0;
  let coachCost = 0;
  let assistantCost = 0;
  let participants = 0;
  let weeklySessions = 0;
  let losing = 0;
  let belowBreakEven = 0;
  let availableSeats = 0;

  for (const g of groups) {
    revenue += groupMonthlyRevenue(g);
    coachCost += groupMonthlyCoachCost(g, settings);
    assistantCost += groupMonthlyAssistantCost(g, settings);
    participants += g.participantsCount;
    weeklySessions += g.sessionsPerWeek;
    availableSeats += groupAvailableSeats(g);

    const profit = groupMonthlyProfit(g, settings);
    if (profit < 0) losing += 1;
    if (profit < 0 && groupMargin(g, settings) < 0) belowBreakEven += 1;
  }

  const grossProfit = revenue - coachCost - assistantCost;
  const overallMargin = revenue > 0 ? grossProfit / revenue : 0;

  let weeklyWallHours = 0;
  let weeklyKidsHours = 0;
  let peakConcurrent = 0;
  let peakWallUtilization = 0;
  let capacityViolations = 0;

  for (const loc of locations) {
    if (!loc.id) continue;
    const h = locationWeeklyHours(loc, sessions);
    if (loc.type === "wall") weeklyWallHours += h;
    if (loc.type === "kidsArea") weeklyKidsHours += h;

    const { peak } = locationPeakConcurrent(loc, sessions, groups, settings);
    if (peak > peakConcurrent) peakConcurrent = peak;
    if (loc.maxParallelGroups > 0 && peak > loc.maxParallelGroups) {
      capacityViolations += 1;
    }
    if (loc.type === "wall") {
      const util = wallMetersUtilization(loc, sessions, groups, settings);
      if (util > peakWallUtilization) peakWallUtilization = util;
    }
  }

  const profitPerWallHour = weeklyWallHours > 0
    ? grossProfit / (weeklyWallHours * settings.weeksPerMonth)
    : 0;

  return {
    totalGroups: groups.length,
    totalWeeklySessions: weeklySessions,
    totalParticipants: participants,
    monthlyRevenue: revenue,
    monthlyCoachCost: coachCost,
    monthlyAssistantCost: assistantCost,
    grossProfit,
    overallMargin,
    weeklyWallHours,
    weeklyKidsHours,
    profitPerWallHour,
    peakConcurrent,
    peakWallUtilization,
    losingGroupsCount: losing,
    belowBreakEvenCount: belowBreakEven,
    totalAvailableSeats: availableSeats,
    capacityViolationsCount: capacityViolations,
  };
}
