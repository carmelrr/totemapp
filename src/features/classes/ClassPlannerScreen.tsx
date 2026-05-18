/**
 * @fileoverview Top-level screen for תכנון חוגים (Class Planning).
 *
 * Composes:
 *  - DashboardStrip (live KPIs)
 *  - View-mode tabs + management chips (Locations / Programs / Groups / Settings)
 *  - WeeklyBoard (Schedule / Utilization / Profitability / Alerts)
 *  - AlertsList (replaces the board when viewMode === 'alerts')
 */

import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import {
  useClassGroups,
  useClassLocations,
  useClassPrograms,
  useClassSessions,
  useClassSettings,
} from "@/features/classes/hooks";
import { useClassPlannerUI } from "@/features/classes/store";
import { computeAlerts, type AlertTranslator } from "@/features/classes/calc/validation";
import { computeDashboard } from "@/features/classes/calc/dashboard";
import type { BoardViewMode } from "@/features/classes/types";
import SettingsModal from "@/features/classes/components/SettingsModal";
import LocationsManager from "@/features/classes/components/LocationsManager";
import ProgramsManager from "@/features/classes/components/ProgramsManager";
import GroupsManager from "@/features/classes/components/GroupsManager";
import WeeklyBoard from "@/features/classes/components/WeeklyBoard";
import DashboardStrip from "@/features/classes/components/DashboardStrip";
import AlertsList from "@/features/classes/components/AlertsList";

const VIEWS: BoardViewMode[] = ["schedule", "utilization", "profitability", "alerts"];

export default function ClassPlannerScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();

  const { settings } = useClassSettings();
  const { locations } = useClassLocations();
  const { programs } = useClassPrograms();
  const { groups } = useClassGroups();
  const { sessions } = useClassSessions();

  const ui = useClassPlannerUI();

  const alertTranslator: AlertTranslator = useMemo(
    () => ({
      alertExceedsParallelCapacity: t.classes.alertExceedsParallelCapacity,
      alertExceedsWallLength: t.classes.alertExceedsWallLength,
      alertKidsNotInKidsArea: t.classes.alertKidsNotInKidsArea,
      alertRegularInKidsArea: t.classes.alertRegularInKidsArea,
      alertDisallowedGroupType: t.classes.alertDisallowedGroupType,
      alertCoachDoubleBooked: t.classes.alertCoachDoubleBooked,
      alertSessionInvalidTimes: t.classes.alertSessionInvalidTimes,
      alertKidsBelowMinimum: t.classes.alertKidsBelowMinimum,
      alertKidsAboveMaximum: t.classes.alertKidsAboveMaximum,
      alertBelowBreakEven: t.classes.alertBelowBreakEven,
    }),
    [t],
  );

  const alerts = useMemo(
    () =>
      computeAlerts({
        settings,
        locations,
        groups,
        sessions,
        t: alertTranslator,
      }),
    [settings, locations, groups, sessions, alertTranslator],
  );

  const summary = useMemo(
    () => computeDashboard({ settings, locations, groups, sessions }),
    [settings, locations, groups, sessions],
  );

  const viewLabel = (v: BoardViewMode): string => {
    const map: Record<BoardViewMode, string> = {
      schedule: t.classes.viewSchedule,
      utilization: t.classes.viewUtilization,
      profitability: t.classes.viewProfitability,
      alerts: t.classes.viewAlerts,
    };
    return map[v];
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: theme.text, fontSize: 20 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, paddingHorizontal: 8 }}>
          <Text
            style={{
              color: theme.text,
              fontSize: 18,
              fontWeight: "700",
              textAlign: "right",
              writingDirection: "rtl",
            }}
          >
            🎯 {t.classes.title}
          </Text>
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 11,
              textAlign: "right",
              writingDirection: "rtl",
            }}
          >
            {t.classes.subtitle}
          </Text>
        </View>
        <Pressable
          onPress={() => ui.setShowSettings(true)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ color: theme.text }}>⚙ {t.classes.settings}</Text>
        </Pressable>
      </View>

      {/* Dashboard strip */}
      <View style={{ paddingHorizontal: 8 }}>
        <DashboardStrip summary={summary} />
      </View>

      {/* Manager chips */}
      <View
        style={{
          flexDirection: "row-reverse",
          flexWrap: "wrap",
          gap: 6,
          paddingHorizontal: 12,
          paddingTop: 4,
          paddingBottom: 8,
        }}
      >
        <Chip
          label={`📍 ${t.classes.locations} (${locations.length})`}
          onPress={() => ui.openLocationEditor("new")}
        />
        <Chip
          label={`💰 ${t.classes.programs} (${programs.length})`}
          onPress={() => ui.openProgramEditor("new")}
        />
        <Chip
          label={`👥 ${t.classes.groups} (${groups.length})`}
          onPress={() => ui.openGroupEditor("new")}
        />
        <Chip
          label={`🔔 ${t.classes.activeAlerts}: ${alerts.length}`}
          onPress={() => ui.setViewMode("alerts")}
          highlighted={alerts.length > 0}
        />
      </View>

      {/* View mode tabs */}
      <View
        style={{
          flexDirection: "row-reverse",
          gap: 6,
          paddingHorizontal: 12,
          paddingBottom: 8,
        }}
      >
        {VIEWS.map((v) => (
          <Pressable
            key={v}
            onPress={() => ui.setViewMode(v)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: ui.viewMode === v ? theme.buttonPrimary : "transparent",
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: ui.viewMode === v ? "#fff" : theme.text, fontSize: 12 }}>
              {viewLabel(v)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Body */}
      <View style={{ flex: 1 }}>
        {ui.viewMode === "alerts" ? (
          <AlertsList alerts={alerts} />
        ) : (
          <WeeklyBoard
            viewMode={ui.viewMode}
            settings={settings}
            locations={locations}
            groups={groups}
            sessions={sessions}
            alerts={alerts}
            selectedDay={ui.selectedDay}
          />
        )}
      </View>

      {/* Modals */}
      <SettingsModal
        visible={ui.showSettings}
        settings={settings}
        onClose={() => ui.setShowSettings(false)}
      />
      <LocationsManager
        visible={ui.editingLocationId !== null}
        locations={locations}
        editingId={ui.editingLocationId}
        onClose={() => ui.openLocationEditor(null)}
        onPickEditing={ui.openLocationEditor}
      />
      <ProgramsManager
        visible={ui.editingProgramId !== null}
        programs={programs}
        editingId={ui.editingProgramId}
        onClose={() => ui.openProgramEditor(null)}
        onPickEditing={ui.openProgramEditor}
      />
      <GroupsManager
        visible={ui.editingGroupId !== null}
        groups={groups}
        programs={programs}
        sessions={sessions}
        settings={settings}
        editingId={ui.editingGroupId}
        onClose={() => ui.openGroupEditor(null)}
        onPickEditing={ui.openGroupEditor}
      />
    </SafeAreaView>
  );
}

function Chip({
  label,
  onPress,
  highlighted,
}: {
  label: string;
  onPress: () => void;
  highlighted?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: highlighted ? "#DC2626" : theme.card,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ color: highlighted ? "#fff" : theme.text, fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
