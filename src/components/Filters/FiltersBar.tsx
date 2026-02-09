import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';

export type SortOption = 'grade-asc' | 'grade-desc' | 'popularity' | 'most-repeats';

interface FiltersBarProps {
  routeCount?: number;
  visibleCount?: number;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

/**
 * רכיב סינון פשוט - כפתור אחד שפותח את חלון הסינון
 */
const FiltersBar = React.memo(function FiltersBar({
  routeCount = 0,
  visibleCount = 0,
  sortBy = 'grade-asc',
  onSortChange,
}: FiltersBarProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  
  // Dynamic sort options based on current language
  const sortOptions = useMemo(() => [
    { value: 'grade-asc' as SortOption, label: t.common.gradeEasyToHard, icon: 'trending-up-outline' },
    { value: 'grade-desc' as SortOption, label: t.common.gradeHardToEasy, icon: 'trending-down-outline' },
    { value: 'popularity' as SortOption, label: t.common.mostPopular, icon: 'trophy-outline' },
    { value: 'most-repeats' as SortOption, label: t.common.mostRepeats, icon: 'repeat-outline' },
  ], [t]);
  
  const {
    getActiveFiltersCount,
    setFilterSheetOpen,
    resetFilters,
  } = useFiltersStore();

  const [showSortModal, setShowSortModal] = useState(false);

  const activeFiltersCount = useMemo(() => getActiveFiltersCount(), [getActiveFiltersCount]);
  const currentSort = useMemo(() => sortOptions.find(o => o.value === sortBy) || sortOptions[0], [sortBy, sortOptions]);

  const handleSortSelect = useCallback((sort: SortOption) => {
    onSortChange?.(sort);
    setShowSortModal(false);
  }, [onSortChange]);

  const handleOpenFilters = useCallback(() => setFilterSheetOpen(true), [setFilterSheetOpen]);
  const handleOpenSort = useCallback(() => setShowSortModal(true), []);
  const handleCloseSort = useCallback(() => setShowSortModal(false), []);

  return (
    <View style={styles.container}>
      {/* Route count */}
      <Text style={styles.countText}>
        {visibleCount > 0 && visibleCount !== routeCount 
          ? `${visibleCount}/${routeCount}`
          : `${routeCount} ${t.common.routes}`
        }
      </Text>

      <View style={styles.buttonsRow}>
        {/* Sort button */}
        <TouchableOpacity
          style={styles.sortButton}
          onPress={handleOpenSort}
        >
          <Ionicons name="swap-vertical-outline" size={18} color={theme.primary} />
          <Text style={styles.sortButtonText}>{t.common.sort}</Text>
        </TouchableOpacity>

        {/* Filter button */}
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFiltersCount > 0 && styles.filterButtonActive,
          ]}
          onPress={handleOpenFilters}
        >
          <Ionicons 
            name={activeFiltersCount > 0 ? "funnel" : "funnel-outline"} 
            size={18} 
            color={activeFiltersCount > 0 ? theme.primary : theme.textSecondary} 
          />
          <Text style={[
            styles.filterButtonText, 
            activeFiltersCount > 0 && styles.filterButtonTextActive
          ]}>
            {t.common.filter}
          </Text>
          {activeFiltersCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>{t.common.sort}</Text>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortOption,
                  sortBy === option.value && styles.sortOptionActive,
                ]}
                onPress={() => handleSortSelect(option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={sortBy === option.value ? theme.primary : theme.textSecondary}
                />
                <Text style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}>
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

export default FiltersBar;

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    gap: 6,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    gap: 6,
  },
  filterButtonActive: {
    borderColor: theme.primary,
    borderWidth: 2,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
  filterButtonTextActive: {
    color: theme.primary,
  },
  badge: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: theme.error,
    fontWeight: '600',
  },
  // Sort Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sortModal: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  sortModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
  },
  sortOptionActive: {
    backgroundColor: theme.primary + '20',
  },
  sortOptionText: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
  },
  sortOptionTextActive: {
    color: theme.primary,
  },
});
