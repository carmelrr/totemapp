import React, { useState, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  ViewStyle,
  Pressable,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapViewport from '../components/MapViewport';

import { GRADES } from '../utils/grades';
import { ROUTE_COLORS, getRandomRouteColor, getColorTranslationKey, isValidHexColor, getContrastTextColor } from '../utils/colors';
import { RoutesService } from '../services/RoutesService';
import { 
  initializeColorSettings, 
  getColorSettingSync, 
  saveColorSetting,
  CustomColorSetting 
} from '../services/ColorSettingsService';
import { MapTransforms, RouteDoc } from '../types/route';
import { useLanguage } from '@/features/language';
import { useTheme, lightTheme } from '@/features/theme/ThemeContext';
import { useResponsiveLayout, ResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useActiveRoutes } from '../hooks/useFirebaseRoutes';
import { usePublishedRooms } from '@/features/wall-editor';
import ZoomSlider from '@/components/WallMap/ZoomSlider';
import { snapToNearestWall } from '@/utils/snapToWall';

type Theme = typeof lightTheme;

type RootStackParamList = {
  RoutesMap: undefined;
  AddRoute: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddRoute'>;

interface PreviewRoute {
  xImg: number;
  yImg: number;
  xNorm: number;
  yNorm: number;
}

// SVG wall dimensions for coordinate calculations
const WALL_WIDTH = 2560;
const WALL_HEIGHT = 1600;

export default function AddRouteMapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, language, isLoading: languageLoading } = useLanguage();
  const { theme } = useTheme();
  
  // Responsive layout - automatically updates on rotation
  const layout = useResponsiveLayout();
  const { width: screenWidth, height: screenHeight, isLandscape, mapLayoutMode } = layout;
  
  // Safe area insets for handling Android navigation bar
  const insets = useSafeAreaInsets();
  
  // Load existing routes to show on map (only active routes, not archived)
  const { routes: existingRoutes } = useActiveRoutes();
  
  // Published rooms (dynamic wall maps)
  const { rooms: publishedRooms } = usePublishedRooms();
  
  // Get first published room or create a default
  const selectedRoom = useMemo(() => {
    if (publishedRooms.length > 0) {
      return publishedRooms[0];
    }
    return null;
  }, [publishedRooms]);
  
  // Wall dimensions from selected room
  const wallWidth = selectedRoom?.width || 2560;
  const wallHeight = selectedRoom?.height || 1600;
  
  // Store scale shared value for marker size compensation
  const [scaleSharedValue, setScaleSharedValue] = useState<SharedValue<number> | null>(null);
  
  // Zoom control state
  const [currentZoom, setCurrentZoom] = useState(1);
  const mapTransformsRef = React.useRef<any>(null);

  // Form state
  const [grade, setGrade] = useState('V0');
  const [color, setColor] = useState<string>(getRandomRouteColor());
  const [status, setStatus] = useState<'active' | 'archived' | 'draft'>('active');
  const [setter, setSetter] = useState('');
  const [tags, setTags] = useState('');
  
  // Custom color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#');
  const [customColorNameHe, setCustomColorNameHe] = useState('');
  const [customColorNameEn, setCustomColorNameEn] = useState('');

  // Edit color modal state
  const [showEditColorModal, setShowEditColorModal] = useState(false);
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [editColorHex, setEditColorHex] = useState('');
  const [editColorNameHe, setEditColorNameHe] = useState('');
  const [editColorNameEn, setEditColorNameEn] = useState('');
  const [isSavingColor, setIsSavingColor] = useState(false);
  const [colorSettingsVersion, setColorSettingsVersion] = useState(0);
  
  // RGB slider state
  const [editColorR, setEditColorR] = useState(128);
  const [editColorG, setEditColorG] = useState(128);
  const [editColorB, setEditColorB] = useState(128);

  // Helper: Convert hex to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 128, g: 128, b: 128 };
  };

  // Helper: Convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  };

  // Update hex when RGB changes
  const updateHexFromRgb = (r: number, g: number, b: number) => {
    setEditColorHex(rgbToHex(r, g, b));
  };

  // Initialize color settings on mount
  useEffect(() => {
    initializeColorSettings().then(() => {
      setColorSettingsVersion(v => v + 1);
    });
  }, []);

  // Check if color is a predefined color
  const isPredefinedColor = ROUTE_COLORS.includes(color as any);

  // Map state
  const [imageDimensions, setImageDimensions] = useState({
    imgW: 0,
    imgH: 0,
  });
  const [currentTransforms, setCurrentTransforms] = useState<MapTransforms>({
    translateX: 0,
    translateY: 0,
    scale: 1,
  });
  const [preview, setPreview] = useState<PreviewRoute | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create styles based on layout and theme
  const styles = useMemo(() => createStyles(layout, insets, theme), [layout, insets, theme]);

  const handleMapMeasured = useCallback((dimensions: { imgW: number; imgH: number }) => {
    setImageDimensions(dimensions);
  }, []);
  
  // Handle transforms ready from MapViewport - store scale for marker compensation
  const handleTransformsReady = useCallback((transforms: any) => {
    if (transforms?.scale) {
      setScaleSharedValue(transforms.scale);
    }
    // Store transforms ref for zoom control
    mapTransformsRef.current = transforms;
  }, []);
  
  // Handle transform changes to update zoom level display
  const handleTransformChange = useCallback((transforms: MapTransforms) => {
    setCurrentTransforms(transforms);
    setCurrentZoom(transforms.scale);
  }, []);
  
  // Handle zoom slider change
  const handleZoomSliderChange = useCallback((newScale: number) => {
    if (mapTransformsRef.current?.setZoomToCenter) {
      mapTransformsRef.current.setZoomToCenter(newScale);
    }
  }, []);

  // Handle tap on map to place marker - receives IMAGE coordinates directly from MapViewport
  const handleMapTap = useCallback((coordinates: { xImg: number; yImg: number }) => {
    if (imageDimensions.imgW === 0 || imageDimensions.imgH === 0) {
      console.log('Image dimensions not ready, skipping');
      return;
    }

    let { xImg, yImg } = coordinates;

    // Clamp to image bounds
    xImg = Math.max(0, Math.min(imageDimensions.imgW, xImg));
    yImg = Math.max(0, Math.min(imageDimensions.imgH, yImg));

    // Snap to nearest wall point so routes align on wall edges
    if (selectedRoom) {
      const snapped = snapToNearestWall(
        xImg, yImg,
        imageDimensions.imgW, imageDimensions.imgH,
        selectedRoom,
      );
      if (snapped.snapped) {
        xImg = snapped.xImg;
        yImg = snapped.yImg;
      }
    }

    // Convert to normalized coordinates (0-1 range)
    const xNorm = xImg / imageDimensions.imgW;
    const yNorm = yImg / imageDimensions.imgH;

    setPreview({
      xImg,
      yImg,
      xNorm,
      yNorm,
    });

    // Clear position error if it exists
    if (errors.position) {
      setErrors(prev => ({ ...prev, position: '' }));
    }
  }, [imageDimensions, errors.position, selectedRoom]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!grade) {
      newErrors.grade = t.routes.selectGradeError;
    }

    if (!color) {
      newErrors.color = t.routes.selectColorError;
    }

    if (!preview) {
      newErrors.position = t.routes.selectPositionError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Generate automatic name from grade and color - returns both languages
  const getRouteNames = useCallback((): { nameHe: string; nameEn: string } => {
    const colorKey = getColorTranslationKey(color);
    let colorNameHe: string;
    let colorNameEn: string;
    
    // First check if there's a custom color setting saved
    const customSetting = getColorSettingSync(color);
    if (customSetting) {
      colorNameHe = customSetting.nameHe;
      colorNameEn = customSetting.nameEn;
    }
    // If it's a custom color (not predefined), use the custom name inputs
    else if (colorKey === 'custom' && (customColorNameHe || customColorNameEn)) {
      colorNameHe = customColorNameHe || customColorNameEn;
      colorNameEn = customColorNameEn || customColorNameHe;
    } else {
      // Get from translations (named exports, not default)
      const { he: heTranslations } = require('@/features/language/translations/he');
      const { en: enTranslations } = require('@/features/language/translations/en');
      colorNameHe = heTranslations?.colors?.[colorKey] || colorKey;
      colorNameEn = enTranslations?.colors?.[colorKey] || colorKey;
    }
    
    return {
      nameHe: `${colorNameHe} ${grade}`,
      nameEn: `${colorNameEn} ${grade}`,
    };
  }, [color, grade, customColorNameHe, customColorNameEn, colorSettingsVersion]);

  // For display, get name in current language
  const getRouteName = useCallback((): string => {
    const names = getRouteNames();
    return language === 'he' ? names.nameHe : names.nameEn;
  }, [getRouteNames, language]);

  const handleSave = useCallback(async () => {
    console.log('🔥 SAVE_PRESS - כפתור Save נלחץ!');

    if (!validateForm() || !preview) return;

    setIsSubmitting(true);

    try {
      const names = getRouteNames();
      const routeData: any = {
        name: names.nameHe, // Default name (Hebrew)
        nameHe: names.nameHe,
        nameEn: names.nameEn,
        grade,
        color,
        xNorm: preview.xNorm,
        yNorm: preview.yNorm,
        status,
      };

      // Add custom color names if it's a custom color
      const colorKey = getColorTranslationKey(color);
      if (colorKey === 'custom' && (customColorNameHe || customColorNameEn)) {
        routeData.colorNameHe = customColorNameHe.trim();
        routeData.colorNameEn = customColorNameEn.trim();
      }

      // הוסף setter רק אם יש ערך
      if (setter.trim()) {
        routeData.setter = setter.trim();
      }

      // הוסף tags רק אם יש ערכים
      if (tags.trim()) {
        routeData.tags = tags.split(',').map(tg => tg.trim()).filter(Boolean);
      }

      await RoutesService.addRoute(routeData);

      Alert.alert(
        t.common.success,
        t.routes.routeAddedSuccess,
        [
          {
            text: t.common.ok,
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error adding route:', error);
      Alert.alert(t.common.error, t.common.errorGeneric);
    } finally {
      setIsSubmitting(false);
    }
  }, [preview, getRouteName, grade, color, status, setter, tags, navigation, t]);

  // Handle long press on color to edit it
  const handleColorLongPress = useCallback((colorHex: string) => {
    const colorKey = getColorTranslationKey(colorHex);
    const existingSetting = getColorSettingSync(colorHex);
    
    setEditingColor(colorHex);
    const hexToUse = existingSetting?.hex || colorHex;
    setEditColorHex(hexToUse);
    
    // Set RGB values from hex
    const rgb = hexToRgb(hexToUse);
    setEditColorR(rgb.r);
    setEditColorG(rgb.g);
    setEditColorB(rgb.b);
    
    // Get current names - from custom settings or from translations
    if (existingSetting) {
      setEditColorNameHe(existingSetting.nameHe);
      setEditColorNameEn(existingSetting.nameEn);
    } else {
      // Use translation keys as default
      const translatedName = t.colors?.[colorKey as keyof typeof t.colors] || colorKey;
      setEditColorNameHe(translatedName);
      setEditColorNameEn(translatedName);
    }
    
    setShowEditColorModal(true);
  }, [t.colors]);

  // Save edited color settings
  const handleSaveEditColor = useCallback(async () => {
    if (!editingColor) return;
    
    if (!editColorNameHe.trim() || !editColorNameEn.trim()) {
      Alert.alert(t.common?.error || 'Error', t.colors?.colorNameRequired || 'Color name required');
      return;
    }
    
    if (!isValidHexColor(editColorHex)) {
      Alert.alert(t.common?.error || 'Error', t.colors?.invalidColorCode || 'Invalid color code');
      return;
    }
    
    setIsSavingColor(true);
    
    try {
      await saveColorSetting(editingColor, {
        hex: editColorHex.toUpperCase(),
        nameHe: editColorNameHe.trim(),
        nameEn: editColorNameEn.trim(),
        originalHex: editingColor,
      });
      
      // Update version to trigger re-render
      setColorSettingsVersion(v => v + 1);
      
      Alert.alert(t.common?.success || 'Success', t.colors?.colorSaved || 'Color saved');
      setShowEditColorModal(false);
    } catch (error) {
      console.error('Error saving color setting:', error);
      Alert.alert(t.common?.error || 'Error', t.colors?.colorSaveError || 'Error saving color');
    } finally {
      setIsSavingColor(false);
    }
  }, [editingColor, editColorHex, editColorNameHe, editColorNameEn, t]);

  // Get display color (might be customized)
  const getDisplayColor = useCallback((originalHex: string): string => {
    const setting = getColorSettingSync(originalHex);
    return setting?.hex || originalHex;
  }, [colorSettingsVersion]);

  // Configure header with save button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={isSubmitting}
          style={{ paddingHorizontal: 16 }}
        >
          <Text style={{ 
            color: isSubmitting ? '#9ca3af' : '#ffffff', 
            fontSize: 16, 
            fontWeight: '600' 
          }}>
            {isSubmitting ? 'שומר...' : 'שמור'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isSubmitting, handleSave]);

  // Animated style for existing route markers - compensate for zoom
  const ExistingRouteMarker = useMemo(() => {
    return React.memo(({ route }: { route: RouteDoc }) => {
      // Calculate position in image coordinates
      const xImg = route.xNorm * imageDimensions.imgW;
      const yImg = route.yNorm * imageDimensions.imgH;
      
      // Base size for markers
      const baseSize = 28;
      
      // Compensated size style - markers stay same size on screen regardless of zoom
      const markerStyle = useAnimatedStyle(() => {
        const currentScale = scaleSharedValue?.value ?? 1;
        const safeScale = Number.isFinite(currentScale) && currentScale > 0 
          ? Math.min(Math.max(currentScale, 0.1), 10) 
          : 1;
        
        const compensatedSize = baseSize / safeScale;
        const offset = compensatedSize / 2;
        
        return {
          position: 'absolute',
          left: xImg - offset,
          top: yImg - offset,
          width: compensatedSize,
          height: compensatedSize,
          borderRadius: compensatedSize / 2,
          backgroundColor: route.color || '#888888',
          opacity: 0.4, // Semi-transparent for existing routes
          borderWidth: 1 / safeScale,
          borderColor: 'rgba(255,255,255,0.5)',
        };
      });
      
      return <Animated.View style={markerStyle} />;
    });
  }, [imageDimensions, scaleSharedValue]);
  
  // Animated style for preview marker - compensate for zoom
  const PreviewMarkerWithCompensation = useMemo(() => {
    if (!preview || imageDimensions.imgW === 0) return null;
    
    const baseSize = 36; // Slightly larger for new route
    // Compute contrast color outside worklet
    const textColor = getContrastTextColor(color);
    
    const PreviewMarker = () => {
      const markerStyle = useAnimatedStyle(() => {
        const currentScale = scaleSharedValue?.value ?? 1;
        const safeScale = Number.isFinite(currentScale) && currentScale > 0 
          ? Math.min(Math.max(currentScale, 0.1), 10) 
          : 1;
        
        const compensatedSize = baseSize / safeScale;
        const offset = compensatedSize / 2;
        
        return {
          position: 'absolute',
          left: preview.xImg - offset,
          top: preview.yImg - offset,
          width: compensatedSize,
          height: compensatedSize,
          borderRadius: compensatedSize / 2,
          backgroundColor: color,
          borderWidth: 3 / safeScale,
          borderColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
          justifyContent: 'center',
          alignItems: 'center',
        };
      });
      
      const textStyleAnimated = useAnimatedStyle(() => {
        const currentScale = scaleSharedValue?.value ?? 1;
        const safeScale = Number.isFinite(currentScale) && currentScale > 0 
          ? Math.min(Math.max(currentScale, 0.1), 10) 
          : 1;
        
        return {
          fontSize: 10 / safeScale,
        };
      });
      
      return (
        <Animated.View style={markerStyle}>
          <Animated.Text style={[textStyleAnimated, { fontWeight: 'bold', color: textColor }]}>{grade}</Animated.Text>
        </Animated.View>
      );
    };
    
    return <PreviewMarker />;
  }, [preview, imageDimensions, color, grade, scaleSharedValue]);

  // Main layout - responsive to orientation
  const isHorizontalLayout = mapLayoutMode === 'horizontal' || mapLayoutMode === 'phone-landscape';

  // Show nothing while language is loading or no room available
  if (languageLoading || !selectedRoom) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.text }}>טוען מפה...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main Content - Horizontal in landscape, Vertical in portrait */}
      <View style={[styles.mainContent, isHorizontalLayout && styles.mainContentHorizontal]}>
        {/* Map Section */}
        <View style={[styles.mapSection, isHorizontalLayout && styles.mapSectionHorizontal]}>
          <MapViewport
            room={selectedRoom}
            onMeasured={handleMapMeasured}
            onTransformChange={handleTransformChange}
            onTransformsReady={handleTransformsReady}
            onTap={handleMapTap}
          >
            {/* Existing routes - shown semi-transparent */}
            {imageDimensions.imgW > 0 && existingRoutes.map((route) => (
              <ExistingRouteMarker key={route.id} route={route} />
            ))}
            
            {/* Preview marker for new route */}
            {PreviewMarkerWithCompensation}
          </MapViewport>

          {errors.position && (
            <Text style={styles.errorText}>{errors.position}</Text>
          )}
        </View>
        
        {/* Zoom Slider - outside mapSection so it doesn't get cut off by fixed height */}
        {!isHorizontalLayout && (
          <View style={styles.zoomSliderContainer}>
            <ZoomSlider
              currentScale={currentZoom}
              minScale={mapTransformsRef.current?.minScale ?? 1}
              maxScale={mapTransformsRef.current?.maxScale ?? 8}
              onZoomChange={handleZoomSliderChange}
              forceShow={true}
            />
          </View>
        )}

        {/* Form Section */}
        <ScrollView style={[styles.formSection, isHorizontalLayout && styles.formSectionHorizontal]}>
          {/* Auto-generated Route Name Preview */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t.routes.routeNameAuto}</Text>
            <View style={styles.namePreview}>
              <View style={[styles.nameColorDot, { backgroundColor: color }]} />
              <Text style={styles.namePreviewText}>{getRouteName()}</Text>
            </View>
          </View>

          {/* Grade Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t.routes.grade} *</Text>
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
          {errors.grade && <Text style={styles.errorText}>{errors.grade}</Text>}
        </View>

        {/* Color Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t.routes.colorRequired} *</Text>
          <View style={styles.colorGrid}>
            {ROUTE_COLORS.map((colorOption) => {
              const displayColor = getDisplayColor(colorOption);
              return (
                <TouchableOpacity
                  key={colorOption}
                  style={[
                    styles.colorChip,
                    { backgroundColor: displayColor },
                    color === colorOption && styles.selectedColorChip,
                  ]}
                  onPress={() => setColor(colorOption)}
                  onLongPress={() => handleColorLongPress(colorOption)}
                  delayLongPress={500}
                >
                  {color === colorOption && (
                    <Text style={[styles.colorCheckmark, { color: getContrastTextColor(displayColor) }]}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {/* Custom Color Button */}
            <TouchableOpacity
              style={[
                styles.colorChip,
                styles.customColorChip,
                !isPredefinedColor && styles.selectedColorChip,
              ]}
              onPress={() => setShowColorPicker(true)}
            >
              {!isPredefinedColor ? (
                <View style={[styles.customColorPreview, { backgroundColor: color }]} />
              ) : (
                <Text style={styles.customColorPlus}>+</Text>
              )}
            </TouchableOpacity>
          </View>
          {errors.color && <Text style={styles.errorText}>{errors.color}</Text>}
        </View>

        {/* Optional Fields */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t.routes.setterOptional}</Text>
          <TextInput
            style={styles.textInput}
            value={setter}
            onChangeText={setSetter}
            placeholder={t.routes.setterPlaceholder}
            maxLength={30}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t.routes.tagsOptional}</Text>
          <TextInput
            style={styles.textInput}
            value={tags}
            onChangeText={setTags}
            placeholder={t.routes.tagsPlaceholder}
            maxLength={100}
          />
          <Text style={styles.helpText}>
            {t.routes.tagsExample}
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
      </View>

      {/* Custom Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.colorPickerModal}>
          <View style={styles.colorPickerHeader}>
            <TouchableOpacity onPress={() => setShowColorPicker(false)}>
              <Text style={styles.colorPickerCancel}>{t.common?.cancel || 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={styles.colorPickerTitle}>{t.colors?.customColorTitle || 'Custom Color'}</Text>
            <TouchableOpacity 
              onPress={() => {
                if (!isValidHexColor(customColor)) {
                  Alert.alert(t.common?.error || 'Error', t.colors?.invalidColorCode || 'Invalid color code');
                  return;
                }
                if (!customColorNameHe.trim() || !customColorNameEn.trim()) {
                  Alert.alert(t.common?.error || 'Error', t.colors?.colorNameRequired || 'Color name required');
                  return;
                }
                setColor(customColor);
                setShowColorPicker(false);
              }}
            >
              <Text style={styles.colorPickerSave}>{t.common?.save || 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.colorPickerContent}>
            {/* Color Preview */}
            <View style={styles.colorPreviewSection}>
              <View 
                style={[
                  styles.colorPreviewBox, 
                  { backgroundColor: isValidHexColor(customColor) ? customColor : '#cccccc' }
                ]} 
              />
              <Text style={styles.colorPreviewLabel}>{t.colors?.preview || 'Preview'}</Text>
            </View>

            {/* Color Name in Hebrew */}
            <View style={styles.hexInputSection}>
              <Text style={styles.hexInputLabel}>{t.colors?.colorNameHe || 'Color Name (Hebrew)'}</Text>
              <TextInput
                style={styles.hexInput}
                value={customColorNameHe}
                onChangeText={setCustomColorNameHe}
                placeholder={t.colors?.colorNamePlaceholderHe || ''}
                maxLength={30}
              />
            </View>

            {/* Color Name in English */}
            <View style={styles.hexInputSection}>
              <Text style={styles.hexInputLabel}>{t.colors?.colorNameEn || 'Color Name (English)'}</Text>
              <TextInput
                style={styles.hexInput}
                value={customColorNameEn}
                onChangeText={setCustomColorNameEn}
                placeholder={t.colors?.colorNamePlaceholderEn || ''}
                maxLength={30}
              />
            </View>

            {/* Hex Input */}
            <View style={styles.hexInputSection}>
              <Text style={styles.hexInputLabel}>{t.colors?.colorCode || 'Color Code (HEX)'}</Text>
              <TextInput
                style={styles.hexInput}
                value={customColor}
                onChangeText={(text) => {
                  // Ensure it starts with #
                  if (!text.startsWith('#')) {
                    text = '#' + text;
                  }
                  // Limit to 7 characters (#RRGGBB)
                  setCustomColor(text.slice(0, 7).toUpperCase());
                }}
                placeholder={t.colors?.colorCodePlaceholder || '#FF5500'}
                maxLength={7}
                autoCapitalize="characters"
              />
              <Text style={styles.hexInputHint}>{t.colors?.colorCodeHint || 'Example: #FF0000 = Red'}</Text>
            </View>

            {/* Quick Color Grid */}
            <View style={styles.quickColorsSection}>
              <Text style={styles.quickColorsLabel}>{t.colors?.moreColors || 'More Colors'}</Text>
              <View style={styles.quickColorsGrid}>
                {[
                  '#FF5733', '#C70039', '#900C3F', '#581845',
                  '#1ABC9C', '#16A085', '#2ECC71', '#27AE60',
                  '#3498DB', '#2980B9', '#9B59B6', '#8E44AD',
                  '#34495E', '#2C3E50', '#F39C12', '#D35400',
                ].map((quickColor) => (
                  <TouchableOpacity
                    key={quickColor}
                    style={[styles.quickColorChip, { backgroundColor: quickColor }]}
                    onPress={() => setCustomColor(quickColor)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Color Modal */}
      <Modal
        visible={showEditColorModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditColorModal(false)}
      >
        <View style={styles.colorPickerModal}>
          <View style={styles.colorPickerHeader}>
            <TouchableOpacity onPress={() => setShowEditColorModal(false)}>
              <Text style={styles.colorPickerCancel}>{t.common?.cancel || 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={styles.colorPickerTitle}>{t.colors?.editColorTitle || 'Edit Color'}</Text>
            <TouchableOpacity 
              onPress={handleSaveEditColor}
              disabled={isSavingColor}
            >
              <Text style={[styles.colorPickerSave, isSavingColor && { opacity: 0.5 }]}>
                {t.common?.save || 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.colorPickerContent}>
            {/* Description */}
            <Text style={styles.editColorDescription}>{t.colors?.editColorDescription || 'Change the name and shade of this color.'}</Text>

            {/* Color Preview */}
            <View style={styles.colorPreviewSection}>
              <View 
                style={[
                  styles.colorPreviewBox, 
                  { backgroundColor: isValidHexColor(editColorHex) ? editColorHex : '#cccccc' }
                ]} 
              />
              <Text style={styles.colorPreviewLabel}>{t.colors?.preview || 'Preview'}</Text>
            </View>

            {/* Color Name in Hebrew */}
            <View style={styles.hexInputSection}>
              <Text style={styles.hexInputLabel}>{t.colors?.colorNameHe || 'Color Name (Hebrew)'}</Text>
              <TextInput
                style={styles.hexInput}
                value={editColorNameHe}
                onChangeText={setEditColorNameHe}
                placeholder={t.colors?.colorNamePlaceholderHe || ''}
                maxLength={30}
              />
            </View>

            {/* Color Name in English */}
            <View style={styles.hexInputSection}>
              <Text style={styles.hexInputLabel}>{t.colors?.colorNameEn || 'Color Name (English)'}</Text>
              <TextInput
                style={styles.hexInput}
                value={editColorNameEn}
                onChangeText={setEditColorNameEn}
                placeholder={t.colors?.colorNamePlaceholderEn || ''}
                maxLength={30}
              />
            </View>

            {/* RGB Sliders */}
            <View style={styles.rgbSlidersSection}>
              <Text style={styles.hexInputLabel}>{t.colors?.adjustColor || 'Adjust Color'}</Text>
              
              {/* Red Slider */}
              <View style={styles.sliderRow}>
                <Text style={[styles.sliderLabel, { color: '#FF0000' }]}>R</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={255}
                  step={1}
                  value={editColorR}
                  onValueChange={(value) => {
                    setEditColorR(value);
                    updateHexFromRgb(value, editColorG, editColorB);
                  }}
                  minimumTrackTintColor="#FF0000"
                  maximumTrackTintColor="#FFcccc"
                  thumbTintColor="#FF0000"
                />
                <Text style={styles.sliderValue}>{Math.round(editColorR)}</Text>
              </View>
              
              {/* Green Slider */}
              <View style={styles.sliderRow}>
                <Text style={[styles.sliderLabel, { color: '#00AA00' }]}>G</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={255}
                  step={1}
                  value={editColorG}
                  onValueChange={(value) => {
                    setEditColorG(value);
                    updateHexFromRgb(editColorR, value, editColorB);
                  }}
                  minimumTrackTintColor="#00AA00"
                  maximumTrackTintColor="#ccffcc"
                  thumbTintColor="#00AA00"
                />
                <Text style={styles.sliderValue}>{Math.round(editColorG)}</Text>
              </View>
              
              {/* Blue Slider */}
              <View style={styles.sliderRow}>
                <Text style={[styles.sliderLabel, { color: '#0000FF' }]}>B</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={255}
                  step={1}
                  value={editColorB}
                  onValueChange={(value) => {
                    setEditColorB(value);
                    updateHexFromRgb(editColorR, editColorG, value);
                  }}
                  minimumTrackTintColor="#0000FF"
                  maximumTrackTintColor="#ccccFF"
                  thumbTintColor="#0000FF"
                />
                <Text style={styles.sliderValue}>{Math.round(editColorB)}</Text>
              </View>
              
              <Text style={styles.hexCodeDisplay}>{editColorHex}</Text>
            </View>

            {/* Quick Color Grid */}
            <View style={styles.quickColorsSection}>
              <Text style={styles.quickColorsLabel}>{t.colors?.moreColors || 'More Colors'}</Text>
              <View style={styles.quickColorsGrid}>
                {[
                  '#FF5733', '#C70039', '#900C3F', '#581845',
                  '#1ABC9C', '#16A085', '#2ECC71', '#27AE60',
                  '#3498DB', '#2980B9', '#9B59B6', '#8E44AD',
                  '#34495E', '#2C3E50', '#F39C12', '#D35400',
                ].map((quickColor) => (
                  <TouchableOpacity
                    key={quickColor}
                    style={[styles.quickColorChip, { backgroundColor: quickColor }]}
                    onPress={() => {
                      setEditColorHex(quickColor);
                      const rgb = hexToRgb(quickColor);
                      setEditColorR(rgb.r);
                      setEditColorG(rgb.g);
                      setEditColorB(rgb.b);
                    }}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Dynamic styles based on layout, safe area insets, and theme
const createStyles = (layout: ResponsiveLayout, insets: { top: number; bottom: number; left: number; right: number }, theme: Theme) => {
  const { isLandscape, mapLayoutMode, height, width } = layout;
  const isHorizontalLayout = mapLayoutMode === 'horizontal' || mapLayoutMode === 'phone-landscape';
  
  // Calculate map height based on orientation
  const mapHeight = isHorizontalLayout 
    ? height - insets.top - insets.bottom // Full height in landscape
    : Math.min(height * 0.45, 350); // Portrait: 45% of screen or max 350
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    // Main content container - horizontal in landscape, vertical in portrait
    mainContent: {
      flex: 1,
      flexDirection: 'column',
    },
    mainContentHorizontal: {
      flexDirection: 'row',
      paddingLeft: insets.left, // Safe area for landscape camera/notch
      paddingRight: insets.right, // Safe area for landscape buttons
    },
    // Map section
    mapSection: {
      height: mapHeight,
      position: 'relative',
    },
    mapSectionHorizontal: {
      height: '100%' as any,
      width: isLandscape ? '55%' : undefined,
      flex: isLandscape ? undefined : 1,
    },
    zoomSliderContainer: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: theme.isDark ? 'rgba(45, 45, 45, 0.9)' : 'rgba(245, 245, 245, 0.9)',
    },
    formSection: {
      flex: 1,
      paddingHorizontal: 16,
    },
    formSectionHorizontal: {
      width: isLandscape ? '45%' : undefined,
      flex: isLandscape ? undefined : 1,
      paddingBottom: insets.bottom,
      paddingRight: insets.right, // Extra padding for landscape safe area
    },
    fieldGroup: {
      marginVertical: 12,
    },
    fieldLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    errorInput: {
      borderColor: theme.error,
    },
    errorText: {
      fontSize: 12,
      color: theme.error,
      marginTop: 4,
    },
    gradeContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 4,
    },
    gradeChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedGradeChip: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    gradeChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
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
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    selectedColorChip: {
      borderColor: theme.text,
    },
    colorCheckmark: {
      fontSize: 18,
      fontWeight: '600',
    },
    customColorChip: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderStyle: 'dashed',
    } as ViewStyle,
    customColorPreview: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    customColorPlus: {
      fontSize: 24,
      color: theme.textSecondary,
      fontWeight: '300',
    },
    helpText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    bottomPadding: {
      height: 40 + insets.bottom,
    },
    // Name preview styles
    namePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    nameColorDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginRight: 10,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
    },
    namePreviewText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    // Color Picker Modal styles
    colorPickerModal: {
      flex: 1,
      backgroundColor: theme.modalBackground,
    },
    colorPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      paddingTop: insets.top + 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    colorPickerCancel: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    colorPickerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    colorPickerSave: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primary,
    },
    colorPickerContent: {
      flex: 1,
      padding: 20,
    },
    editColorDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 10,
    },
    colorPreviewSection: {
      alignItems: 'center',
      marginBottom: 30,
    },
    colorPreviewBox: {
      width: 100,
      height: 100,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.border,
    },
    colorPreviewLabel: {
      marginTop: 8,
      fontSize: 14,
      color: theme.textSecondary,
    },
    hexInputSection: {
      marginBottom: 30,
    },
    hexInputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    hexInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      backgroundColor: theme.inputBackground,
    },
    hexInputHint: {
      marginTop: 8,
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    quickColorsSection: {
      marginBottom: 20,
    },
    quickColorsLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    quickColorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickColorChip: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: 'rgba(0,0,0,0.1)',
    },
    // RGB Slider styles
    rgbSlidersSection: {
      marginBottom: 20,
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sliderLabel: {
      fontSize: 18,
      fontWeight: 'bold',
      width: 30,
      textAlign: 'center',
    },
    slider: {
      flex: 1,
      height: 40,
      marginHorizontal: 8,
    },
    sliderValue: {
      fontSize: 14,
      color: theme.textSecondary,
      width: 40,
      textAlign: 'right',
    },
    hexCodeDisplay: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginTop: 8,
      fontFamily: 'monospace',
    },
  });
};
