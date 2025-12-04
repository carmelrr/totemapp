import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { RouteDoc } from '../types/route';
import { ROUTE_COLORS, getColorName, getContrastTextColor } from '../utils/colors';
import { GRADES } from '../utils/grades';
import { RoutesService } from '../services/RoutesService';

interface RouteEditModalProps {
  visible: boolean;
  route: RouteDoc | null;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onMoveRoute?: (route: RouteDoc) => void;
}

export default function RouteEditModal({
  visible,
  route,
  onClose,
  onSave,
  onDelete,
  onMoveRoute,
}: RouteEditModalProps) {
  const [grade, setGrade] = useState(route?.grade || 'V0');
  const [color, setColor] = useState(route?.color || ROUTE_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when route changes
  React.useEffect(() => {
    if (route) {
      setGrade(route.grade);
      setColor(route.color);
    }
  }, [route]);

  const handleSave = async () => {
    if (!route) return;

    setIsSubmitting(true);
    try {
      // Generate new name based on grade and color
      const colorName = getColorName(color);
      const newName = `${grade} ${colorName}`;

      await RoutesService.updateRoute(route.id, {
        name: newName,
        grade,
        color,
      });

      Alert.alert('הצלחה', 'המסלול עודכן בהצלחה');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating route:', error);
      Alert.alert('שגיאה', 'לא ניתן לעדכן את המסלול');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveRoute = () => {
    console.log('[RouteEditModal] handleMoveRoute called');
    console.log('[RouteEditModal] route:', route?.id);
    console.log('[RouteEditModal] onMoveRoute exists:', !!onMoveRoute);
    
    if (route && onMoveRoute) {
      console.log('[RouteEditModal] Calling onClose...');
      onClose();
      console.log('[RouteEditModal] Calling onMoveRoute...');
      try {
        onMoveRoute(route);
        console.log('[RouteEditModal] onMoveRoute completed');
      } catch (error) {
        console.error('[RouteEditModal] Error in onMoveRoute:', error);
      }
    }
  };

  const handleDelete = async () => {
    if (!route) return;

    Alert.alert(
      'מחיקת מסלול',
      'האם אתה בטוח שברצונך למחוק את המסלול?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await RoutesService.deleteRoute(route.id);
              Alert.alert('הצלחה', 'המסלול נמחק');
              onDelete?.();
              onClose();
            } catch (error) {
              console.error('Error deleting route:', error);
              Alert.alert('שגיאה', 'לא ניתן למחוק את המסלול');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (!route) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>ביטול</Text>
          </TouchableOpacity>
          <Text style={styles.title}>עריכת מסלול</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSubmitting}>
            <Text style={[styles.saveButton, isSubmitting && styles.disabledButton]}>
              {isSubmitting ? 'שומר...' : 'שמור'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Current Route Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>מסלול נוכחי:</Text>
            <Text style={styles.infoValue}>{route.name}</Text>
          </View>

          {/* Grade Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>דרגת קושי</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.gradeContainer}>
                {GRADES.map((gradeOption) => (
                  <TouchableOpacity
                    key={gradeOption}
                    style={[
                      styles.gradeChip,
                      grade === gradeOption && styles.selectedGradeChip,
                    ]}
                    onPress={() => setGrade(gradeOption)}
                  >
                    <Text
                      style={[
                        styles.gradeChipText,
                        grade === gradeOption && styles.selectedGradeChipText,
                      ]}
                    >
                      {gradeOption}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Color Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>צבע</Text>
            <View style={styles.colorGrid}>
              {ROUTE_COLORS.map((colorOption) => (
                <TouchableOpacity
                  key={colorOption}
                  style={[
                    styles.colorChip,
                    { backgroundColor: colorOption },
                    color === colorOption && styles.selectedColorChip,
                  ]}
                  onPress={() => setColor(colorOption)}
                >
                  {color === colorOption && (
                    <Text style={[styles.colorCheckmark, { color: getContrastTextColor(colorOption) }]}>
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Move Route Button */}
          {onMoveRoute && (
            <TouchableOpacity
              style={styles.moveButton}
              onPress={handleMoveRoute}
            >
              <Text style={styles.moveButtonText}>📍 הזז מיקום על המפה</Text>
            </TouchableOpacity>
          )}

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isSubmitting}
          >
            <Text style={styles.deleteButtonText}>מחק מסלול</Text>
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
    paddingVertical: 14,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  disabledButton: {
    color: '#9ca3af',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoSection: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  gradeContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  gradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  selectedGradeChip: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  gradeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  selectedGradeChipText: {
    color: '#ffffff',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColorChip: {
    borderColor: '#1f2937',
  },
  colorCheckmark: {
    fontSize: 20,
    fontWeight: '600',
  },
  moveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  moveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
