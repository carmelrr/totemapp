import { computeAlerts, type AlertTranslator } from "../calc/validation";
import {
  DEFAULT_CLASS_SETTINGS,
  type ClassGroup,
  type ClassLocation,
  type ClassSession,
} from "../types";

const t: AlertTranslator = {
  alertExceedsParallelCapacity: (loc) => `parallel:${loc}`,
  alertExceedsWallLength: (loc) => `length:${loc}`,
  alertKidsNotInKidsArea: (g) => `kidsOnWall:${g}`,
  alertRegularInKidsArea: (g) => `regularInKids:${g}`,
  alertDisallowedGroupType: (g, l) => `disallowed:${g}@${l}`,
  alertCoachDoubleBooked: (c) => `coach:${c}`,
  alertSessionInvalidTimes: "invalidTimes",
  alertKidsBelowMinimum: (g) => `kidsLow:${g}`,
  alertKidsAboveMaximum: (g) => `kidsHigh:${g}`,
  alertBelowBreakEven: (g) => `breakEven:${g}`,
};

const settings = DEFAULT_CLASS_SETTINGS;

const wall: ClassLocation = {
  id: "wall1",
  name: "Wall",
  type: "wall",
  lengthMeters: 10,
  usableLengthMeters: 8,
  maxParallelGroups: 1,
  allowedGroupTypes: [],
  active: true,
  order: 0,
};
const kidsArea: ClassLocation = {
  id: "kids1",
  name: "Kids",
  type: "kidsArea",
  lengthMeters: 0,
  usableLengthMeters: 0,
  maxParallelGroups: 1,
  allowedGroupTypes: [],
  active: true,
  order: 1,
};

function group(over: Partial<ClassGroup>): ClassGroup {
  return {
    id: over.id ?? "g",
    name: over.name ?? "G",
    programId: null,
    groupType: over.groupType ?? "kids",
    participantsCount: over.participantsCount ?? 8,
    capacity: 12,
    monthlyPricePerParticipant: 400,
    sessionsPerWeek: 1,
    defaultSessionDurationHours: 1,
    coachName: over.coachName ?? "C",
    coachHourlyRate: 100,
    assistantEnabled: false,
    assistantHourlyRate: 0,
    assistantHoursPerWeek: 0,
    requiredLocationType: over.requiredLocationType ?? "kidsArea",
    ...over,
  };
}

function session(over: Partial<ClassSession>): ClassSession {
  return {
    id: over.id ?? "s",
    groupId: over.groupId ?? "g",
    dayOfWeek: over.dayOfWeek ?? 0,
    startMinutes: over.startMinutes ?? 900,
    endMinutes: over.endMinutes ?? 960,
    locationId: over.locationId ?? "kids1",
    ...over,
  };
}

describe("classes/calc/validation", () => {
  test("kids placed on wall → kids_not_in_kids_area", () => {
    const g = group({ id: "g", groupType: "kids", requiredLocationType: "kidsArea" });
    const s = session({ locationId: "wall1" });
    const alerts = computeAlerts({
      settings, locations: [wall, kidsArea], groups: [g], sessions: [s], t,
    });
    expect(alerts.some((a) => a.code === "kids_not_in_kids_area")).toBe(true);
  });

  test("non-kids in kids area → regular_in_kids_area", () => {
    const g = group({
      id: "g", groupType: "adult", requiredLocationType: "wall",
    });
    const s = session({ locationId: "kids1" });
    const alerts = computeAlerts({
      settings, locations: [wall, kidsArea], groups: [g], sessions: [s], t,
    });
    expect(alerts.some((a) => a.code === "regular_in_kids_area")).toBe(true);
  });

  test("coach booked for two overlapping sessions on same day", () => {
    const g1 = group({ id: "g1", coachName: "Alice", requiredLocationType: "wall" });
    const g2 = group({ id: "g2", coachName: "Alice", requiredLocationType: "wall" });
    const s1 = session({ id: "s1", groupId: "g1", locationId: "wall1",
      startMinutes: 900, endMinutes: 960 });
    const s2 = session({ id: "s2", groupId: "g2", locationId: "wall1",
      startMinutes: 930, endMinutes: 990 });
    const alerts = computeAlerts({
      settings, locations: [wall], groups: [g1, g2], sessions: [s1, s2], t,
    });
    expect(alerts.some((a) => a.code === "coach_double_booked")).toBe(true);
  });

  test("parallel capacity exceeded raises alert", () => {
    const g1 = group({ id: "g1", coachName: "A", requiredLocationType: "wall" });
    const g2 = group({ id: "g2", coachName: "B", requiredLocationType: "wall" });
    const s1 = session({ id: "s1", groupId: "g1", locationId: "wall1",
      startMinutes: 900, endMinutes: 960 });
    const s2 = session({ id: "s2", groupId: "g2", locationId: "wall1",
      startMinutes: 900, endMinutes: 960 });
    const alerts = computeAlerts({
      settings, locations: [wall], groups: [g1, g2], sessions: [s1, s2], t,
    });
    expect(alerts.some((a) => a.code === "exceeds_parallel_capacity")).toBe(true);
  });

  test("end <= start → session_invalid_times", () => {
    const g = group({ id: "g", requiredLocationType: "wall" });
    const s = session({ groupId: "g", locationId: "wall1", startMinutes: 1000, endMinutes: 1000 });
    const alerts = computeAlerts({
      settings, locations: [wall], groups: [g], sessions: [s], t,
    });
    expect(alerts.some((a) => a.code === "session_invalid_times")).toBe(true);
  });

  test("kids below minimum produces warning, not error", () => {
    const g = group({
      id: "g", groupType: "kids", participantsCount: 2,
      requiredLocationType: "kidsArea",
    });
    const alerts = computeAlerts({
      settings, locations: [kidsArea], groups: [g], sessions: [], t,
    });
    const a = alerts.find((x) => x.code === "kids_below_minimum");
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
  });

  test("happy path: no alerts", () => {
    const g = group({
      id: "g", groupType: "kids", participantsCount: 10,
      requiredLocationType: "kidsArea",
    });
    const s = session({ groupId: "g", locationId: "kids1" });
    const alerts = computeAlerts({
      settings, locations: [kidsArea], groups: [g], sessions: [s], t,
    });
    // Allow break-even warning to potentially appear; ensure no errors.
    expect(alerts.every((a) => a.severity !== "error")).toBe(true);
  });
});
