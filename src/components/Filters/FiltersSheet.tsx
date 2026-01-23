import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useFiltersStore } from '@/store/useFiltersStore';
import { getColorHex } from '@/constants/colors';
import { useLanguage } from '@/features/language';
import { useTheme } from '@/features/theme/ThemeContext';

interface FiltersSheetProps {
  availableColors?: string[];
  availableGrades?: string[];
  availableDates?: string[]; // תאריכים זמינים בפורמט YYYY-MM-DD
}

// All possible grades in order (VB to V18)
const ALL_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18'];

// פונקציית עזר להמרת תאריך YYYY-MM-DD לתצוגה בעברית
const formatDateForDisplay = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Sheet של פילטרים - צבעים, דרגות ותאריכים
 */
export default function FiltersSheet({
  availableColors = [],
  availableGrades = [],
  availableDates = [],
}: FiltersSheetProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const dynamicStyles = useMemo(() => createStyles(theme), [theme]);
  
  // Sort available grades in proper order
  const sortedGrades = useMemo(() => {
    return [...availableGrades].sort((a, b) => {
      const indexA = ALL_GRADES.indexOf(a);
      const indexB = ALL_GRADES.indexOf(b);
      return indexA - indexB;
    });
  }, [availableGrades]);
  
  console.log('[FiltersSheet] availableColors:', availableColors);
  console.log('[FiltersSheet] availableDates:', availableDates);
  console.log('[FiltersSheet] sortedGrades:', sortedGrades);
  
  const {
    filters,
    setFilter,
    resetFilters,
    isFilterSheetOpen,
    setFilterSheetOpen,
    getActiveFiltersCount,
  } = useFiltersStore();

  const activeFiltersCount = getActiveFiltersCount();

  const handleApply = () => {
    setFilterSheetOpen(false);
  };

  const handleColorToggle = (color: string) => {
    console.log('[FiltersSheet] Toggling color:', color, 'current:', filters.colors);
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter(c => c !== color)
      : [...filters.colors, color];
    setFilter('colors', newColors);
  };

  const handleGradeToggle = (grade: string) => {
    const { min, max } = filters.gradeRange;
    
    // If clicking the same grade that's already selected alone, clear it
    if (min === grade && max === grade) {
      setFilter('gradeRange', { min: '', max: '' });
      return;
    }
    
    // If no selection, start with this grade
    if (!min && !max) {
      setFilter('gradeRange', { min: grade, max: grade });
      return;
    }
    
    // If we have a selection, expand or contract the range
    const gradeIndex = ALL_GRADES.indexOf(grade);
    const minIndex = min ? ALL_GRADES.indexOf(min) : -1;
    const maxIndex = max ? ALL_GRADES.indexOf(max) : -1;
    
    if (minIndex === -1 || maxIndex === -1) {
      // Invalid state, reset to this grade
      setFilter('gradeRange', { min: grade, max: grade });
      return;
    }
    
    if (gradeIndex < minIndex) {
      // Expand range down
      setFilter('gradeRange', { min: grade, max });
    } else if (gradeIndex > maxIndex) {
      // Expand range up
      setFilter('gradeRange', { min, max: grade });
    } else {
      // Clicking inside range - set to single grade
      setFilter('gradeRange', { min: grade, max: grade });
    }
  };

  const isGradeSelected = (grade: string) => {
    const { min, max } = filters.gradeRange;
    if (!min && !max) return false;
    
    // Use ALL_GRADES for consistent ordering across all grades
    const gradeIndex = ALL_GRADES.indexOf(grade);
    const minIndex = min ? ALL_GRADES.indexOf(min) : 0;
    const maxIndex = max ? ALL_GRADES.indexOf(max) : ALL_GRADES.length - 1;
    
    return gradeIndex >= minIndex && gradeIndex <= maxIndex;
  };

  // Get display color - handle both hex and named colors
  const getDisplayColor = (color: string): string => {
    // If it's already a hex color, return it
    if (color?.startsWith('#')) {
      return color;
    }
    // Otherwise try to get hex from name
    return getColorHex(color) || '#808080';
  };

  // Get color name for display (if hex, try reverse lookup)
  const getColorName = (color: string): string => {
    if (!color?.startsWith('#')) {
      return color;
    }
    // For hex colors, just show the color visually without text
    return '';
  };

  // Get selected grades text for display
  const getSelectedGradesText = () => {
    const { min, max } = filters.gradeRange;
    if (!min && !max) return t.common.all;
    if (min === max) return min;
    return `${min} - ${max}`;
  };

  return (
    <Modal
      visible={isFilterSheetOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setFilterSheetOpen(false)}
    >
      <SafeAreaView style={dynamicStyles.container}>
        {/* Header */}
        <View style={dynamicStyles.header}>
          <TouchableOpacity
            style={dynamicStyles.headerButton}
            onPress={() => setFilterSheetOpen(false)}
          >
            <Text style={dynamicStyles.cancelText}>{t.common.cancel}</Text>
          </TouchableOpacity>
          
          <Text style={dynamicStyles.title}>{t.filters.title}</Text>
          
          <TouchableOpacity
            style={dynamicStyles.headerButton}
            onPress={handleApply}
          >
            <Text style={dynamicStyles.applyText}>{t.filters.apply}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={dynamicStyles.content}>
          {/* Colors Section */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>{t.filters.colors}</Text>
            {availableColors.length > 0 ? (
              <View style={dynamicStyles.colorsGrid}>
                {availableColors.map((color) => {
                  const displayColor = getDisplayColor(color);
                  const isSelected = filters.colors.includes(color);
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        dynamicStyles.colorChip,
                        { borderColor: displayColor },
                        isSelected && dynamicStyles.colorChipSelected,
                      ]}
                      onPress={() => handleColorToggle(color)}
                    >
                      <View
                        style={[dynamicStyles.colorIndicator, { backgroundColor: displayColor }]}
                      />
                      {isSelected && (
                        <Text style={dynamicStyles.colorCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={dynamicStyles.emptyText}>{t.filters.noColorsAvailable}</Text>
            )}
          </View>

          {/* Grades Section */}
          <View style={dynamicStyles.section}>
            <View style={dynamicStyles.sectionHeader}>
              <Text style={dynamicStyles.sectionTitle}>{t.filters.difficultyGrade}</Text>
              <Text style={dynamicStyles.selectedText}>{getSelectedGradesText()}</Text>
            </View>
            {sortedGrades.length > 0 ? (
              <>
                <Text style={dynamicStyles.sectionHint}>{t.filters.tapToSelectHint}</Text>
                <View style={dynamicStyles.gradesGrid}>
                  {sortedGrades.map((grade) => {
                    const isSelected = isGradeSelected(grade);
                    return (
                      <TouchableOpacity
                        key={grade}
                        style={[
                          dynamicStyles.gradeChip,
                          isSelected && dynamicStyles.gradeChipSelected,
                        ]}
                        onPress={() => handleGradeToggle(grade)}
                      >
                        <Text style={[
                          dynamicStyles.gradeText,
                          isSelected && dynamicStyles.gradeTextSelected,
                        ]}>
                          {grade}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={dynamicStyles.emptyText}>{t.filters.noGradesAvailable || 'No grades available'}</Text>
            )}
          </View>

          {/* Date Filter Section - Specific dates from routes */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>{t.filters.addedDate}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={dynamicStyles.dateChipsRow}
            >
              {/* כפתור 'הכל' תמיד ראשון */}
              <TouchableOpacity
                style={[
                  dynamicStyles.dateChip,
                  filters.dateRange === 'all' && dynamicStyles.dateChipSelected,
                ]}
                onPress={() => setFilter('dateRange', 'all')}
              >
                <Text style={[
                  dynamicStyles.dateChipText,
                  filters.dateRange === 'all' && dynamicStyles.dateChipTextSelected,
                ]}>
                  {t.common.all}
                </Text>
              </TouchableOpacity>
              
              {/* תאריכים ספציפיים */}
              {availableDates.map((dateStr) => {
                const isSelected = filters.dateRange === dateStr;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      dynamicStyles.dateChip,
                      isSelected && dynamicStyles.dateChipSelected,
                    ]}
                    onPress={() => setFilter('dateRange', dateStr)}
                  >
                    <Text style={[
                      dynamicStyles.dateChipText,
                      isSelected && dynamicStyles.dateChipTextSelected,
                    ]}>
                      {formatDateForDisplay(dateStr)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={dynamicStyles.footer}>
          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={dynamicStyles.resetButton}
              onPress={() => {
                resetFilters();
              }}
            >
              <Text style={dynamicStyles.resetButtonText}>נקה סינון ({activeFiltersCount})</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerButton: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  applyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  selectedText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorChip: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  colorChipSelected: {
    borderWidth: 4,
    transform: [{ scale: 1.1 }],
  },
  colorIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCheckmark: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  gradesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.isDark ? '#2a2a2a' : '#f9fafb',
    minWidth: 55,
    alignItems: 'center',
  },
  gradeChipSelected: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  gradeText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  gradeTextSelected: {
    color: '#ffffff',
  },
  dateChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.isDark ? '#2a2a2a' : '#f9fafb',
  },
  dateChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  dateChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dateChipTextSelected: {
    color: '#ffffff',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  resetButton: {
    backgroundColor: theme.error,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
