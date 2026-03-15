import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
  theme: any;
  suffix?: string;
  trend?: number; // percentage change
  subtitle?: string;
}

export default function StatCard({ label, value, color, theme, suffix, trend, subtitle }: StatCardProps) {
  const s = styles(theme);

  return (
    <View style={[s.card, { borderTopColor: color }]}>
      <View style={s.valueRow}>
        <Text style={s.value}>
          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
          {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
        </Text>
        {trend !== undefined && trend !== 0 && (
          <Text style={[s.trend, { color: trend > 0 ? '#4CAF50' : '#F44336' }]}>
            {trend > 0 ? '↑' : '↓'}{Math.abs(trend).toFixed(0)}%
          </Text>
        )}
      </View>
      <Text style={s.label}>{label}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderTopWidth: 3,
      minWidth: '30%',
      flex: 1,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    value: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    suffix: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    trend: {
      fontSize: 12,
      fontWeight: '700',
    },
    label: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 10,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 2,
      opacity: 0.7,
    },
  });
