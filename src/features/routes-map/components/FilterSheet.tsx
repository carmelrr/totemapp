import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { RouteFilters, RouteSortBy } from '../types/route';
import { GRADES } from '../utils/grades';
import { ROUTE_COLORS } from '../utils/colors';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: RouteFilters;
  sortBy: RouteSortBy;
  onFiltersChange: (filters: RouteFilters) => void;
  onSortChange: (sortBy: RouteSortBy) => void;
}

const SORT_OPTIONS: { key: RouteSortBy; label: string }[] = [
  { key: 'distance', label: 'Distance from center' },
  { key: 'grade-asc', label: 'Grade (Easy to Hard)' },
  { key: 'grade-desc', label: 'Grade (Hard to Easy)' },
  { key: 'rating', label: 'Rating' },
  { key: 'newest', label: 'Newest first' },
];

const STATUS_OPTIONS: Array<'active' | 'archived' | 'draft'> = ['active', 'archived', 'draft'];

export default function FilterSheet({
  visible,
  onClose,
  filters,
  sortBy,
  onFiltersChange,
  onSortChange,
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<RouteFilters>(filters);
  const [localSortBy, setLocalSortBy] = useState<RouteSortBy>(sortBy);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onSortChange(localSortBy);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: RouteFilters = {
      grades: [],
      colors: [],
      status: ['active'],
      tags: [],
    };
    setLocalFilters(resetFilters);
    setLocalSortBy('distance');
  };

  const toggleGrade = (grade: string) => {
    setLocalFilters(prev => ({
      ...prev,
      grades: prev.grades.includes(grade)
        ? prev.grades.filter(g => g !== grade)
        : [...prev.grades, grade],
    }));
  };

  const toggleColor = (color: string) => {
    setLocalFilters(prev => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter(c => c !== color)
        : [...prev.colors, color],
    }));
  };

  const toggleStatus = (status: 'active' | 'archived' | 'draft') => {
    setLocalFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status],
    }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filter & Sort</Text>
          <TouchableOpacity onPress={handleApply}>
            <Text style={styles.applyButton}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Sort By Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            {SORT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionRow,
                  localSortBy === option.key && styles.selectedOption,
                ]}
                onPress={() => setLocalSortBy(option.key)}
              >
                <Text
                  style={[
                    styles.optionText,
                    localSortBy === option.key && styles.selectedOptionText,
                  ]}
                >
                  {option.label}
                </Text>
                {localSortBy === option.key && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Status Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.chipContainer}>
              {STATUS_OPTIONS.map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.chip,
                    localFilters.status.includes(status) && styles.selectedChip,
                  ]}
                  onPress={() => toggleStatus(status)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      localFilters.status.includes(status) && styles.selectedChipText,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Grade Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grades</Text>
            <View style={styles.chipContainer}>
              {GRADES.map(grade => (
                <TouchableOpacity
                  key={grade}
                  style={[
                    styles.chip,
                    localFilters.grades.includes(grade) && styles.selectedChip,
                  ]}
                  onPress={() => toggleGrade(grade)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      localFilters.grades.includes(grade) && styles.selectedChipText,
                    ]}
                  >
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Color Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Colors</Text>
            <View style={styles.colorGrid}>
              {ROUTE_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorChip,
                    { backgroundColor: color },
                    localFilters.colors.includes(color) && styles.selectedColorChip,
                  ]}
                  onPress={() => toggleColor(color)}
                >
                  {localFilters.colors.includes(color) && (
                    <Text style={styles.colorCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Reset Button */}
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset All Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6b7280',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  applyButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  selectedOption: {
    backgroundColor: '#dbeafe',
  },
  optionText: {
    fontSize: 14,
    color: '#4b5563',
  },
  selectedOptionText: {
    color: '#1d4ed8',
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 16,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  selectedChip: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  chipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  selectedChipText: {
    color: '#ffffff',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorChip: {
    borderColor: '#1f2937',
  },
  colorCheckmark: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resetButton: {
    marginVertical: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignSelf: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
