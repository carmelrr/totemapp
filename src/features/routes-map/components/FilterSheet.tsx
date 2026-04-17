import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteFilters, RouteSortBy, CompletionFilter } from '../types/route';
import { GRADES } from '../utils/grades';
import { useVisibleColors } from '../hooks/useVisibleColors';
import { useLanguage } from '@/features/language';
import { useTheme } from '@/features/theme/ThemeContext';
import { useUserRouteStatus } from '@/hooks/useUserRouteStatus';

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

const COMPLETION_OPTIONS: { key: CompletionFilter; labelKey: 'showAll' | 'showCompleted' | 'showNotCompleted' }[] = [
  { key: 'all', labelKey: 'showAll' },
  { key: 'completed', labelKey: 'showCompleted' },
  { key: 'not-completed', labelKey: 'showNotCompleted' },
];

export default function FilterSheet({
  visible,
  onClose,
  filters,
  sortBy,
  onFiltersChange,
  onSortChange,
}: FilterSheetProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { colors: visibleColors, getColorDisplayHex } = useVisibleColors();
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
      completionStatus: 'all',
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

  const setCompletionStatus = (status: CompletionFilter) => {
    setLocalFilters(prev => ({
      ...prev,
      completionStatus: status,
    }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t.common.filter}</Text>
            <TouchableOpacity onPress={handleApply}>
              <Text style={styles.applyButton}>{t.common.apply}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
          {/* Completion Status Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.filters.completionStatus}</Text>
            <View style={styles.chipContainer}>
              {COMPLETION_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.chip,
                    (localFilters.completionStatus || 'all') === option.key && styles.selectedChip,
                  ]}
                  onPress={() => setCompletionStatus(option.key)}
                  delayPressIn={50}
                >
                  <Text
                    style={[
                      styles.chipText,
                      (localFilters.completionStatus || 'all') === option.key && styles.selectedChipText,
                    ]}
                  >
                    {t.filters[option.labelKey]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort By Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.common.sort}</Text>
            {SORT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionRow,
                  localSortBy === option.key && styles.selectedOption,
                ]}
                onPress={() => setLocalSortBy(option.key)}
                delayPressIn={50}
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
                  delayPressIn={50}
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
                  delayPressIn={50}
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
              {visibleColors.map(color => {
                const displayColor = getColorDisplayHex(color);
                return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorChip,
                    { backgroundColor: displayColor },
                    localFilters.colors.includes(color) && styles.selectedColorChip,
                  ]}
                  onPress={() => toggleColor(color)}
                  delayPressIn={50}
                >
                  {localFilters.colors.includes(color) && (
                    <Text style={styles.colorCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Reset Button */}
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>{t.routes.clearFilters}</Text>
          </TouchableOpacity>
        </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  applyButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
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
    backgroundColor: theme.activeTab,
  },
  optionText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  selectedOptionText: {
    color: theme.secondary,
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 16,
    color: theme.secondary,
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
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedChip: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  selectedChipText: {
    color: '#fff',
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
    borderColor: theme.text,
  },
  colorCheckmark: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textShadowColor: theme.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resetButton: {
    marginVertical: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: theme.error,
    alignSelf: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
