/**
 * @fileoverview Groups manager — list with revenue/cost/margin badges and
 * an editor modal. Adding a group does NOT auto-create sessions; the user
 * places them by tapping empty slots on the weekly board.
 */

import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type {
  ClassGroup,
  ClassProgram,
  ClassSession,
  ClassSettings,
  GroupType,
  RequiredLocationType,
} from "../types";
import { ALL_GROUP_TYPES, GROUP_TYPE_LABELS_HE, formatCurrencyIls, formatPercent } from "../constants";
import {
  groupMargin,
  groupMonthlyProfit,
  groupMonthlyRevenue,
} from "../calc/economics";
import {
  addClassGroup,
  deleteClassGroup,
  updateClassGroup,
} from "../services/classGroupsService";
import { Btn, Card, Field, Row, SectionTitle } from "./ui";

interface Props {
  visible: boolean;
  groups: ClassGroup[];
  programs: ClassProgram[];
  sessions: ClassSession[];
  settings: ClassSettings;
  editingId: string | "new" | null;
  onClose: () => void;
  onPickEditing: (id: string | "new" | null) => void;
}

function num(s: string) {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function GroupsManager({
  visible,
  groups,
  programs,
  sessions,
  settings,
  editingId,
  onClose,
  onPickEditing,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const editing = useMemo<ClassGroup | null>(() => {
    if (editingId === "new") {
      return {
        name: "",
        programId: programs[0]?.id ?? null,
        groupType: programs[0]?.defaultGroupType ?? "beginner",
        participantsCount: 6,
        capacity: 10,
        monthlyPricePerParticipant: programs[0]?.monthlyPricePerParticipant ?? 400,
        sessionsPerWeek: programs[0]?.defaultSessionsPerWeek ?? 1,
        defaultSessionDurationHours: programs[0]?.defaultSessionDurationHours ?? 1,
        coachName: "",
        coachHourlyRate: programs[0]?.defaultCoachHourlyRate ?? 100,
        assistantEnabled: false,
        assistantHourlyRate: 0,
        assistantHoursPerWeek: 0,
        requiredLocationType: "wall",
        requiredWallMetersOverride: null,
      };
    }
    return groups.find((g) => g.id === editingId) ?? null;
  }, [editingId, groups, programs]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
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
            maxWidth: 720,
            maxHeight: "90%",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <SectionTitle>{t.classes.groups}</SectionTitle>
            <Btn label={t.classes.addGroup} onPress={() => onPickEditing("new")} />
          </Row>
          <ScrollView style={{ maxHeight: 520 }}>
            {groups.length === 0 && (
              <Text
                style={{
                  color: theme.textSecondary,
                  textAlign: "right",
                  writingDirection: "rtl",
                  paddingVertical: 24,
                }}
              >
                {t.classes.noGroupsYet}
              </Text>
            )}
            {groups.map((g) => {
              const rev = groupMonthlyRevenue(g);
              const profit = groupMonthlyProfit(g, settings);
              const margin = groupMargin(g, settings);
              const positive = profit >= 0;
              const color = settings.groupTypeColors[g.groupType] ?? "#999";
              return (
                <Pressable
                  key={g.id}
                  onPress={() => onPickEditing(g.id ?? null)}
                  style={{ marginBottom: 8 }}
                >
                  <Card>
                    <Row style={{ justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Row>
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: color,
                            }}
                          />
                          <Text
                            style={{
                              color: theme.text,
                              fontWeight: "600",
                              writingDirection: "rtl",
                            }}
                          >
                            {g.name}
                          </Text>
                        </Row>
                        <Text
                          style={{
                            color: theme.textSecondary,
                            fontSize: 12,
                            marginTop: 4,
                            writingDirection: "rtl",
                            textAlign: "right",
                          }}
                        >
                          {GROUP_TYPE_LABELS_HE[g.groupType]} · {g.participantsCount}/
                          {g.capacity} · {g.sessionsPerWeek}×
                          {g.defaultSessionDurationHours}h
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: theme.text, fontSize: 12 }}>
                          {formatCurrencyIls(rev)}
                        </Text>
                        <Text
                          style={{
                            color: positive ? "#16A34A" : "#DC2626",
                            fontWeight: "700",
                            fontSize: 14,
                          }}
                        >
                          {formatCurrencyIls(profit)} ({formatPercent(margin)})
                        </Text>
                      </View>
                    </Row>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
          <Row style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Btn label={t.classes.cancel} variant="ghost" onPress={onClose} />
          </Row>
        </View>

        {editing && (
          <GroupEditor
            initial={editing}
            isNew={editingId === "new"}
            programs={programs}
            sessions={sessions}
            onCancel={() => onPickEditing(null)}
            onSaved={() => onPickEditing(null)}
          />
        )}
      </View>
    </Modal>
  );
}

function GroupEditor({
  initial,
  isNew,
  programs,
  sessions,
  onCancel,
  onSaved,
}: {
  initial: ClassGroup;
  isNew: boolean;
  programs: ClassProgram[];
  sessions: ClassSession[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [name, setName] = useState(initial.name);
  const [programId, setProgramId] = useState<string | null>(initial.programId ?? null);
  const [gtype, setGtype] = useState<GroupType>(initial.groupType);
  const [participants, setParticipants] = useState(String(initial.participantsCount));
  const [capacity, setCapacity] = useState(String(initial.capacity));
  const [price, setPrice] = useState(String(initial.monthlyPricePerParticipant));
  const [sessionsPerWeek, setSessionsPerWeek] = useState(String(initial.sessionsPerWeek));
  const [duration, setDuration] = useState(String(initial.defaultSessionDurationHours));
  const [coachName, setCoachName] = useState(initial.coachName ?? "");
  const [coachRate, setCoachRate] = useState(String(initial.coachHourlyRate));
  const [assistantEnabled, setAssistantEnabled] = useState(initial.assistantEnabled);
  const [assistantRate, setAssistantRate] = useState(String(initial.assistantHourlyRate));
  const [assistantHours, setAssistantHours] = useState(String(initial.assistantHoursPerWeek));
  const [reqType, setReqType] = useState<RequiredLocationType>(initial.requiredLocationType);
  const [override, setOverride] = useState(
    initial.requiredWallMetersOverride != null
      ? String(initial.requiredWallMetersOverride)
      : "",
  );
  const [notes, setNotes] = useState(initial.notes ?? "");

  const applyProgram = (p: ClassProgram) => {
    setProgramId(p.id ?? null);
    setGtype(p.defaultGroupType);
    setPrice(String(p.monthlyPricePerParticipant));
    setSessionsPerWeek(String(p.defaultSessionsPerWeek));
    setDuration(String(p.defaultSessionDurationHours));
    setCoachRate(String(p.defaultCoachHourlyRate));
  };

  const save = async () => {
    const payload = {
      name: name.trim() || "—",
      programId: programId || null,
      groupType: gtype,
      participantsCount: Math.max(0, Math.round(num(participants))),
      capacity: Math.max(0, Math.round(num(capacity))),
      monthlyPricePerParticipant: num(price),
      sessionsPerWeek: Math.max(0, Math.round(num(sessionsPerWeek))),
      defaultSessionDurationHours: num(duration),
      coachName: coachName.trim() || undefined,
      coachHourlyRate: num(coachRate),
      assistantEnabled,
      assistantHourlyRate: num(assistantRate),
      assistantHoursPerWeek: num(assistantHours),
      requiredLocationType: reqType,
      requiredWallMetersOverride:
        override.trim() === "" ? null : num(override),
      notes: notes.trim() || undefined,
    };
    if (isNew) await addClassGroup(payload);
    else if (initial.id) await updateClassGroup(initial.id, payload);
    onSaved();
  };

  const remove = async () => {
    if (initial.id) await deleteClassGroup(initial.id, sessions);
    onSaved();
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
          maxWidth: 560,
          maxHeight: "90%",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <SectionTitle>{isNew ? t.classes.addGroup : t.classes.edit}</SectionTitle>
        <ScrollView style={{ maxHeight: 520 }}>
          <Field label={t.classes.groupName} value={name} onChangeText={setName} />

          {programs.length > 0 && (
            <>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4, textAlign: "right", writingDirection: "rtl" }}>
                {t.classes.program}
              </Text>
              <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
                {programs.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => applyProgram(p)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 16,
                      backgroundColor: programId === p.id ? theme.buttonPrimary : "transparent",
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Text style={{ color: programId === p.id ? "#fff" : theme.text, fontSize: 12 }}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </Row>
            </>
          )}

          <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4, textAlign: "right", writingDirection: "rtl" }}>
            {t.classes.groupType}
          </Text>
          <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
            {ALL_GROUP_TYPES.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGtype(g)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: g === gtype ? theme.buttonPrimary : "transparent",
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text style={{ color: g === gtype ? "#fff" : theme.text, fontSize: 12 }}>
                  {GROUP_TYPE_LABELS_HE[g]}
                </Text>
              </Pressable>
            ))}
          </Row>

          <Row>
            <View style={{ flex: 1 }}>
              <Field label={t.classes.participantsCount} value={participants} onChangeText={setParticipants} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t.classes.capacity} value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
            </View>
          </Row>

          <Field label={t.classes.monthlyPrice} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

          <Row>
            <View style={{ flex: 1 }}>
              <Field label={t.classes.sessionsPerWeek} value={sessionsPerWeek} onChangeText={setSessionsPerWeek} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t.classes.sessionDuration} value={duration} onChangeText={setDuration} keyboardType="decimal-pad" />
            </View>
          </Row>

          <Field label={t.classes.coachName} value={coachName} onChangeText={setCoachName} />
          <Field label={t.classes.coachHourlyRate} value={coachRate} onChangeText={setCoachRate} keyboardType="decimal-pad" />

          <Pressable onPress={() => setAssistantEnabled((a) => !a)} style={{ paddingVertical: 8, alignItems: "flex-end" }}>
            <Text style={{ color: theme.text, writingDirection: "rtl" }}>
              {assistantEnabled ? "✔ " : "○ "} {t.classes.assistantEnabled}
            </Text>
          </Pressable>
          {assistantEnabled && (
            <Row>
              <View style={{ flex: 1 }}>
                <Field label={t.classes.assistantHourlyRate} value={assistantRate} onChangeText={setAssistantRate} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.classes.assistantHoursPerWeek} value={assistantHours} onChangeText={setAssistantHours} keyboardType="decimal-pad" />
              </View>
            </Row>
          )}

          <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4, textAlign: "right", writingDirection: "rtl" }}>
            {t.classes.requiredLocationType}
          </Text>
          <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
            {(["wall", "kidsArea"] as RequiredLocationType[]).map((rt) => (
              <Pressable
                key={rt}
                onPress={() => setReqType(rt)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: rt === reqType ? theme.buttonPrimary : "transparent",
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text style={{ color: rt === reqType ? "#fff" : theme.text, fontSize: 12 }}>
                  {rt === "wall"
                    ? t.classes.locationTypeWall
                    : t.classes.locationTypeKidsArea}
                </Text>
              </Pressable>
            ))}
          </Row>

          <Field
            label={t.classes.requiredWallMeters}
            value={override}
            onChangeText={setOverride}
            keyboardType="decimal-pad"
            placeholder="(אוטומטי)"
          />

          <Field label={t.classes.notes} value={notes} onChangeText={setNotes} multiline />
        </ScrollView>

        <Row style={{ marginTop: 12, justifyContent: "space-between" }}>
          <Btn label={t.classes.delete} variant="danger" onPress={remove} disabled={isNew} />
          <Row>
            <Btn label={t.classes.cancel} variant="ghost" onPress={onCancel} />
            <Btn label={t.classes.save} onPress={save} />
          </Row>
        </Row>
      </View>
    </View>
  );
}
