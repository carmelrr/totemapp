/**
 * @fileoverview Dashboard strip showing key KPIs.
 */

import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type { DashboardSummary } from "../calc/dashboard";
import { formatCurrencyIls, formatPercent } from "../constants";

interface Props {
  summary: DashboardSummary;
}

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: theme.border,
        minWidth: 110,
      }}
    >
      <Text
        style={{
          color: theme.textSecondary,
          fontSize: 10,
          writingDirection: "rtl",
          textAlign: "right",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: color ?? theme.text,
          fontSize: 16,
          fontWeight: "700",
          textAlign: "right",
          writingDirection: "rtl",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function DashboardStrip({ summary }: Props) {
  const { t } = useLanguage();
  const profitColor = summary.grossProfit >= 0 ? "#16A34A" : "#DC2626";
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 6 }}>
      <KPI label={t.classes.totalGroups} value={String(summary.totalGroups)} />
      <KPI label={t.classes.totalParticipants} value={String(summary.totalParticipants)} />
      <KPI label={t.classes.totalWeeklySessions} value={String(summary.totalWeeklySessions)} />
      <KPI label={t.classes.monthlyRevenue} value={formatCurrencyIls(summary.monthlyRevenue)} />
      <KPI label={t.classes.coachCost} value={formatCurrencyIls(summary.monthlyCoachCost)} />
      <KPI label={t.classes.assistantCost} value={formatCurrencyIls(summary.monthlyAssistantCost)} />
      <KPI label={t.classes.grossProfit} value={formatCurrencyIls(summary.grossProfit)} color={profitColor} />
      <KPI label={t.classes.overallMargin} value={formatPercent(summary.overallMargin)} color={profitColor} />
      <KPI label={t.classes.weeklyWallHours} value={summary.weeklyWallHours.toFixed(1)} />
      <KPI label={t.classes.weeklyKidsHours} value={summary.weeklyKidsHours.toFixed(1)} />
      <KPI label={t.classes.profitPerWallHour} value={formatCurrencyIls(summary.profitPerWallHour)} />
      <KPI label={t.classes.peakConcurrent} value={String(summary.peakConcurrent)} />
      <KPI label={t.classes.peakUtilization} value={formatPercent(summary.peakWallUtilization)} />
      <KPI label={t.classes.losingGroups} value={String(summary.losingGroupsCount)} color={summary.losingGroupsCount > 0 ? "#DC2626" : undefined} />
      <KPI label={t.classes.availableSeats} value={String(summary.totalAvailableSeats)} />
      <KPI label={t.classes.capacityViolations} value={String(summary.capacityViolationsCount)} color={summary.capacityViolationsCount > 0 ? "#DC2626" : undefined} />
    </ScrollView>
  );
}
