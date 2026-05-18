import {
  locationPeakConcurrent,
  locationUtilizationTimeline,
  locationWeeklyHours,
  wallMetersUtilization,
} from "../calc/utilization";
import {
  DEFAULT_CLASS_SETTINGS,
  type ClassGroup,
  type ClassLocation,
  type ClassSession,
} from "../types";

const settings = DEFAULT_CLASS_SETTINGS;

const wall: ClassLocation = {
  id: "loc-wall",
  name: "Main Wall",
  type: "wall",
  lengthMeters: 20,
  usableLengthMeters: 18,
  maxParallelGroups: 2,
  allowedGroupTypes: [],
  active: true,
  order: 0,
};

function makeGroup(over: Partial<ClassGroup>): ClassGroup {
  return {
    id: over.id ?? "g1",
    name: over.name ?? "G1",
    programId: null,
    groupType: over.groupType ?? "beginner",
    participantsCount: over.participantsCount ?? 5,
    capacity: 10,
    monthlyPricePerParticipant: 400,
    sessionsPerWeek: 1,
    defaultSessionDurationHours: 1,
    coachName: over.coachName ?? "Coach",
    coachHourlyRate: 100,
    assistantEnabled: false,
    assistantHourlyRate: 0,
    assistantHoursPerWeek: 0,
    requiredLocationType: "wall",
    ...over,
  };
}

function makeSession(over: Partial<ClassSession>): ClassSession {
  return {
    id: over.id ?? "s1",
    groupId: over.groupId ?? "g1",
    dayOfWeek: over.dayOfWeek ?? 0,
    startMinutes: over.startMinutes ?? 16 * 60,
    endMinutes: over.endMinutes ?? 17 * 60,
    locationId: over.locationId ?? "loc-wall",
    ...over,
  };
}

describe("classes/calc/utilization", () => {
  test("peak concurrency reflects overlapping sessions", () => {
    const g1 = makeGroup({ id: "g1", participantsCount: 4 });
    const g2 = makeGroup({ id: "g2", name: "G2", participantsCount: 4 });
    const g3 = makeGroup({ id: "g3", name: "G3", participantsCount: 4 });
    const sessions = [
      makeSession({ id: "s1", groupId: "g1", startMinutes: 1000, endMinutes: 1060 }),
      makeSession({ id: "s2", groupId: "g2", startMinutes: 1020, endMinutes: 1080 }),
      makeSession({ id: "s3", groupId: "g3", startMinutes: 1040, endMinutes: 1100 }),
    ];
    const { peak } = locationPeakConcurrent(wall, sessions, [g1, g2, g3], settings);
    expect(peak).toBe(3);
  });

  test("touching but non-overlapping sessions do not stack", () => {
    const g1 = makeGroup({ id: "g1" });
    const g2 = makeGroup({ id: "g2", name: "G2" });
    const sessions = [
      makeSession({ id: "s1", groupId: "g1", startMinutes: 900, endMinutes: 960 }),
      makeSession({ id: "s2", groupId: "g2", startMinutes: 960, endMinutes: 1020 }),
    ];
    const { peak } = locationPeakConcurrent(wall, sessions, [g1, g2], settings);
    expect(peak).toBe(1);
  });

  test("days are independent", () => {
    const g1 = makeGroup({ id: "g1" });
    const g2 = makeGroup({ id: "g2", name: "G2" });
    const sessions = [
      makeSession({ id: "s1", groupId: "g1", dayOfWeek: 0, startMinutes: 1000, endMinutes: 1060 }),
      makeSession({ id: "s2", groupId: "g2", dayOfWeek: 1, startMinutes: 1000, endMinutes: 1060 }),
    ];
    const { peak } = locationPeakConcurrent(wall, sessions, [g1, g2], settings);
    expect(peak).toBe(1);
  });

  test("weekly hours sum across sessions", () => {
    const sessions = [
      makeSession({ id: "s1", startMinutes: 900, endMinutes: 960 }), // 1h
      makeSession({ id: "s2", startMinutes: 1000, endMinutes: 1090 }), // 1.5h
    ];
    expect(locationWeeklyHours(wall, sessions)).toBeCloseTo(2.5, 6);
  });

  test("wall-meter utilization saturates near 1", () => {
    // 9 participants on advanced (default 1.5 m/p) → 13.5 m on an 18 m wall ≈ 0.75
    const g1 = makeGroup({ id: "g1", groupType: "advanced", participantsCount: 9 });
    const s = [makeSession({ id: "s1", groupId: "g1" })];
    expect(wallMetersUtilization(wall, s, [g1], settings)).toBeCloseTo(13.5 / 18, 4);
  });

  test("timeline returns chronological events", () => {
    const g1 = makeGroup({ id: "g1" });
    const tl = locationUtilizationTimeline(
      wall.id!,
      [makeSession({ id: "s1", groupId: "g1", startMinutes: 1000, endMinutes: 1060 })],
      [g1],
      settings,
    );
    expect(tl).toHaveLength(2);
    expect(tl[0].atMinutes).toBeLessThan(tl[1].atMinutes);
    expect(tl[0].concurrentGroups).toBe(1);
    expect(tl[1].concurrentGroups).toBe(0);
  });
});
