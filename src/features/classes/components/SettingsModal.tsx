/**
 * @fileoverview Settings modal for class planning. Edits the single
 * `classSettings/global` document.
 */

import React, { useEffect, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type { ClassSettings } from "../types";
import { saveClassSettings } from "../services/classSettingsService";
import { Btn, Field, Row, SectionTitle } from "./ui";

interface Props {
  visible: boolean;
  settings: ClassSettings;
  onClose: () => void;
}

function toStr(n: number) {
  return String(n);
}

function num(s: string, fallback: number): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export default function SettingsModal({ visible, settings, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [weeksPerMonth, setWeeksPerMonth] = useState("");
  const [emp, setEmp] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [slot, setSlot] = useState("");
  const [kidsMin, setKidsMin] = useState("");
  const [kidsMax, setKidsMax] = useState("");
  const [target, setTarget] = useState("");
  const [defaultMeters, setDefaultMeters] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setWeeksPerMonth(toStr(settings.weeksPerMonth));
    setEmp(toStr(settings.employerCostMultiplier));
    setStart(toStr(settings.displayStartMinutes / 60));
    setEnd(toStr(settings.displayEndMinutes / 60));
    setSlot(toStr(settings.slotMinutes));
    setKidsMin(toStr(settings.kidsMinPerGroup));
    setKidsMax(toStr(settings.kidsMaxPerGroup));
    setTarget(toStr(settings.targetMargin * 100));
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(settings.defaultMetersPerParticipant)) {
      m[k] = toStr(v);
    }
    setDefaultMeters(m);
  }, [visible, settings]);

  const onSave = async () => {
    const meters: ClassSettings["defaultMetersPerParticipant"] = {
      ...settings.defaultMetersPerParticipant,
    };
    for (const k of Object.keys(meters)) {
      meters[k as keyof typeof meters] = num(
        defaultMeters[k] ?? "",
        meters[k as keyof typeof meters],
      );
    }
    await saveClassSettings({
      weeksPerMonth: num(weeksPerMonth, settings.weeksPerMonth),
      employerCostMultiplier: num(emp, settings.employerCostMultiplier),
      displayStartMinutes: Math.round(num(start, 14) * 60),
      displayEndMinutes: Math.round(num(end, 22) * 60),
      slotMinutes: Math.round(num(slot, settings.slotMinutes)),
      kidsMinPerGroup: Math.round(num(kidsMin, settings.kidsMinPerGroup)),
      kidsMaxPerGroup: Math.round(num(kidsMax, settings.kidsMaxPerGroup)),
      targetMargin: num(target, settings.targetMargin * 100) / 100,
      defaultMetersPerParticipant: meters,
    });
    onClose();
  };

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
            maxWidth: 560,
            maxHeight: "90%",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <SectionTitle>{t.classes.settings}</SectionTitle>
          <ScrollView style={{ maxHeight: 520 }}>
            <Field
              label={t.classes.weeksPerMonth}
              value={weeksPerMonth}
              onChangeText={setWeeksPerMonth}
              keyboardType="decimal-pad"
            />
            <Field
              label={t.classes.employerCostMultiplier}
              value={emp}
              onChangeText={setEmp}
              keyboardType="decimal-pad"
            />
            <Field
              label={`${t.classes.displayStart} (h)`}
              value={start}
              onChangeText={setStart}
              keyboardType="decimal-pad"
            />
            <Field
              label={`${t.classes.displayEnd} (h)`}
              value={end}
              onChangeText={setEnd}
              keyboardType="decimal-pad"
            />
            <Field
              label={t.classes.slotMinutes}
              value={slot}
              onChangeText={setSlot}
              keyboardType="numeric"
            />
            <Field
              label={t.classes.kidsMinPerGroup}
              value={kidsMin}
              onChangeText={setKidsMin}
              keyboardType="numeric"
            />
            <Field
              label={t.classes.kidsMaxPerGroup}
              value={kidsMax}
              onChangeText={setKidsMax}
              keyboardType="numeric"
            />
            <Field
              label={t.classes.targetMargin}
              value={target}
              onChangeText={setTarget}
              keyboardType="decimal-pad"
            />
            <SectionTitle>{t.classes.defaultMetersPerParticipant}</SectionTitle>
            {Object.keys(settings.defaultMetersPerParticipant).map((k) => (
              <Field
                key={k}
                label={k}
                value={defaultMeters[k] ?? ""}
                onChangeText={(v) =>
                  setDefaultMeters((m) => ({ ...m, [k]: v }))
                }
                keyboardType="decimal-pad"
              />
            ))}
          </ScrollView>
          <Row style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Btn label={t.classes.cancel} variant="ghost" onPress={onClose} />
            <Btn label={t.classes.save} onPress={onSave} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}
