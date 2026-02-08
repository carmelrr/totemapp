/**
 * InlineAddRoutePanel - A panel shown at the bottom of the RoutesMapScreen
 * when the user is adding a new route inline (tap on map, then pick color & grade).
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { GRADES } from '../utils/grades';
import { ROUTE_COLORS, getRandomRouteColor, getColorTranslationKey, getContrastTextColor } from '../utils/colors';
import { RoutesService } from '../services/RoutesService';
import { getColorSettingSync } from '../services/ColorSettingsService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type AddingPhase = 'placing' | 'details';

interface InlineAddRoutePanelProps {
  /** Current phase of adding */
  phase: AddingPhase;
  /** Coordinates chosen by user, null until tapped */
  coordinates: { xNorm: number; yNorm: number } | null;
  /** Called when route is saved successfully */
  onSave: () => void;
  /** Called when user cancels adding */
  onCancel: () => void;
}

export default function InlineAddRoutePanel({
  phase,
  coordinates,
  onSave,
  onCancel,
}: InlineAddRoutePanelProps) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Form state
  const [grade, setGrade] = useState('V0');
  const [color, setColor] = useState<string>(getRandomRouteColor());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colorSettingsVersion, setColorSettingsVersion] = useState(0);

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // Auto-generate route name
  const getRouteNames = useCallback((): { nameHe: string; nameEn: string } => {
    const colorKey = getColorTranslationKey(color);
    let colorNameHe: string;
    let colorNameEn: string;

    const customSetting = getColorSettingSync(color);
    if (customSetting) {
      colorNameHe = customSetting.nameHe;
      colorNameEn = customSetting.nameEn;
    } else {
      const { he: heTranslations } = require('@/features/language/translations/he');
      const { en: enTranslations } = require('@/features/language/translations/en');
      colorNameHe = heTranslations?.colors?.[colorKey] || colorKey;
      colorNameEn = enTranslations?.colors?.[colorKey] || colorKey;
    }

    return {
      nameHe: `${colorNameHe} ${grade}`,
      nameEn: `${colorNameEn} ${grade}`,
    };
  }, [color, grade]);

  const getDisplayColor = useCallback((originalHex: string): string => {
    void colorSettingsVersion; // force re-eval when settings change
    const setting = getColorSettingSync(originalHex);
    return setting?.hex || originalHex;
  }, [colorSettingsVersion]);

  const handleSave = useCallback(async () => {
    if (!coordinates) {
      Alert.alert(t.common?.error || 'Error', t.routes?.selectPositionError || 'Please tap the map to place the route');
      return;
    }

    setIsSubmitting(true);

    try {
      const names = getRouteNames();
      const routeData: any = {
        name: names.nameHe,
        nameHe: names.nameHe,
        nameEn: names.nameEn,
        grade,
        color,
        xNorm: coordinates.xNorm,
        yNorm: coordinates.yNorm,
        status: 'active',
      };

      await RoutesService.addRoute(routeData);

      Alert.alert(
        t.common?.success || 'Success',
        t.routes?.routeAddedSuccess || 'Route added successfully',
        [{ text: t.common?.ok || 'OK', onPress: onSave }]
      );
    } catch (error) {
      console.error('Error adding route:', error);
      Alert.alert(t.common?.error || 'Error', t.common?.errorGeneric || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }, [coordinates, grade, color, getRouteNames, onSave, t]);

  // Phase 1: Placing - show instruction banner
  if (phase === 'placing') {
    return (
      <View style={styles.placingContainer}>
        <View style={styles.placingBanner}>
          <Ionicons name="location-outline" size={20} color="#fff" />
          <Text style={styles.placingText}>
            {t.routes?.selectPositionError || 'לחץ על המפה למיקום המסלול'}
          </Text>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>{t.common?.cancel || 'ביטול'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Phase 2: Details - show color + grade selectors + save
  return (
    <View style={styles.detailsContainer}>
      {/* Handle bar */}
      <View style={styles.handleContainer}>
        <View style={styles.handleBar} />
      </View>

      {/* Route name preview */}
      <View style={styles.namePreviewRow}>
        <View style={[styles.nameColorDot, { backgroundColor: getDisplayColor(color) }]} />
        <Text style={styles.namePreviewText}>
          {language === 'he' ? getRouteNames().nameHe : getRouteNames().nameEn}
        </Text>
      </View>

      {/* Grade Selection */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionLabel}>{t.routes?.grade || 'Grade'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
          <View style={styles.gradeRow}>
            {GRADES.slice(0, 16).map((gradeOption) => (
              <TouchableOpacity
                key={gradeOption}
                style={[
                  styles.gradeChip,
                  grade === gradeOption && styles.gradeChipSelected,
                ]}
                onPress={() => setGrade(gradeOption)}
              >
                <Text style={[
                  styles.gradeChipText,
                  grade === gradeOption && styles.gradeChipTextSelected,
                ]}>
                  {gradeOption}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Color Selection */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionLabel}>{t.routes?.color || 'Color'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
          <View style={styles.colorRow}>
            {ROUTE_COLORS.map((colorOption) => {
              const displayColor = getDisplayColor(colorOption);
              return (
                <TouchableOpacity
                  key={colorOption}
                  style={[
                    styles.colorChip,
                    { backgroundColor: displayColor },
                    color === colorOption && styles.colorChipSelected,
                  ]}
                  onPress={() => setColor(colorOption)}
                >
                  {color === colorOption && (
                    <Ionicons name="checkmark" size={16} color={getContrastTextColor(displayColor)} />
                  )}
                </TouchableOpacity>
              );
            })}
            {/* "+" button to open color management page */}
            <TouchableOpacity
              style={styles.addColorChip}
              onPress={() => {
                navigation.navigate('ColorPickerScreen', {
                  selectedColor: color,
                  onColorSelect: (hex: string) => {
                    setColor(hex);
                    setColorSettingsVersion(v => v + 1);
                  },
                });
              }}
            >
              <Ionicons name="add" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelActionButton} onPress={onCancel}>
          <Text style={styles.cancelActionText}>{t.common?.cancel || 'ביטול'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>{t.common?.save || 'שמור'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any, insets: { bottom: number }) =>
  StyleSheet.create({
    // Phase 1: Placing
    placingContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: insets.bottom + 8,
    },
    placingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(33, 150, 243, 0.95)',
      marginHorizontal: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    placingText: {
      flex: 1,
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
    },
    cancelButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 8,
    },
    cancelButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },

    // Phase 2: Details panel
    detailsContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: insets.bottom + 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 20,
    },
    handleContainer: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handleBar: {
      width: 40,
      height: 4,
      backgroundColor: theme.textSecondary,
      borderRadius: 2,
    },
    namePreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
    },
    nameColorDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    namePreviewText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    sectionContainer: {
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
    },
    gradeScroll: {
      flexGrow: 0,
    },
    gradeRow: {
      flexDirection: 'row',
      gap: 6,
    },
    gradeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.border,
    },
    gradeChipSelected: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    gradeChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    gradeChipTextSelected: {
      color: theme.primary,
    },
    colorScroll: {
      flexGrow: 0,
    },
    colorRow: {
      flexDirection: 'row',
      gap: 8,
    },
    colorChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorChipSelected: {
      borderColor: theme.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    addColorChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
      backgroundColor: theme.surface,
    },
    actionsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 12,
    },
    cancelActionButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelActionText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    saveButton: {
      flex: 2,
      flexDirection: 'row',
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.success,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#ffffff',
    },
  });
