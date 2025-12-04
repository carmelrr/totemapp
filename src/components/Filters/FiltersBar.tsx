import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useTheme } from '@/features/theme/ThemeContext';

export type SortOption = 'grade-asc' | 'grade-desc' | 'popularity';

interface FiltersBarProps {
  routeCount?: number;
  visibleCount?: number;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'grade-asc', label: 'דירוג קל לקשה (משתמשים)', icon: '📈' },
  { value: 'grade-desc', label: 'דירוג קשה לקל (משתמשים)', icon: '�' },
  { value: 'popularity', label: 'הכי פופולרי (כוכבים)', icon: '⭐' },
];

/**
 * רכיב סינון פשוט - כפתור אחד שפותח את חלון הסינון
 */
export default function FiltersBar({
  routeCount = 0,
  visibleCount = 0,
  sortBy = 'grade-asc',
  onSortChange,
}: FiltersBarProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const {
    getActiveFiltersCount,
    setFilterSheetOpen,
    resetFilters,
  } = useFiltersStore();

  const [showSortModal, setShowSortModal] = useState(false);

  const activeFiltersCount = getActiveFiltersCount();
  const currentSort = SORT_OPTIONS.find(o => o.value === sortBy) || SORT_OPTIONS[0];

  const handleSortSelect = (sort: SortOption) => {
    onSortChange?.(sort);
    setShowSortModal(false);
  };

  return (
    <View style={styles.container}>
      {/* Route count */}
      <Text style={styles.countText}>
        {visibleCount > 0 && visibleCount !== routeCount 
          ? `${visibleCount}/${routeCount}`
          : `${routeCount} מסלולים`
        }
      </Text>

      <View style={styles.buttonsRow}>
        {/* Sort button */}
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Text style={styles.sortIcon}>↕️</Text>
          <Text style={styles.sortButtonText}>מיון</Text>
        </TouchableOpacity>

        {/* Filter button */}
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFiltersCount > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setFilterSheetOpen(true)}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
          <Text style={[
            styles.filterButtonText, 
            activeFiltersCount > 0 && styles.filterButtonTextActive
          ]}>
            סינון
          </Text>
          {activeFiltersCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Clear button - only show when filters active */}
        {activeFiltersCount > 0 && (
          <TouchableOpacity onPress={resetFilters} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
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
            <Text style={styles.sortModalTitle}>מיון לפי</Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortOption,
                  sortBy === option.value && styles.sortOptionActive,
                ]}
                onPress={() => handleSortSelect(option.value)}
              >
                <Text style={styles.sortOptionIcon}>{option.icon}</Text>
                <Text style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}>
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    gap: 4,
  },
  sortIcon: {
    fontSize: 12,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterIcon: {
    fontSize: 12,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  badge: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.primary,
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
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sortModal: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  sortOptionActive: {
    backgroundColor: theme.isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
  },
  sortOptionIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  sortOptionText: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '700',
  },
});
