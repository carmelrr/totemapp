import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFiltersStore } from '@/store/useFiltersStore';

interface FiltersBarProps {
  availableColors?: string[];
  availableGrades?: string[];
  availableCircuits?: string[];
}

/**
 * רכיב סינון מהיר עם צ'יפים לפילטרים נפוצים
 * דומה לסטייל של TopLogger עם צ'יפים צבעוניים
 */
export default function FiltersBar({
  availableColors = [],
  availableGrades = [],
  availableCircuits = [],
}: FiltersBarProps) {
  const {
    filters,
    setFilter,
    resetFilters,
    getActiveFiltersCount,
    setFilterSheetOpen,
  } = useFiltersStore();

  const activeFiltersCount = getActiveFiltersCount();

  const handleColorToggle = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter(c => c !== color)
      : [...filters.colors, color];
    setFilter('colors', newColors);
  };

  const handleStatusToggle = (status: 'active' | 'archived' | 'draft') => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    setFilter('status', newStatus);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* כפתור פילטרים מתקדם */}
        <TouchableOpacity
          style={[
            styles.chip,
            styles.filtersChip,
            activeFiltersCount > 0 && styles.activeChip,
          ]}
          onPress={() => setFilterSheetOpen(true)}
        >
          <Text style={[styles.chipText, activeFiltersCount > 0 && styles.activeChipText]}>
            סינון {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Text>
        </TouchableOpacity>

        {/* צ'יפים צבעים */}
        {availableColors.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.chip,
              styles.colorChip,
              { borderColor: color },
              filters.colors.includes(color) && { backgroundColor: color + '30' },
            ]}
            onPress={() => handleColorToggle(color)}
          >
            <View
              style={[
                styles.colorIndicator,
                { backgroundColor: color },
              ]}
            />
          </TouchableOpacity>
        ))}

        {/* צ'יפ סטטוס פעיל */}
        <TouchableOpacity
          style={[
            styles.chip,
            filters.status.includes('active') && styles.activeChip,
          ]}
          onPress={() => handleStatusToggle('active')}
        >
          <Text style={[
            styles.chipText,
            filters.status.includes('active') && styles.activeChipText,
          ]}>
            פעיל
          </Text>
        </TouchableOpacity>

        {/* צ'יפ מסלולים נראים במפה */}
        <TouchableOpacity
          style={[
            styles.chip,
            filters.showOnlyVisibleOnMap && styles.activeChip,
          ]}
          onPress={() => setFilter('showOnlyVisibleOnMap', !filters.showOnlyVisibleOnMap)}
        >
          <Text style={[
            styles.chipText,
            filters.showOnlyVisibleOnMap && styles.activeChipText,
          ]}>
            נראים במפה
          </Text>
        </TouchableOpacity>

        {/* כפתור איפוס פילטרים */}
        {activeFiltersCount > 0 && (
          <TouchableOpacity
            style={[styles.chip, styles.resetChip]}
            onPress={resetFilters}
          >
            <Text style={styles.resetChipText}>✕ נקה הכל</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  filtersChip: {
    backgroundColor: '#f3f4f6',
  },
  colorChip: {
    paddingHorizontal: 8,
    width: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeChip: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  resetChip: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  activeChipText: {
    color: '#ffffff',
  },
  resetChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
});
