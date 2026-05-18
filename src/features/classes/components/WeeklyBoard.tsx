/**
 * @fileoverview Weekly board — visual grid of locations × days × time.
 *
 * Interaction model (cross-platform, no extra deps):
 *  - Tap a session block → opens the SessionEditor to change times / location.
 *  - Tap an empty slot   → opens the SessionEditor to create a placement.
 *
 * View modes change the color/text of each block:
 *  - schedule:      group color + group name
 *  - utilization:   color by current group's wall-meter share at location
 *  - profitability: green for ≥ target margin, amber for ≥0, red for <0
 *  - alerts:        red outline for blocks involved in alerts
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type {
  BoardViewMode,
  ClassAlert,
  ClassGroup,
  ClassLocation,
  ClassSession,
  ClassSettings,
  DayOfWeek,
} from "../types";
import { DAY_LABELS_HE, formatMinutes, snapToSlot } from "../constants";
import {
  groupMargin,
  groupRequiredWallMeters,
} from "../calc/economics";
import SessionEditor from "./SessionEditor";

interface Props {
  viewMode: BoardViewMode;
  settings: ClassSettings;
  locations: ClassLocation[];
  groups: ClassGroup[];
  sessions: ClassSession[];
  alerts: ClassAlert[];
  selectedDay: DayOfWeek | "all";
}

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
const HOUR_COL_WIDTH = 48;
const DAY_COL_MIN_WIDTH = 110;

interface EditorTarget {
  mode: "new" | "existing";
  sessionId?: string;
  preset?: {
    locationId: string;
    dayOfWeek: DayOfWeek;
    startMinutes: number;
  };
}

export default function WeeklyBoard(props: Props) {
  const {
    viewMode,
    settings,
    locations,
    groups,
    sessions,
    alerts,
    selectedDay,
  } = props;
  const { theme } = useTheme();

  const [editor, setEditor] = useState<EditorTarget | null>(null);

  const activeLocations = useMemo(
    () => locations.filter((l) => l.active),
    [locations],
  );

  const daysToShow: DayOfWeek[] = selectedDay === "all" ? DAYS : [selectedDay];

  const groupsById = useMemo(() => {
    const m = new Map<string, ClassGroup>();
    for (const g of groups) if (g.id) m.set(g.id, g);
    return m;
  }, [groups]);

  const alertSessionIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of alerts) {
      for (const id of a.sessionIds ?? []) s.add(id);
    }
    return s;
  }, [alerts]);

  const hourMarks = useMemo(() => {
    const out: number[] = [];
    for (
      let m = settings.displayStartMinutes;
      m <= settings.displayEndMinutes;
      m += 60
    ) {
      out.push(m);
    }
    return out;
  }, [settings.displayStartMinutes, settings.displayEndMinutes]);

  const totalMinutes = settings.displayEndMinutes - settings.displayStartMinutes;
  const pxPerMinute = 1; // 1px per minute = 60px per hour; gives nice density on web

  if (activeLocations.length === 0) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text style={{ color: theme.textSecondary, writingDirection: "rtl" }}>
          {/* noLocationsYet */}
          הגדר תחילה מיקומים בהגדרות
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal>
        <View>
          {/* Header: days × locations */}
          <View style={{ flexDirection: "row-reverse" }}>
            <View style={{ width: HOUR_COL_WIDTH }} />
            {daysToShow.map((d) => (
              <View
                key={d}
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                }}
              >
                {activeLocations.map((loc) => (
                  <View
                    key={`${d}-${loc.id}-h`}
                    style={{
                      width: DAY_COL_MIN_WIDTH,
                      paddingVertical: 6,
                      paddingHorizontal: 4,
                      alignItems: "center",
                      borderRightWidth: 1,
                      borderRightColor: theme.border,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.text,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {DAY_LABELS_HE[d]} · {loc.name}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Body: vertical hour axis on the left, columns to the right */}
          <View style={{ flexDirection: "row-reverse" }}>
            {/* hour axis */}
            <View
              style={{
                width: HOUR_COL_WIDTH,
                borderRightWidth: 1,
                borderRightColor: theme.border,
              }}
            >
              {hourMarks.map((m) => (
                <View
                  key={m}
                  style={{
                    height: 60 * pxPerMinute,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: theme.textSecondary, fontSize: 10 }}>
                    {formatMinutes(m)}
                  </Text>
                </View>
              ))}
            </View>

            {/* day × location columns */}
            {daysToShow.map((d) => (
              <View key={d} style={{ flexDirection: "row" }}>
                {activeLocations.map((loc) => (
                  <LocationDayColumn
                    key={`${d}-${loc.id}`}
                    day={d}
                    location={loc}
                    settings={settings}
                    pxPerMinute={pxPerMinute}
                    totalMinutes={totalMinutes}
                    sessions={sessions}
                    groupsById={groupsById}
                    viewMode={viewMode}
                    alertSessionIds={alertSessionIds}
                    onSelectSession={(id) =>
                      setEditor({ mode: "existing", sessionId: id })
                    }
                    onEmptySlot={(minutesFromStart) => {
                      const startMinutes = snapToSlot(
                        settings.displayStartMinutes + minutesFromStart,
                        settings.slotMinutes,
                      );
                      setEditor({
                        mode: "new",
                        preset: {
                          locationId: loc.id!,
                          dayOfWeek: d,
                          startMinutes,
                        },
                      });
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {editor && (
        <SessionEditor
          mode={editor.mode}
          sessionId={editor.sessionId}
          preset={editor.preset}
          settings={settings}
          locations={activeLocations}
          groups={groups}
          sessions={sessions}
          onClose={() => setEditor(null)}
        />
      )}
    </View>
  );
}

function LocationDayColumn({
  day,
  location,
  settings,
  pxPerMinute,
  totalMinutes,
  sessions,
  groupsById,
  viewMode,
  alertSessionIds,
  onSelectSession,
  onEmptySlot,
}: {
  day: DayOfWeek;
  location: ClassLocation;
  settings: ClassSettings;
  pxPerMinute: number;
  totalMinutes: number;
  sessions: ClassSession[];
  groupsById: Map<string, ClassGroup>;
  viewMode: BoardViewMode;
  alertSessionIds: Set<string>;
  onSelectSession: (id: string) => void;
  onEmptySlot: (minutesFromStart: number) => void;
}) {
  const { theme } = useTheme();
  const here = useMemo(
    () =>
      sessions.filter((s) => s.dayOfWeek === day && s.locationId === location.id),
    [sessions, day, location.id],
  );

  const columnHeight = totalMinutes * pxPerMinute;

  return (
    <Pressable
      onPress={(e) => {
        // Determine where in column the tap occurred.
        // @ts-ignore RN web exposes nativeEvent.locationY
        const y = e.nativeEvent.locationY ?? 0;
        onEmptySlot(y / pxPerMinute);
      }}
      style={{
        width: DAY_COL_MIN_WIDTH,
        height: columnHeight,
        borderRightWidth: 1,
        borderRightColor: theme.border,
        backgroundColor: theme.background,
        position: "relative",
      }}
    >
      {/* Hour grid lines */}
      {Array.from({ length: Math.ceil(totalMinutes / 60) }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: i * 60 * pxPerMinute,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: theme.border,
          }}
        />
      ))}

      {here.map((s) => {
        const g = groupsById.get(s.groupId);
        if (!g) return null;
        const top = (s.startMinutes - settings.displayStartMinutes) * pxPerMinute;
        const height = Math.max(
          16,
          (s.endMinutes - s.startMinutes) * pxPerMinute,
        );
        const color = blockColor(g, s, settings, location, viewMode);
        const hasAlert = s.id && alertSessionIds.has(s.id);
        return (
          <Pressable
            key={s.id}
            onPress={(e) => {
              e.stopPropagation();
              if (s.id) onSelectSession(s.id);
            }}
            style={{
              position: "absolute",
              top,
              left: 2,
              right: 2,
              height,
              backgroundColor: color,
              borderRadius: 6,
              borderWidth: hasAlert ? 2 : 0,
              borderColor: "#DC2626",
              padding: 4,
              overflow: "hidden",
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                color: "#fff",
                fontSize: 11,
                fontWeight: "700",
                writingDirection: "rtl",
                textAlign: "right",
              }}
            >
              {g.name}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 10,
                writingDirection: "rtl",
                textAlign: "right",
              }}
            >
              {formatMinutes(s.startMinutes)}–{formatMinutes(s.endMinutes)}
            </Text>
          </Pressable>
        );
      })}
    </Pressable>
  );
}

function blockColor(
  group: ClassGroup,
  _session: ClassSession,
  settings: ClassSettings,
  location: ClassLocation,
  mode: BoardViewMode,
): string {
  const base = group.color ?? settings.groupTypeColors[group.groupType] ?? "#999";
  if (mode === "schedule" || mode === "alerts") return base;
  if (mode === "profitability") {
    const m = groupMargin(group, settings);
    if (m >= settings.targetMargin) return "#16A34A";
    if (m >= 0) return "#F59E0B";
    return "#DC2626";
  }
  if (mode === "utilization") {
    const m = groupRequiredWallMeters(group, settings);
    if (location.usableLengthMeters <= 0) return base;
    const ratio = Math.min(1, m / location.usableLengthMeters);
    // greenish (low) → red (high)
    const r = Math.round(34 + (220 - 34) * ratio);
    const g = Math.round(197 - (197 - 38) * ratio);
    const b = Math.round(94 - (94 - 38) * ratio);
    return `rgb(${r},${g},${b})`;
  }
  return base;
}
