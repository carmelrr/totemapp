import {
  groupAvailableSeats,
  groupBreakEvenParticipants,
  groupMargin,
  groupMonthlyAssistantCost,
  groupMonthlyCoachCost,
  groupMonthlyProfit,
  groupMonthlyRevenue,
  groupRequiredWallMeters,
  profitPerSession,
} from "../calc/economics";
import { DEFAULT_CLASS_SETTINGS, type ClassGroup } from "../types";

const baseGroup: ClassGroup = {
  name: "Test",
  programId: null,
  groupType: "kids",
  participantsCount: 10,
  capacity: 12,
  monthlyPricePerParticipant: 400,
  sessionsPerWeek: 2,
  defaultSessionDurationHours: 1,
  coachName: "Alice",
  coachHourlyRate: 100,
  assistantEnabled: false,
  assistantHourlyRate: 0,
  assistantHoursPerWeek: 0,
  requiredLocationType: "kidsArea",
};

describe("classes/calc/economics", () => {
  test("revenue = participants * price", () => {
    expect(groupMonthlyRevenue(baseGroup)).toBe(4000);
  });

  test("coach cost = weekly hours * rate * mult * weeks", () => {
    // 2 sessions * 1h * 100 * 1.35 * 4.33
    expect(groupMonthlyCoachCost(baseGroup, DEFAULT_CLASS_SETTINGS)).toBeCloseTo(
      2 * 1 * 100 * 1.35 * 4.33,
      4,
    );
  });

  test("assistant cost is 0 when disabled and additive when enabled", () => {
    expect(groupMonthlyAssistantCost(baseGroup, DEFAULT_CLASS_SETTINGS)).toBe(0);
    const withAssist: ClassGroup = {
      ...baseGroup,
      assistantEnabled: true,
      assistantHourlyRate: 60,
      assistantHoursPerWeek: 2,
    };
    expect(
      groupMonthlyAssistantCost(withAssist, DEFAULT_CLASS_SETTINGS),
    ).toBeCloseTo(2 * 60 * 1.35 * 4.33, 4);
  });

  test("profit = revenue - costs and margin = profit/revenue", () => {
    const profit = groupMonthlyProfit(baseGroup, DEFAULT_CLASS_SETTINGS);
    expect(profit).toBeCloseTo(
      4000 - groupMonthlyCoachCost(baseGroup, DEFAULT_CLASS_SETTINGS),
      4,
    );
    expect(groupMargin(baseGroup, DEFAULT_CLASS_SETTINGS)).toBeCloseTo(
      profit / 4000,
      4,
    );
  });

  test("margin is 0 when revenue is 0 (no division by zero)", () => {
    const zero: ClassGroup = { ...baseGroup, participantsCount: 0 };
    expect(groupMargin(zero, DEFAULT_CLASS_SETTINGS)).toBe(0);
  });

  test("break-even = ceil(cost / price); Infinity when price=0", () => {
    const be = groupBreakEvenParticipants(baseGroup, DEFAULT_CLASS_SETTINGS);
    expect(Number.isInteger(be)).toBe(true);
    expect(be).toBeGreaterThanOrEqual(1);
    const noPrice: ClassGroup = { ...baseGroup, monthlyPricePerParticipant: 0 };
    expect(groupBreakEvenParticipants(noPrice, DEFAULT_CLASS_SETTINGS)).toBe(
      Infinity,
    );
  });

  test("available seats never negative", () => {
    expect(groupAvailableSeats(baseGroup)).toBe(2);
    const overbooked: ClassGroup = { ...baseGroup, participantsCount: 20 };
    expect(groupAvailableSeats(overbooked)).toBe(0);
  });

  test("required wall meters uses override when set, else default per type", () => {
    expect(
      groupRequiredWallMeters(baseGroup, DEFAULT_CLASS_SETTINGS),
    ).toBeCloseTo(10 * 1.0, 4); // kids default 1.0
    const override: ClassGroup = { ...baseGroup, requiredWallMetersOverride: 7.5 };
    expect(groupRequiredWallMeters(override, DEFAULT_CLASS_SETTINGS)).toBe(7.5);
  });

  test("profitPerSession = monthly profit / monthly sessions", () => {
    const expected =
      groupMonthlyProfit(baseGroup, DEFAULT_CLASS_SETTINGS) /
      (baseGroup.sessionsPerWeek * DEFAULT_CLASS_SETTINGS.weeksPerMonth);
    expect(profitPerSession(baseGroup, DEFAULT_CLASS_SETTINGS)).toBeCloseTo(
      expected,
      4,
    );
  });
});
