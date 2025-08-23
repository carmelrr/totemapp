import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { useFiltersStore } from '@/store/useFiltersStore';

interface FiltersSheetProps {
  availableColors?: string[];
  availableGrades?: string[];
  availableSetters?: string[];
  availableCircuits?: string[];
  availableWalls?: string[];
}

/**
 * Sheet של פילטרים מתקדם בסגנון TopLogger
 * כולל כל אפשרויות הסינון עם UI נקי ומסודר
 */
export default function FiltersSheet({
  availableColors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'purple', 'orange'],
  availableGrades = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'],
  availableSetters = [],
  availableCircuits = [],
  availableWalls = [],
}: FiltersSheetProps) {
  const {
    filters,
    setFilter,
    resetFilters,
    isFilterSheetOpen,
    setFilterSheetOpen,
    getActiveFiltersCount,
    searchQuery,
    setSearchQuery,
  } = useFiltersStore();

  const activeFiltersCount = getActiveFiltersCount();

  const handleApply = () => {
    setFilterSheetOpen(false);
  };

  const handleColorToggle = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter(c => c !== color)
      : [...filters.colors, color];
    setFilter('colors', newColors);
  };

  const handleCircuitToggle = (circuit: string) => {
    const newCircuits = filters.circuits.includes(circuit)
      ? filters.circuits.filter(c => c !== circuit)
      : [...filters.circuits, circuit];
    setFilter('circuits', newCircuits);
  };

  const handleStatusToggle = (status: 'active' | 'archived' | 'draft') => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    setFilter('status', newStatus);
  };

  const handleWallToggle = (wall: string) => {
    const newWalls = filters.walls.includes(wall)
      ? filters.walls.filter(w => w !== wall)
      : [...filters.walls, wall];
    setFilter('walls', newWalls);
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
          {/* חיפוש */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>חיפוש</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="חפש לפי שם, תיאור או תגיות..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* צבעים */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>צבעים</Text>
            <View style={styles.colorsGrid}>
              {availableColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorChip,
                    { borderColor: color },
                    filters.colors.includes(color) && { backgroundColor: color + '30' },
                  ]}
                  onPress={() => handleColorToggle(color)}
                >
                  <View
                    style={[styles.colorIndicator, { backgroundColor: color }]}
                  />
                  {filters.colors.includes(color) && (
                    <Text style={styles.colorCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* דרגות קושי */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>טווח דרגות</Text>
            <View style={styles.gradeRangeContainer}>
              <TextInput
                style={styles.gradeInput}
                placeholder="מ-"
                value={filters.gradeRange.min}
                onChangeText={(text) => setFilter('gradeRange', { ...filters.gradeRange, min: text })}
              />
              <Text style={styles.gradeRangeSeparator}>עד</Text>
              <TextInput
                style={styles.gradeInput}
                placeholder="עד"
                value={filters.gradeRange.max}
                onChangeText={(text) => setFilter('gradeRange', { ...filters.gradeRange, max: text })}
              />
            </View>
          </View>

          {/* סטטוס */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>סטטוס</Text>
            <View style={styles.statusOptions}>
              {[
                { key: 'active' as const, label: 'מסלולים פעילים' },
                { key: 'archived' as const, label: 'מסלולים בארכיון' },
                { key: 'draft' as const, label: 'טיוטות' },
              ].map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.statusOption}
                  onPress={() => handleStatusToggle(key)}
                >
                  <View style={[
                    styles.checkbox,
                    filters.status.includes(key) && styles.checkedBox,
                  ]}>
                    {filters.status.includes(key) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.statusLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* קירות */}
          {availableWalls.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>קירות</Text>
              <View style={styles.wallsGrid}>
                {availableWalls.map((wall) => (
                  <TouchableOpacity
                    key={wall}
                    style={[
                      styles.wallChip,
                      filters.walls.includes(wall) && styles.selectedChip,
                    ]}
                    onPress={() => handleWallToggle(wall)}
                  >
                    <Text style={[
                      styles.wallText,
                      filters.walls.includes(wall) && styles.selectedChipText,
                    ]}>
                      {wall}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* אפשרויות תצוגה */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>תצוגה</Text>
            
            <View style={styles.switchOption}>
              <Text style={styles.switchLabel}>הצג רק מסלולים הנראים במפה</Text>
              <Switch
                value={filters.showOnlyVisibleOnMap}
                onValueChange={(value) => setFilter('showOnlyVisibleOnMap', value)}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetFilters}
            >
              <Text style={styles.resetButtonText}>נקה הכל ({activeFiltersCount})</Text>
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
    paddingVertical: 12,
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
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9fafb',
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  colorIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  colorCheckmark: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gradesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gradeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    textAlign: 'center',
  },
  gradeRangeSeparator: {
    fontSize: 16,
    color: '#6b7280',
  },
  gradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  wallsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wallChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  wallText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  selectedChip: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  selectedChipText: {
    color: '#ffffff',
  },
  statusOptions: {
    gap: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkedBox: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statusLabel: {
    fontSize: 16,
    color: '#374151',
  },
  settersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  setterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  switchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  resetButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
