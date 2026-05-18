/**
 * @fileoverview Session editor modal — create or edit a single placement.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type {
  ClassGroup,
  ClassLocation,
  ClassSession,
  ClassSettings,
  DayOfWeek,
} from "../types";
import { DAY_LABELS_HE, formatMinutes, snapToSlot } from "../constants";
import {
  addClassSession,
  deleteClassSession,
  updateClassSession,
} from "../services/classSessionsService";
import { Btn, Field, Row, SectionTitle } from "./ui";

interface Props {
  mode: "new" | "existing";
  sessionId?: string;
  preset?: {
    locationId: string;
    dayOfWeek: DayOfWeek;
    startMinutes: number;
  };
  settings: ClassSettings;
  locations: ClassLocation[];
  groups: ClassGroup[];
  sessions: ClassSession[];
  onClose: () => void;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function SessionEditor({
  mode,
  sessionId,
  preset,
  settings,
  locations,
  groups,
  sessions,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const existing = useMemo<ClassSession | null>(
    () => (mode === "existing" ? sessions.find((s) => s.id === sessionId) ?? null : null),
    [mode, sessionId, sessions],
  );

  const initialGroup = useMemo<ClassGroup | null>(() => {
    if (existing) return groups.find((g) => g.id === existing.groupId) ?? null;
    return groups[0] ?? null;
  }, [existing, groups]);

  const [groupId, setGroupId] = useState<string | null>(
    existing?.groupId ?? initialGroup?.id ?? null,
  );
  const [locationId, setLocationId] = useState<string | null>(
    existing?.locationId ?? preset?.locationId ?? locations[0]?.id ?? null,
  );
  const [day, setDay] = useState<DayOfWeek>(
    (existing?.dayOfWeek ?? preset?.dayOfWeek ?? 0) as DayOfWeek,
  );
  const initialStart = existing?.startMinutes ?? preset?.startMinutes ?? settings.displayStartMinutes;
  const initialEnd = existing?.endMinutes ??
    snapToSlot(
      initialStart + (initialGroup?.defaultSessionDurationHours ?? 1) * 60,
      settings.slotMinutes,
    );
  const [startMin, setStartMin] = useState(initialStart);
  const [endMin, setEndMin] = useState(initialEnd);

  useEffect(() => {
    // When picking a group for a NEW session, default its end to start + duration.
    if (mode === "new" && groupId) {
      const g = groups.find((x) => x.id === groupId);
      if (g) {
        setEndMin(
          snapToSlot(
            startMin + g.defaultSessionDurationHours * 60,
            settings.slotMinutes,
          ),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const save = async () => {
    if (!groupId || !locationId) return;
    const s = clamp(snapToSlot(startMin, settings.slotMinutes), 0, 24 * 60 - 5);
    const e = clamp(snapToSlot(endMin, settings.slotMinutes), s + settings.slotMinutes, 24 * 60);
    const payload = {
      groupId,
      locationId,
      dayOfWeek: day,
      startMinutes: s,
      endMinutes: e,
      coachNameOverride: null,
    };
    if (mode === "new") {
      await addClassSession(payload);
    } else if (existing?.id) {
      await updateClassSession(existing.id, payload);
    }
    onClose();
  };

  const remove = async () => {
    if (existing?.id) await deleteClassSession(existing.id);
    onClose();
  };

  const shiftStart = (delta: number) => setStartMin((v) => v + delta);
  const shiftEnd = (delta: number) => setEndMin((v) => v + delta);

  return (
    <Modal visible animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.overlay,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <View
          style={{
            backgroundColor: theme.modalBackground,
            width: "100%",
            maxWidth: 480,
            maxHeight: "90%",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <SectionTitle>
            {mode === "new" ? t.classes.addSession : t.classes.edit}
          </SectionTitle>

          <ScrollView style={{ maxHeight: 460 }}>
            {/* Group picker */}
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                marginBottom: 4,
                textAlign: "right",
                writingDirection: "rtl",
              }}
            >
              {t.classes.groups}
            </Text>
            <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
              {groups.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => setGroupId(g.id ?? null)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 16,
                    backgroundColor: groupId === g.id ? theme.buttonPrimary : "transparent",
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ color: groupId === g.id ? "#fff" : theme.text, fontSize: 12 }}>
                    {g.name}
                  </Text>
                </Pressable>
              ))}
            </Row>

            {/* Location picker */}
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                marginBottom: 4,
                textAlign: "right",
                writingDirection: "rtl",
              }}
            >
              {t.classes.locations}
            </Text>
            <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
              {locations.map((loc) => (
                <Pressable
                  key={loc.id}
                  onPress={() => setLocationId(loc.id ?? null)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 16,
                    backgroundColor: locationId === loc.id ? theme.buttonPrimary : "transparent",
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ color: locationId === loc.id ? "#fff" : theme.text, fontSize: 12 }}>
                    {loc.name}
                  </Text>
                </Pressable>
              ))}
            </Row>

            {/* Day picker */}
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                marginBottom: 4,
                textAlign: "right",
                writingDirection: "rtl",
              }}
            >
              {DAY_LABELS_HE[day]}
            </Text>
            <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
              {([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDay(d)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 16,
                    backgroundColor: day === d ? theme.buttonPrimary : "transparent",
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ color: day === d ? "#fff" : theme.text, fontSize: 12 }}>
                    {DAY_LABELS_HE[d]}
                  </Text>
                </Pressable>
              ))}
            </Row>

            {/* Time controls */}
            <Row style={{ marginBottom: 10, justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "right", writingDirection: "rtl" }}>
                  התחלה
                </Text>
                <Row>
                  <Btn label="−" variant="ghost" onPress={() => shiftStart(-settings.slotMinutes)} />
                  <Text style={{ color: theme.text, fontSize: 16, minWidth: 60, textAlign: "center" }}>
                    {formatMinutes(snapToSlot(startMin, settings.slotMinutes))}
                  </Text>
                  <Btn label="+" variant="ghost" onPress={() => shiftStart(settings.slotMinutes)} />
                </Row>
              </View>
              <View>
                <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "right", writingDirection: "rtl" }}>
                  סיום
                </Text>
                <Row>
                  <Btn label="−" variant="ghost" onPress={() => shiftEnd(-settings.slotMinutes)} />
                  <Text style={{ color: theme.text, fontSize: 16, minWidth: 60, textAlign: "center" }}>
                    {formatMinutes(snapToSlot(endMin, settings.slotMinutes))}
                  </Text>
                  <Btn label="+" variant="ghost" onPress={() => shiftEnd(settings.slotMinutes)} />
                </Row>
              </View>
            </Row>
          </ScrollView>

          <Row style={{ marginTop: 12, justifyContent: "space-between" }}>
            <Btn label={t.classes.delete} variant="danger" onPress={remove} disabled={mode === "new"} />
            <Row>
              <Btn label={t.classes.cancel} variant="ghost" onPress={onClose} />
              <Btn
                label={t.classes.save}
                onPress={save}
                disabled={!groupId || !locationId}
              />
            </Row>
          </Row>
        </View>
      </View>
    </Modal>
  );
}
