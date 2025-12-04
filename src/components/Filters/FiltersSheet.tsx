import React from 'react';
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

interface FiltersSheetProps {
  availableColors?: string[];
  availableGrades?: string[];
}

// All possible grades in order (VB to V18)
const ALL_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18'];

/**
 * Sheet של פילטרים - צבעים ודרגות בלבד
 */
export default function FiltersSheet({
  availableColors = [],
  availableGrades = ALL_GRADES,
}: FiltersSheetProps) {
  console.log('[FiltersSheet] availableColors:', availableColors);
  
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
    if (!min && !max) return 'הכל';
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
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setFilterSheetOpen(false)}
          >
            <Text style={styles.cancelText}>ביטול</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>סינון מסלולים</Text>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleApply}
          >
            <Text style={styles.applyText}>הפעל</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Colors Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>צבעים</Text>
            {availableColors.length > 0 ? (
              <View style={styles.colorsGrid}>
                {availableColors.map((color) => {
                  const displayColor = getDisplayColor(color);
                  const isSelected = filters.colors.includes(color);
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorChip,
                        { borderColor: displayColor },
                        isSelected && styles.colorChipSelected,
                      ]}
                      onPress={() => handleColorToggle(color)}
                    >
                      <View
                        style={[styles.colorIndicator, { backgroundColor: displayColor }]}
                      />
                      {isSelected && (
                        <Text style={styles.colorCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>אין צבעים זמינים</Text>
            )}
          </View>

          {/* Grades Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>דרגת קושי</Text>
              <Text style={styles.selectedText}>{getSelectedGradesText()}</Text>
            </View>
            <Text style={styles.sectionHint}>לחץ על דרגה לבחירה, או על שתיים לטווח</Text>
            <View style={styles.gradesGrid}>
              {ALL_GRADES.map((grade) => {
                const isSelected = isGradeSelected(grade);
                return (
                  <TouchableOpacity
                    key={grade}
                    style={[
                      styles.gradeChip,
                      isSelected && styles.gradeChipSelected,
                    ]}
                    onPress={() => handleGradeToggle(grade)}
                  >
                    <Text style={[
                      styles.gradeText,
                      isSelected && styles.gradeTextSelected,
                    ]}>
                      {grade}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                resetFilters();
              }}
            >
              <Text style={styles.resetButtonText}>נקה סינון ({activeFiltersCount})</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: '#6b7280',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  applyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
    color: '#111827',
  },
  selectedText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
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
    backgroundColor: '#ffffff',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minWidth: 55,
    alignItems: 'center',
  },
  gradeChipSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  gradeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  gradeTextSelected: {
    color: '#ffffff',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  resetButton: {
    backgroundColor: '#ef4444',
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
