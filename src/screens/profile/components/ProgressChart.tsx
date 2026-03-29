import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import Svg, { Rect, Line, Text as SvgText, Circle, Polyline } from "react-native-svg";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { GRADE_GROUP_COLORS, GRADE_ORDER, gradeIndex } from "@/features/statistics/constants";
import type { ProgressHistory, MonthlyProgress } from "../types";

const MONTH_NAMES_HE = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ProgressChartProps {
  data: ProgressHistory | null;
  loading: boolean;
}

export function ProgressChart({ data, loading }: ProgressChartProps) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const isHebrew = language === "he";
  const monthNames = isHebrew ? MONTH_NAMES_HE : MONTH_NAMES_EN;

  const styles = useMemo(() => createStyles(theme), [theme]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t.profile.myProgress}</Text>
        <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 30 }} />
      </View>
    );
  }

  if (!data || data.monthlyData.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t.profile.myProgress}</Text>
        <Text style={styles.emptyText}>{t.profile.noProgressYet}</Text>
      </View>
    );
  }

  // Show last 12 months max for readability
  const displayData = data.monthlyData.slice(-12);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.profile.myProgress}</Text>

      {/* Legend */}
      <View style={styles.legend}>
        {([
          { key: "easy", label: isHebrew ? "קל (V0-2)" : "Easy (V0-2)", color: GRADE_GROUP_COLORS.easy },
          { key: "medium", label: isHebrew ? "קל+ (V3-4)" : "Easy+ (V3-4)", color: GRADE_GROUP_COLORS.medium },
          { key: "hard", label: isHebrew ? "קל++ (V5-6)" : "Easy++ (V5-6)", color: GRADE_GROUP_COLORS.hard },
          { key: "elite", label: isHebrew ? "קל+++ (V7+)" : "Easy+++ (V7+)", color: GRADE_GROUP_COLORS.elite },
        ] as const).map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Stacked Bar Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <StackedBarChart data={displayData} monthNames={monthNames} theme={theme} />
      </ScrollView>

      {/* Milestones */}
      {data.milestones.length > 0 && (
        <View style={styles.milestonesSection}>
          <Text style={styles.milestonesTitle}>{t.profile.milestones}</Text>
          {data.milestones.map((m, i) => {
            const d = m.date;
            const monthLabel = monthNames[d.getMonth()];
            const year = d.getFullYear();
            return (
              <View key={i} style={styles.milestoneRow}>
                <Text style={styles.milestoneIcon}>🏆</Text>
                <Text style={styles.milestoneText}>
                  {isHebrew
                    ? `סגירה ראשונה של ${m.label} — ${monthLabel} ${year}`
                    : `First ${m.label} send — ${monthLabel} ${year}`}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// === Stacked Bar Chart (SVG) ===

interface StackedBarChartProps {
  data: MonthlyProgress[];
  monthNames: string[];
  theme: any;
}

function StackedBarChart({ data, monthNames, theme }: StackedBarChartProps) {
  const barWidth = 28;
  const gap = 14;
  const chartHeight = 180;
  const paddingTop = 20;
  const paddingBottom = 32;
  const paddingLeft = 36;
  const drawHeight = chartHeight - paddingTop - paddingBottom;

  const totalWidth = paddingLeft + data.length * (barWidth + gap) + gap;
  const maxVal = Math.max(...data.map((d) => d.totalSends), 1);

  // Compute grade index values for highest-grade line
  const gradeValues = data.map((d) => gradeIndex(d.highestGrade));
  const maxGradeVal = Math.max(...gradeValues, 1);

  const getBarX = (i: number) => paddingLeft + i * (barWidth + gap) + gap / 2;
  const getY = (val: number) => paddingTop + drawHeight - (val / maxVal) * drawHeight;
  const getGradeY = (gv: number) => paddingTop + drawHeight - (gv / maxGradeVal) * drawHeight;

  // Build polyline for highest grade trend
  const gradePoints = gradeValues.map((gv, i) => `${getBarX(i) + barWidth / 2},${getGradeY(gv)}`).join(" ");

  return (
    <Svg width={totalWidth} height={chartHeight}>
      {/* Horizontal grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = paddingTop + drawHeight * (1 - frac);
        const val = Math.round(maxVal * frac);
        return (
          <React.Fragment key={frac}>
            <Line
              x1={paddingLeft}
              y1={y}
              x2={totalWidth - gap}
              y2={y}
              stroke={theme.border}
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
            <SvgText x={paddingLeft - 4} y={y + 3} fontSize={9} fill={theme.textSecondary} textAnchor="end">
              {val}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Stacked bars */}
      {data.map((d, i) => {
        const x = getBarX(i);
        const segments = [
          { value: d.easy, color: GRADE_GROUP_COLORS.easy },
          { value: d.medium, color: GRADE_GROUP_COLORS.medium },
          { value: d.hard, color: GRADE_GROUP_COLORS.hard },
          { value: d.elite, color: GRADE_GROUP_COLORS.elite },
        ];

        let yOffset = 0;
        return (
          <React.Fragment key={i}>
            {segments.map((seg, si) => {
              if (seg.value === 0) return null;
              const segHeight = (seg.value / maxVal) * drawHeight;
              const segY = paddingTop + drawHeight - yOffset - segHeight;
              yOffset += segHeight;
              return (
                <Rect
                  key={si}
                  x={x}
                  y={segY}
                  width={barWidth}
                  height={segHeight}
                  rx={si === segments.length - 1 || (si === segments.findIndex(s => s.value > 0)) ? 3 : 0}
                  fill={seg.color}
                />
              );
            })}

            {/* Total value on top */}
            {d.totalSends > 0 && (
              <SvgText
                x={x + barWidth / 2}
                y={paddingTop + drawHeight - yOffset - 4}
                fontSize={9}
                fontWeight="600"
                fill={theme.text}
                textAnchor="middle"
              >
                {d.totalSends}
              </SvgText>
            )}

            {/* Month label */}
            <SvgText
              x={x + barWidth / 2}
              y={chartHeight - 6}
              fontSize={8}
              fill={theme.textSecondary}
              textAnchor="middle"
            >
              {formatMonthLabel(d.month, monthNames)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Highest grade trend line */}
      <Polyline
        points={gradePoints}
        fill="none"
        stroke={theme.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6,3"
      />
      {gradeValues.map((gv, i) => (
        <React.Fragment key={`dot-${i}`}>
          <Circle cx={getBarX(i) + barWidth / 2} cy={getGradeY(gv)} r={3.5} fill={theme.primary} />
          <SvgText
            x={getBarX(i) + barWidth / 2}
            y={getGradeY(gv) - 6}
            fontSize={7}
            fontWeight="bold"
            fill={theme.primary}
            textAnchor="middle"
          >
            {data[i].highestGrade}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

function formatMonthLabel(monthKey: string, monthNames: string[]): string {
  const [, monthStr] = monthKey.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  return monthNames[monthIdx] || monthStr;
}

// === Styles ===

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 20,
      marginHorizontal: 20,
      marginBottom: 15,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 5,
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      paddingVertical: 24,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginBottom: 12,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    milestonesSection: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
    },
    milestonesTitle: {
      fontSize: 15,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 8,
    },
    milestoneRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    milestoneIcon: {
      fontSize: 14,
    },
    milestoneText: {
      fontSize: 13,
      color: theme.textSecondary,
      flex: 1,
    },
  });
}
