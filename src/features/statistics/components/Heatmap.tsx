import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ActivityHeatmapData } from '../types';
import { DAY_NAMES_HE, DAY_NAMES_EN } from '../constants';

interface HeatmapProps {
  data: ActivityHeatmapData;
  theme: any;
  language: 'he' | 'en';
  isUniqueUsers?: boolean;
}

function getHeatColor(value: number, max: number, primary: string): string {
  if (max === 0 || value === 0) return 'transparent';
  const intensity = value / max;
  // Use a green-based heat scale
  if (intensity > 0.8) return '#1B5E20';
  if (intensity > 0.6) return '#2E7D32';
  if (intensity > 0.4) return '#43A047';
  if (intensity > 0.2) return '#66BB6A';
  return '#A5D6A7';
}

export default function Heatmap({ data, theme, language, isUniqueUsers }: HeatmapProps) {
  const dayNames = language === 'he' ? DAY_NAMES_HE : DAY_NAMES_EN;
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6-23
  const cellSize = 16;
  const labelWidth = 44;

  return (
    <View>
      {/* Hour labels row */}
      <View style={[styles.row, { paddingLeft: labelWidth }]}>
        {hours.map((h) => (
          h % 2 === 0 ? (
            <Text key={h} style={[styles.hourLabel, { color: theme.textSecondary, width: cellSize + 2 }]}>
              {h}
            </Text>
          ) : (
            <View key={h} style={{ width: cellSize + 2 }} />
          )
        ))}
      </View>

      {/* Grid */}
      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
        <View key={day} style={[styles.row, { alignItems: 'center' }]}>
          <Text style={[styles.dayLabel, { color: theme.textSecondary }]} numberOfLines={1}>
            {dayNames[day]}
          </Text>
          {hours.map((hour) => {
            const cell = data.cells.find((c) => c.day === day && c.hour === hour);
            const count = cell?.count || 0;
            return (
              <View
                key={`${day}-${hour}`}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getHeatColor(count, data.maxValue, theme.primary),
                    borderColor: theme.background,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>
          {isUniqueUsers ? (language === 'he' ? 'פחות אנשים' : 'Fewer people') : (language === 'he' ? 'פחות פעילות' : 'Less')}
        </Text>
        <View style={styles.legendCells}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((i) => (
            <View
              key={i}
              style={[
                styles.legendCell,
                { backgroundColor: i === 0 ? theme.border : getHeatColor(i * 100, 100, theme.primary) },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>
          {isUniqueUsers ? (language === 'he' ? 'יותר אנשים' : 'More people') : (language === 'he' ? 'יותר פעילות' : 'More')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  hourLabel: {
    fontSize: 8,
    textAlign: 'center',
  },
  dayLabel: {
    width: 44,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'right',
    paddingRight: 6,
  },
  cell: {
    borderRadius: 3,
    borderWidth: 1,
    marginRight: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  legendCells: {
    flexDirection: 'row',
    gap: 2,
  },
  legendCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
  },
});
