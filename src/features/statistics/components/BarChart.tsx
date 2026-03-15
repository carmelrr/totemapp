import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { GRADE_COLORS } from '../constants';

export interface BarChartEntry {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartEntry[];
  height?: number;
  theme: any;
  onBarPress?: (index: number) => void;
  showValues?: boolean;
  horizontal?: boolean;
}

export default function BarChart({
  data,
  height = 200,
  theme,
  onBarPress,
  showValues = true,
  horizontal = false,
}: BarChartProps) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    const barHeight = 28;
    const totalHeight = data.length * (barHeight + 8) + 8;
    const labelWidth = 50;
    const chartWidth = 240;

    return (
      <View>
        {data.map((entry, i) => {
          const barW = (entry.value / maxVal) * chartWidth;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onBarPress?.(i)}
              activeOpacity={onBarPress ? 0.7 : 1}
              style={hStyles.row}
            >
              <Text style={[hStyles.label, { color: theme.textSecondary }]}>{entry.label}</Text>
              <View style={hStyles.barContainer}>
                <View
                  style={[
                    hStyles.bar,
                    {
                      width: Math.max(barW, 4),
                      backgroundColor: entry.color || theme.primary,
                    },
                  ]}
                />
                {showValues && (
                  <Text style={[hStyles.value, { color: theme.text }]}>{entry.value}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Vertical bar chart
  const chartWidth = data.length * 32;
  const chartHeight = height - 30;
  const barWidth = 22;
  const gap = 10;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={chartWidth} height={height}>
        {/* Y-axis baseline */}
        <Line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke={theme.border} strokeWidth={1} />
        {data.map((entry, i) => {
          const barH = (entry.value / maxVal) * (chartHeight - 10);
          const x = i * (barWidth + gap) + gap / 2;
          const y = chartHeight - barH;
          return (
            <React.Fragment key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                fill={entry.color || GRADE_COLORS[entry.label] || theme.primary}
                onPress={() => onBarPress?.(i)}
              />
              {showValues && entry.value > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 4}
                  fontSize={10}
                  fontWeight="600"
                  fill={theme.text}
                  textAnchor="middle"
                >
                  {entry.value}
                </SvgText>
              )}
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight + 14}
                fontSize={9}
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                {entry.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const hStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    width: 50,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginRight: 8,
  },
  barContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    height: 22,
    borderRadius: 6,
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});
