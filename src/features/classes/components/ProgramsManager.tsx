/**
 * @fileoverview Programs (pricing tracks) manager + editor.
 */

import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type { ClassProgram, GroupType } from "../types";
import { ALL_GROUP_TYPES, GROUP_TYPE_LABELS_HE } from "../constants";
import {
  addClassProgram,
  deleteClassProgram,
  updateClassProgram,
} from "../services/classProgramsService";
import { Btn, Card, Field, Row, SectionTitle } from "./ui";

interface Props {
  visible: boolean;
  programs: ClassProgram[];
  editingId: string | "new" | null;
  onClose: () => void;
  onPickEditing: (id: string | "new" | null) => void;
}

function num(s: string) {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function ProgramsManager({
  visible,
  programs,
  editingId,
  onClose,
  onPickEditing,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const editing = useMemo<ClassProgram | null>(() => {
    if (editingId === "new") {
      return {
        name: "",
        defaultGroupType: "beginner",
        monthlyPricePerParticipant: 400,
        defaultSessionsPerWeek: 1,
        defaultSessionDurationHours: 1,
        defaultCoachHourlyRate: 100,
        includesMembership: false,
      };
    }
    return programs.find((p) => p.id === editingId) ?? null;
  }, [editingId, programs]);

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
            <SectionTitle>{t.classes.programs}</SectionTitle>
            <Btn label="+" onPress={() => onPickEditing("new")} />
          </Row>
          <ScrollView style={{ maxHeight: 500 }}>
            {programs.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => onPickEditing(p.id ?? null)}
                style={{ marginBottom: 8 }}
              >
                <Card>
                  <Text
                    style={{
                      color: theme.text,
                      fontWeight: "600",
                      textAlign: "right",
                      writingDirection: "rtl",
                    }}
                  >
                    {p.name}
                  </Text>
                  <Text
                    style={{
                      color: theme.textSecondary,
                      textAlign: "right",
                      writingDirection: "rtl",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    ₪{p.monthlyPricePerParticipant} ·{" "}
                    {p.defaultSessionsPerWeek}×{p.defaultSessionDurationHours}h ·{" "}
                    {GROUP_TYPE_LABELS_HE[p.defaultGroupType]}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
          <Row style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Btn label={t.classes.cancel} variant="ghost" onPress={onClose} />
          </Row>
        </View>

        {editing && (
          <ProgramEditor
            initial={editing}
            isNew={editingId === "new"}
            onCancel={() => onPickEditing(null)}
            onSaved={() => onPickEditing(null)}
          />
        )}
      </View>
    </Modal>
  );
}

function ProgramEditor({
  initial,
  isNew,
  onCancel,
  onSaved,
}: {
  initial: ClassProgram;
  isNew: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [name, setName] = useState(initial.name);
  const [gtype, setGtype] = useState<GroupType>(initial.defaultGroupType);
  const [price, setPrice] = useState(String(initial.monthlyPricePerParticipant));
  const [sessions, setSessions] = useState(String(initial.defaultSessionsPerWeek));
  const [duration, setDuration] = useState(String(initial.defaultSessionDurationHours));
  const [coachRate, setCoachRate] = useState(String(initial.defaultCoachHourlyRate));
  const [membership, setMembership] = useState(initial.includesMembership);

  const save = async () => {
    const payload = {
      name: name.trim() || "—",
      defaultGroupType: gtype,
      monthlyPricePerParticipant: num(price),
      defaultSessionsPerWeek: Math.max(0, Math.round(num(sessions))),
      defaultSessionDurationHours: num(duration),
      defaultCoachHourlyRate: num(coachRate),
      includesMembership: membership,
    };
    if (isNew) await addClassProgram(payload);
    else if (initial.id) await updateClassProgram(initial.id, payload);
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
          maxWidth: 480,
          maxHeight: "90%",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <SectionTitle>
          {isNew ? `+ ${t.classes.programs}` : t.classes.edit}
        </SectionTitle>
        <ScrollView style={{ maxHeight: 480 }}>
          <Field label={t.classes.groupName} value={name} onChangeText={setName} />
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
          <Field label={t.classes.monthlyPrice} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Field label={t.classes.sessionsPerWeek} value={sessions} onChangeText={setSessions} keyboardType="numeric" />
          <Field label={t.classes.sessionDuration} value={duration} onChangeText={setDuration} keyboardType="decimal-pad" />
          <Field label={t.classes.coachHourlyRate} value={coachRate} onChangeText={setCoachRate} keyboardType="decimal-pad" />
          <Pressable onPress={() => setMembership((m) => !m)} style={{ paddingVertical: 8, alignItems: "flex-end" }}>
            <Text style={{ color: theme.text, writingDirection: "rtl" }}>
              {membership ? "✔ " : "○ "} כולל מנוי
            </Text>
          </Pressable>
        </ScrollView>
        <Row style={{ marginTop: 12, justifyContent: "space-between" }}>
          <Btn
            label={t.classes.delete}
            variant="danger"
            onPress={async () => {
              if (initial.id) await deleteClassProgram(initial.id);
              onSaved();
            }}
            disabled={isNew}
          />
          <Row>
            <Btn label={t.classes.cancel} variant="ghost" onPress={onCancel} />
            <Btn label={t.classes.save} onPress={save} />
          </Row>
        </Row>
      </View>
    </View>
  );
}
