import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FeedbackService } from '../services/FeedbackService';
import { RouteDoc } from '../types/route';
import { ROUTE_COLORS, getVisibleColors, getColorTranslationKey, getContrastTextColor, getRouteDisplayName } from '../utils/colors';
import { GRADES } from '../utils/grades';
import { RoutesService } from '../services/RoutesService';
import { getColorSettingSync, initializeColorSettings, getColorDisplayHex, resolveOriginalColorKey } from '../services/ColorSettingsService';
import { useLanguage } from '@/features/language';
import { useTheme } from '@/features/theme/ThemeContext';
import { useWallTapes } from '../hooks/useWallTapes';

interface RouteEditModalProps {
  visible: boolean;
  route: RouteDoc | null;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onMoveRoute?: (route: RouteDoc) => void;
}

interface RouteFeedback {
  id: string;
  userId?: string;
  userDisplayName?: string;
  starRating: number;
  suggestedGrade?: string;
  comment?: string;
  createdAt?: any;
  isCompleted?: boolean;
}

export default function RouteEditModal({
  visible,
  route,
  onClose,
  onSave,
  onDelete,
  onMoveRoute,
}: RouteEditModalProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [grade, setGrade] = useState(route?.grade || 'V0');
  const [color, setColor] = useState(route?.color || ROUTE_COLORS[0]);
  const [wallTape, setWallTape] = useState(route?.wallTape || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbacks, setFeedbacks] = useState<RouteFeedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [colorSettingsReady, setColorSettingsReady] = useState(false);

  // Wall tapes
  const { tapes } = useWallTapes();

  // Initialize color settings cache when modal opens
  useEffect(() => {
    if (visible) {
      initializeColorSettings().then(() => {
        setColorSettingsReady(prev => !prev); // toggle to trigger re-render
        // Re-resolve color after cache is loaded
        if (route) {
          setColor(resolveOriginalColorKey(route.color));
        }
      });
    }
  }, [visible]);

  // Reset state when route changes — resolve color back to original key
  // so it matches getVisibleColors() keys for the grid selection
  React.useEffect(() => {
    if (route) {
      setGrade(route.grade);
      setColor(resolveOriginalColorKey(route.color));
      setWallTape(route.wallTape || '');
    }
  }, [route]);

  // Subscribe to feedbacks when modal is visible
  useEffect(() => {
    if (!visible || !route?.id) {
      setFeedbacks([]);
      return;
    }

    setLoadingFeedbacks(true);
    const unsubscribe = FeedbackService.subscribeFeedbacksForRoute(
      route.id,
      (newFeedbacks) => {
        // Sort by date, newest first
        const sorted = [...newFeedbacks].sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        setFeedbacks(sorted);
        setLoadingFeedbacks(false);
      }
    );

    return () => unsubscribe();
  }, [visible, route?.id]);

  // Generate bilingual names from grade and color (same logic as AddRouteMapScreen)
  const getRouteNames = (selectedColor: string, selectedGrade: string): { nameHe: string; nameEn: string } => {
    const colorKey = getColorTranslationKey(selectedColor);
    let colorNameHe: string;
    let colorNameEn: string;

    // First check if there's a custom color setting saved
    const customSetting = getColorSettingSync(selectedColor);
    if (customSetting) {
      colorNameHe = customSetting.nameHe;
      colorNameEn = customSetting.nameEn;
    } else {
      // Get from translations for both languages
      const { he: heTranslations } = require('@/features/language/translations/he');
      const { en: enTranslations } = require('@/features/language/translations/en');
      colorNameHe = heTranslations?.colors?.[colorKey] || colorKey;
      colorNameEn = enTranslations?.colors?.[colorKey] || colorKey;
    }

    return {
      nameHe: `${colorNameHe} ${selectedGrade}`,
      nameEn: `${colorNameEn} ${selectedGrade}`,
    };
  };

  const handleSave = async () => {
    if (!route) return;

    setIsSubmitting(true);
    try {
      // Generate bilingual names based on grade and color
      const names = getRouteNames(color, grade);
      // Use the display hex (customized shade) to stay consistent with ColorPickerScreen
      const displayColor = getColorDisplayHex(color);

      await RoutesService.updateRoute(route.id, {
        name: names.nameHe, // Default name (Hebrew for backward compat)
        nameHe: names.nameHe,
        nameEn: names.nameEn,
        grade,
        color: displayColor,
        wallTape: wallTape || '',
      });

      // Also update other routes with the same color that don't have bilingual names yet
      // Check both display hex AND original key to catch all variants
      const colorKey = getColorTranslationKey(color);
      const customSetting = getColorSettingSync(color);
      const colorNameHe = customSetting?.nameHe ||
        require('@/features/language/translations/he').he?.colors?.[colorKey] || colorKey;
      const colorNameEn = customSetting?.nameEn ||
        require('@/features/language/translations/en').en?.colors?.[colorKey] || colorKey;

      let updatedCount = 0;

      // Normalize routes that still have the OLD original hex to the correct display hex
      if (color.toUpperCase() !== displayColor.toUpperCase()) {
        updatedCount += await RoutesService.normalizeRouteColor(
          color,
          displayColor,
          colorNameHe,
          colorNameEn,
          route.id
        );
      }

      // Update bilingual names for routes with the display hex that don't have them yet
      updatedCount += await RoutesService.updateRouteNamesByColor(
        displayColor,
        colorNameHe,
        colorNameEn,
        route.id
      );

      if (updatedCount > 0) {
        Alert.alert(
          t.common.success,
          `${t.routes.routeUpdated}\n${updatedCount} ${t.routes.additionalRoutesUpdated || 'מסלולים נוספים עודכנו'}`
        );
      } else {
        Alert.alert(t.common.success, t.routes.routeUpdated);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating route:', error);
      Alert.alert(t.common.error, t.routes.cannotUpdateRoute);
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
      t.routes.deleteRoute || 'מחיקת מסלול',
      t.archive?.moveToTrashConfirm || 'המסלול יועבר לארכיון וימחק לצמיתות אחרי 14 יום. האם להמשיך?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.archive?.moveToTrash || 'העבר לארכיון',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await RoutesService.archiveRoute(route.id);
              Alert.alert(
                t.common.success, 
                t.archive?.movedToTrash || 'המסלול הועבר לארכיון'
              );
              onDelete?.();
              onClose();
            } catch (error) {
              console.error('Error archiving route:', error);
              Alert.alert(t.common.error, t.routes.cannotDeleteRoute);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteFeedback = (feedback: RouteFeedback) => {
    Alert.alert(
      t.routes?.deleteFeedback || 'מחיקת תגובה',
      t.routes?.deleteFeedbackConfirm || `האם למחוק את התגובה של ${feedback.userDisplayName || 'משתמש'}?`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete || 'מחק',
          style: 'destructive',
          onPress: async () => {
            setDeletingFeedbackId(feedback.id);
            try {
              await FeedbackService.deleteFeedback(feedback.id);
              Alert.alert(t.common.success, t.alerts.feedbackDeleted);
            } catch (error) {
              console.error('Error deleting feedback:', error);
              Alert.alert(t.common.error, t.alerts.feedbackDeleteFailed);
            } finally {
              setDeletingFeedbackId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(Math.min(5, Math.max(0, rating)));
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
            <Text style={styles.cancelButton}>{t.common.cancel}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t.routes.editRoute}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSubmitting}>
            <Text style={[styles.saveButton, isSubmitting && styles.disabledButton]}>
              {isSubmitting ? t.routes.saving : t.common.save}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Current Route Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>{t.routes.currentRoute}</Text>
            <Text style={styles.infoValue}>{getRouteDisplayName(route, language, t)}</Text>
            {/* Preview of updated name */}
            {(() => {
              const names = getRouteNames(color, grade);
              const newDisplayName = language === 'he' ? names.nameHe : names.nameEn;
              const currentName = getRouteDisplayName(route, language, t);
              if (newDisplayName !== currentName) {
                return (
                  <Text style={styles.infoPreview}>
                    → {newDisplayName}
                  </Text>
                );
              }
              return null;
            })()}
          </View>

          {/* Grade Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.routes.difficultyGrade}</Text>
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
            <Text style={styles.sectionTitle}>{t.routes.color}</Text>
            <View style={styles.colorGrid}>
              {getVisibleColors().map((colorOption) => {
                const displayColor = getColorDisplayHex(colorOption);
                const cSetting = getColorSettingSync(colorOption);
                const cKey = getColorTranslationKey(colorOption);
                const colorLabel = cSetting
                  ? (language === 'he' ? cSetting.nameHe : cSetting.nameEn)
                  : (t.colors[cKey as keyof typeof t.colors] || cKey);
                return (
                  <View key={colorOption} style={styles.colorChipContainer}>
                    <TouchableOpacity
                      style={[
                        styles.colorChip,
                        { backgroundColor: displayColor },
                        color === colorOption && styles.selectedColorChip,
                      ]}
                      onPress={() => setColor(colorOption)}
                    >
                      {color === colorOption && (
                        <Text style={[styles.colorCheckmark, { color: getContrastTextColor(displayColor) }]}>
                          ✓
                        </Text>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.colorLabel} numberOfLines={1}>{colorLabel}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Move Route Button */}
          {onMoveRoute && (
            <TouchableOpacity
              style={styles.moveButton}
              onPress={handleMoveRoute}
            >
              <Text style={styles.moveButtonText}>{t.routes.moveLocationOnMap}</Text>
            </TouchableOpacity>
          )}

          {/* Wall Tape Selection */}
          {tapes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.wallTape?.wallTape || 'Wall Tape'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tapeRow}>
                  {/* "None" option */}
                  <TouchableOpacity
                    style={[
                      styles.tapeChip,
                      !wallTape && styles.tapeChipSelected,
                    ]}
                    onPress={() => setWallTape('')}
                  >
                    <Text style={[
                      styles.tapeChipText,
                      !wallTape && styles.tapeChipTextSelected,
                    ]}>
                      {t.wallTape?.none || '—'}
                    </Text>
                  </TouchableOpacity>
                  {tapes.map((tape) => {
                    const isSelected = wallTape === tape.id;
                    const contrastColor = (() => {
                      const c = tape.hex.replace('#', '');
                      const r = parseInt(c.substr(0, 2), 16) || 0;
                      const g = parseInt(c.substr(2, 2), 16) || 0;
                      const b = parseInt(c.substr(4, 2), 16) || 0;
                      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
                    })();
                    return (
                      <TouchableOpacity
                        key={tape.id}
                        style={[
                          styles.tapeChip,
                          { borderColor: tape.hex },
                          isSelected && { backgroundColor: tape.hex, borderColor: tape.hex },
                        ]}
                        onPress={() => setWallTape(tape.id)}
                      >
                        <View style={[styles.tapeDot, { backgroundColor: tape.hex }]} />
                        <Text style={[
                          styles.tapeChipText,
                          isSelected && { color: contrastColor },
                        ]}>
                          {language === 'he' ? tape.nameHe : tape.nameEn}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isSubmitting}
          >
            <Text style={styles.deleteButtonText}>{t.routes.deleteRoute}</Text>
          </TouchableOpacity>

          {/* Feedbacks Section */}
          <View style={styles.feedbacksSection}>
            <Text style={styles.sectionTitle}>
              {t.routes?.userFeedbacks || 'תגובות משתמשים'} ({feedbacks.length})
            </Text>
            
            {loadingFeedbacks ? (
              <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 20 }} />
            ) : feedbacks.length === 0 ? (
              <Text style={styles.noFeedbacksText}>
                {t.routes?.noFeedbacks || 'אין תגובות למסלול זה'}
              </Text>
            ) : (
              feedbacks.map((feedback) => (
                <View key={feedback.id} style={styles.feedbackCard}>
                  <View style={styles.feedbackHeader}>
                    <View style={styles.feedbackUserInfo}>
                      <Text style={styles.feedbackUserName}>
                        {feedback.userDisplayName || t.routes?.anonymousUser || 'משתמש אנונימי'}
                      </Text>
                      <Text style={styles.feedbackDate}>{formatDate(feedback.createdAt)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteFeedbackButton}
                      onPress={() => handleDeleteFeedback(feedback)}
                      disabled={deletingFeedbackId === feedback.id}
                    >
                      {deletingFeedbackId === feedback.id ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Text style={styles.deleteFeedbackButtonText}>🗑️</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.feedbackDetails}>
                    <Text style={styles.feedbackStars}>{renderStars(feedback.starRating)}</Text>
                    {feedback.suggestedGrade && (
                      <View style={styles.suggestedGradeBadge}>
                        <Text style={styles.suggestedGradeText}>{feedback.suggestedGrade}</Text>
                      </View>
                    )}
                    {feedback.isCompleted && (
                      <Text style={styles.completedBadge}>✓ {t.routes?.completed || 'הושלם'}</Text>
                    )}
                  </View>
                  
                  {feedback.comment && (
                    <Text style={styles.feedbackComment}>{feedback.comment}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 50,
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
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  disabledButton: {
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoSection: {
    backgroundColor: theme.inputBackground,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  infoPreview: {
    fontSize: 15,
    color: theme.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
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
    backgroundColor: theme.inputBackground,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  selectedGradeChip: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  gradeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  selectedGradeChipText: {
    color: '#fff',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    borderColor: theme.text,
  },
  colorChipContainer: {
    alignItems: 'center' as const,
    width: 56,
  },
  colorLabel: {
    fontSize: 9,
    color: theme.textSecondary,
    textAlign: 'center' as const,
    marginTop: 3,
  },
  colorCheckmark: {
    fontSize: 20,
    fontWeight: '600',
  },
  moveButton: {
    backgroundColor: theme.primary,
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
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: theme.error,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tapeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tapeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
    gap: 4,
  },
  tapeChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  tapeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  tapeChipTextSelected: {
    color: '#fff',
  },
  tapeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  feedbacksSection: {
    marginTop: 32,
    marginBottom: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  noFeedbacksText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginVertical: 20,
  },
  feedbackCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feedbackUserInfo: {
    flex: 1,
  },
  feedbackUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  feedbackDate: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  deleteFeedbackButton: {
    padding: 8,
    marginStart: 8,
  },
  deleteFeedbackButtonText: {
    fontSize: 18,
  },
  feedbackDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  feedbackStars: {
    fontSize: 14,
  },
  suggestedGradeBadge: {
    backgroundColor: theme.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  suggestedGradeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  completedBadge: {
    fontSize: 12,
    color: theme.success,
    fontWeight: '500',
  },
  feedbackComment: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});
