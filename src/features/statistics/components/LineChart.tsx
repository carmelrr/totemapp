import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';

export interface LineDataSet {
  label: string;
  data: number[];
  color: string;
  visible?: boolean;
}

interface LineChartProps {
  datasets: LineDataSet[];
  labels?: string[];
  height?: number;
  theme: any;
  showDots?: boolean;
  showLabels?: boolean;
}

export default function LineChart({
  datasets,
  labels,
  height = 180,
  theme,
  showDots = true,
  showLabels = true,
}: LineChartProps) {
  const visibleSets = datasets.filter((d) => d.visible !== false);
  if (!visibleSets.length || !visibleSets[0].data.length) return null;

  const padding = { top: 10, right: 16, bottom: 30, left: 40 };
  const dataLen = visibleSets[0].data.length;
  const allValues = visibleSets.flatMap((d) => d.data);
  const maxVal = Math.max(...allValues, 1);
  const minVal = 0;

  const chartWidth = Math.max(dataLen * 30, 280);
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (i: number) => padding.left + (i / Math.max(dataLen - 1, 1)) * (chartWidth - padding.left - padding.right);
  const getY = (v: number) => padding.top + chartHeight - ((v - minVal) / (maxVal - minVal || 1)) * chartHeight;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={chartWidth} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + chartHeight * (1 - frac);
          const val = Math.round(minVal + (maxVal - minVal) * frac);
          return (
            <React.Fragment key={frac}>
              <Line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke={theme.border}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
              <SvgText x={padding.left - 4} y={y + 3} fontSize={9} fill={theme.textSecondary} textAnchor="end">
                {val}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Lines */}
        {visibleSets.map((ds) => {
          const points = ds.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
          return (
            <React.Fragment key={ds.label}>
              <Polyline
                points={points}
                fill="none"
                stroke={ds.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {showDots &&
                ds.data.map((v, i) => (
                  <Circle key={i} cx={getX(i)} cy={getY(v)} r={3} fill={ds.color} />
                ))}
            </React.Fragment>
          );
        })}

        {/* X Labels */}
        {showLabels && labels &&
          labels.map((lbl, i) => {
            // Show every Nth label to avoid overlap
            const step = Math.max(1, Math.ceil(labels.length / 8));
            if (i % step !== 0 && i !== labels.length - 1) return null;
            return (
              <SvgText
                key={i}
                x={getX(i)}
                y={height - 4}
                fontSize={8}
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                {lbl}
              </SvgText>
            );
          })}
      </Svg>

      {/* Legend */}
      {datasets.length > 1 && (
        <View style={styles.legend}>
          {datasets.map((ds) => (
            <View key={ds.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ds.color }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>{ds.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
  },
});
