/**
 * @fileoverview Alerts list panel — shows all alerts grouped by severity.
 */

import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type { ClassAlert } from "../types";

interface Props {
  alerts: ClassAlert[];
}

function severityColor(s: ClassAlert["severity"]): string {
  if (s === "error") return "#DC2626";
  if (s === "warning") return "#F59E0B";
  return "#3B82F6";
}

export default function AlertsList({ alerts }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  if (alerts.length === 0) {
    return (
      <View style={{ padding: 16, alignItems: "center" }}>
        <Text
          style={{
            color: theme.textSecondary,
            writingDirection: "rtl",
            fontSize: 14,
          }}
        >
          {t.classes.noAlerts}
        </Text>
      </View>
    );
  }

  // Order by severity then by code for stable display.
  const order: Record<ClassAlert["severity"], number> = { error: 0, warning: 1, info: 2 };
  const sorted = [...alerts].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <ScrollView style={{ padding: 8 }}>
      {sorted.map((a, idx) => (
        <View
          key={`${a.code}-${idx}`}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            padding: 10,
            backgroundColor: theme.card,
            borderRadius: 8,
            marginBottom: 6,
            borderLeftWidth: 4,
            borderLeftColor: severityColor(a.severity),
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: severityColor(a.severity),
              marginLeft: 8,
            }}
          />
          <Text
            style={{
              color: theme.text,
              flex: 1,
              writingDirection: "rtl",
              textAlign: "right",
              fontSize: 13,
            }}
          >
            {a.message}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
