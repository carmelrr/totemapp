import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { DatePeriod } from '../types';

interface PeriodFilterProps {
  selected: DatePeriod;
  onSelect: (period: DatePeriod) => void;
  theme: any;
  isRTL: boolean;
  labels: { '7d': string; '30d': string; '90d': string; '1y': string; all: string };
}

export default function PeriodFilter({ selected, onSelect, theme, isRTL, labels }: PeriodFilterProps) {
  const periods: DatePeriod[] = ['7d', '30d', '90d', '1y', 'all'];

  return (
    <View style={[styles.wrapper, { borderBottomColor: theme.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.container, isRTL && { flexDirection: 'row-reverse' }]}
      >
        {periods.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => onSelect(p)}
            style={[
              styles.chip,
              { backgroundColor: theme.surface, borderColor: theme.border },
              selected === p && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: theme.textSecondary },
                selected === p && { color: '#fff', fontWeight: '700' },
              ]}
            >
              {labels[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
  },
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
