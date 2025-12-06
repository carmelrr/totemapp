import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

import MapViewport from '../components/MapViewport';
import RouteMarker from '../components/RouteMarker';

import { CoordinateUtils } from '@/utils/coordinateUtils';
import { GRADES } from '../utils/grades';
import { ROUTE_COLORS, getRandomRouteColor, getColorName, isValidHexColor, getContrastTextColor } from '../utils/colors';
import { RoutesService } from '../services/RoutesService';
import { MapTransforms, RouteDoc } from '../types/route';
import { useFirebaseRoutes } from '../hooks/useFirebaseRoutes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

export default function AddRouteMapScreen() {
  const navigation = useNavigation<NavigationProp>();

  // Load existing routes
  const { routes: existingRoutes } = useFirebaseRoutes();

  // Form state
  const [grade, setGrade] = useState('V0');
  const [color, setColor] = useState<string>(getRandomRouteColor());
  const [status, setStatus] = useState<'active' | 'archived' | 'draft'>('active');
  const [setter, setSetter] = useState('');
  const [tags, setTags] = useState('');
  
  // Custom color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#');

  // Check if color is a predefined color
  const isPredefinedColor = ROUTE_COLORS.includes(color as any);

  // Map state
  const [screenDimensions, setScreenDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
  });
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
  
  // Marker state - whether the marker is locked in place or can be moved
  const [isMarkerLocked, setIsMarkerLocked] = useState(false);
  
  // Store transforms ref for gesture callbacks
  const transformsRef = useRef<any>(null);

  // Draggable marker state
  const markerTranslateX = useSharedValue(0);
  const markerTranslateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMapMeasured = useCallback((dimensions: { imgW: number; imgH: number }) => {
    setImageDimensions(dimensions);
  }, []);

  // Handle transforms ready from MapViewport
  const handleTransformsReady = useCallback((transforms: any) => {
    transformsRef.current = transforms;
  }, []);

  // Update preview position (called from drag gesture)
  const updatePreviewPosition = useCallback((xImg: number, yImg: number) => {
    if (imageDimensions.imgW === 0 || imageDimensions.imgH === 0) return;
    
    // Clamp to image bounds
    const clampedXImg = Math.max(0, Math.min(imageDimensions.imgW, xImg));
    const clampedYImg = Math.max(0, Math.min(imageDimensions.imgH, yImg));

    // Convert to normalized coordinates
    const { xNorm, yNorm } = CoordinateUtils.toNorm(
      { xImg: clampedXImg, yImg: clampedYImg },
      imageDimensions
    );

    setPreview({
      xImg: clampedXImg,
      yImg: clampedYImg,
      xNorm,
      yNorm,
    });
  }, [imageDimensions]);

  // Handle tap on map to place marker
  const handleMapTap = useCallback((xS: number, yS: number) => {
    if (imageDimensions.imgW === 0 || imageDimensions.imgH === 0) return;

    // Get current transform values from shared values (most up-to-date)
    let transforms = currentTransforms;
    if (transformsRef.current) {
      transforms = {
        scale: transformsRef.current.scale.value,
        translateX: transformsRef.current.translateX.value,
        translateY: transformsRef.current.translateY.value,
      };
    }

    // Convert screen coordinates to image coordinates
    const { xImg, yImg } = CoordinateUtils.toImg(
      { xS, yS },
      transforms
    );

    // Clamp to image bounds
    const clampedXImg = Math.max(0, Math.min(imageDimensions.imgW, xImg));
    const clampedYImg = Math.max(0, Math.min(imageDimensions.imgH, yImg));

    // Convert to normalized coordinates
    const { xNorm, yNorm } = CoordinateUtils.toNorm(
      { xImg: clampedXImg, yImg: clampedYImg },
      imageDimensions
    );

    setPreview({
      xImg: clampedXImg,
      yImg: clampedYImg,
      xNorm,
      yNorm,
    });
    
    // New marker is not locked - can be dragged
    setIsMarkerLocked(false);
    
    // Reset marker drag offset
    markerTranslateX.value = 0;
    markerTranslateY.value = 0;

    // Clear position error if it exists
    if (errors.position) {
      setErrors(prev => ({ ...prev, position: '' }));
    }
  }, [imageDimensions, errors.position, markerTranslateX, markerTranslateY, currentTransforms]);

  // Confirm marker position (lock it)
  const handleConfirmMarker = useCallback(() => {
    setIsMarkerLocked(true);
  }, []);

  // Unlock marker to allow repositioning
  const handleUnlockMarker = useCallback(() => {
    setIsMarkerLocked(false);
  }, []);

  // Cancel/remove marker
  const handleCancelMarker = useCallback(() => {
    setPreview(null);
    setIsMarkerLocked(false);
    markerTranslateX.value = 0;
    markerTranslateY.value = 0;
  }, [markerTranslateX, markerTranslateY]);

  // Drag gesture for the preview marker - only enabled when not locked
  const markerDragGesture = useMemo(() => 
    Gesture.Pan()
      .enabled(!isMarkerLocked)
      .onStart(() => {
        isDragging.value = true;
      })
      .onUpdate((event) => {
        markerTranslateX.value = event.translationX;
        markerTranslateY.value = event.translationY;
      })
      .onEnd((event) => {
        isDragging.value = false;
        // Calculate new position based on current preview position + drag offset
        if (preview) {
          // Get current scale from shared values for accuracy
          const currentScale = transformsRef.current?.scale.value ?? currentTransforms.scale;
          const newXImg = preview.xImg + event.translationX / currentScale;
          const newYImg = preview.yImg + event.translationY / currentScale;
          runOnJS(updatePreviewPosition)(newXImg, newYImg);
        }
        // Reset translation
        markerTranslateX.value = 0;
        markerTranslateY.value = 0;
      }),
    [isMarkerLocked, preview, currentTransforms.scale, updatePreviewPosition, isDragging, markerTranslateX, markerTranslateY]
  );

  // Animated style for draggable marker
  const markerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: markerTranslateX.value },
      { translateY: markerTranslateY.value },
    ],
  }));

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!grade) {
      newErrors.grade = 'יש לבחור דרגת קושי';
    }

    if (!color) {
      newErrors.color = 'יש לבחור צבע';
    }

    if (!preview) {
      newErrors.position = 'יש ללחוץ על המפה כדי לבחור מיקום למסלול';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Generate automatic name from grade and color
  const getRouteName = (): string => {
    const colorName = getColorName(color);
    return `${grade} ${colorName}`;
  };

  const handleSave = async () => {
    console.log('🔥 SAVE_PRESS - כפתור Save נלחץ!');

    if (!validateForm() || !preview) return;

    setIsSubmitting(true);

    try {
      const routeData: any = {
        name: getRouteName(),
        grade,
        color,
        xNorm: preview.xNorm,
        yNorm: preview.yNorm,
        status,
      };

      // הוסף setter רק אם יש ערך
      if (setter.trim()) {
        routeData.setter = setter.trim();
      }

      // הוסף tags רק אם יש ערכים
      if (tags.trim()) {
        routeData.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
      }

      await RoutesService.addRoute(routeData);

      Alert.alert(
        'Success',
        'Route added successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error adding route:', error);
      Alert.alert('Error', 'Failed to add route. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const previewRoute = preview ? {
    id: 'preview',
    name: getRouteName(),
    grade,
    color,
    xNorm: preview.xNorm,
    yNorm: preview.yNorm,
    createdAt: new Date(),
    status,
    rating: 0,
    tops: 0,
    comments: 0,
  } : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Route</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSubmitting || !isMarkerLocked}>
          <Text style={[styles.saveButton, (isSubmitting || !isMarkerLocked) && styles.disabledButton]}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map Section */}
      <View style={styles.mapSection}>
        {/* Marker action bar - shown when marker exists */}
        {preview && !isMarkerLocked && (
          <View style={styles.markerActionBar}>
            <TouchableOpacity
              style={styles.markerCancelButton}
              onPress={handleCancelMarker}
            >
              <Text style={styles.markerActionText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.markerActionHint}>גרור להזיז • לחץ ✔ לאישור</Text>
            <TouchableOpacity
              style={styles.markerConfirmButton}
              onPress={handleConfirmMarker}
            >
              <Text style={styles.markerActionText}>✔</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Locked marker indicator */}
        {preview && isMarkerLocked && (
          <View style={styles.markerLockedBar}>
            <Text style={styles.markerLockedText}>✓ המיקום נקבע</Text>
            <TouchableOpacity
              style={styles.markerEditButton}
              onPress={handleUnlockMarker}
            >
              <Text style={styles.markerEditText}>שנה מיקום</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Instruction banner - only when no marker */}
        {!preview && (
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              Tap on the wall to place your route marker
            </Text>
          </View>
        )}

        <View style={styles.mapTouchable}>
          <MapViewport
            onMeasured={handleMapMeasured}
            onTransformChange={setCurrentTransforms}
            onTransformsReady={handleTransformsReady}
            onTap={isMarkerLocked ? undefined : handleMapTap}
          >
            {/* Show existing routes (dimmed) */}
            {existingRoutes.map((route) => {
              const { xImg, yImg } = CoordinateUtils.fromNorm(
                { xNorm: route.xNorm, yNorm: route.yNorm },
                imageDimensions
              );
              return (
                <View
                  key={route.id}
                  style={[
                    styles.existingMarkerContainer,
                    {
                      left: xImg - 14,
                      top: yImg - 14,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.existingMarker, { backgroundColor: route.color }]}>
                    <Text style={styles.existingMarkerText}>{route.grade}</Text>
                  </View>
                </View>
              );
            })}
            
            {/* Preview marker (draggable when not locked) */}
            {previewRoute && imageDimensions.imgW > 0 && (
              <GestureDetector gesture={markerDragGesture}>
                <Animated.View
                  style={[
                    styles.previewMarkerContainer,
                    {
                      left: preview!.xImg - 18,
                      top: preview!.yImg - 18,
                    },
                    !isMarkerLocked && markerAnimatedStyle,
                  ]}
                >
                  <RouteMarker
                    route={previewRoute}
                    scale={null as any}
                    selected={!isMarkerLocked}
                  />
                  {/* Show drag hint only when marker is not locked */}
                  {!isMarkerLocked && (
                    <View style={styles.dragHint}>
                      <Text style={styles.dragHintText}>⤧</Text>
                    </View>
                  )}
                  {/* Show lock indicator when marker is locked */}
                  {isMarkerLocked && (
                    <View style={styles.lockIndicator}>
                      <Text style={styles.lockIndicatorText}>✓</Text>
                    </View>
                  )}
                </Animated.View>
              </GestureDetector>
            )}
          </MapViewport>
        </View>

        {errors.position && (
          <Text style={styles.errorText}>{errors.position}</Text>
        )}
      </View>

      {/* Form Section */}
      <ScrollView style={styles.formSection}>
        {/* Auto-generated Route Name Preview */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>שם מסלול (אוטומטי)</Text>
          <View style={styles.namePreview}>
            <View style={[styles.nameColorDot, { backgroundColor: color }]} />
            <Text style={styles.namePreviewText}>{getRouteName()}</Text>
          </View>
        </View>

        {/* Grade Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>דרגת קושי *</Text>
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
          <Text style={styles.fieldLabel}>צבע *</Text>
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
                  <Text style={[styles.colorCheckmark, { color: getContrastTextColor(colorOption) }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
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
          <Text style={styles.fieldLabel}>מגדיר (אופציונלי)</Text>
          <TextInput
            style={styles.textInput}
            value={setter}
            onChangeText={setSetter}
            placeholder="מי בנה את המסלול?"
            maxLength={30}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>תגיות (אופציונלי)</Text>
          <TextInput
            style={styles.textInput}
            value={tags}
            onChangeText={setTags}
            placeholder="הפרד תגיות בפסיקים"
            maxLength={100}
          />
          <Text style={styles.helpText}>
            לדוגמה: אוברהנג, קרימפים, סלופרים
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

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
              <Text style={styles.colorPickerCancel}>ביטול</Text>
            </TouchableOpacity>
            <Text style={styles.colorPickerTitle}>צבע מותאם אישית</Text>
            <TouchableOpacity 
              onPress={() => {
                if (isValidHexColor(customColor)) {
                  setColor(customColor);
                  setShowColorPicker(false);
                } else {
                  Alert.alert('שגיאה', 'נא להזין קוד צבע תקין (לדוגמה: #FF5500)');
                }
              }}
            >
              <Text style={styles.colorPickerSave}>שמור</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.colorPickerContent}>
            {/* Color Preview */}
            <View style={styles.colorPreviewSection}>
              <View 
                style={[
                  styles.colorPreviewBox, 
                  { backgroundColor: isValidHexColor(customColor) ? customColor : '#cccccc' }
                ]} 
              />
              <Text style={styles.colorPreviewLabel}>תצוגה מקדימה</Text>
            </View>

            {/* Hex Input */}
            <View style={styles.hexInputSection}>
              <Text style={styles.hexInputLabel}>קוד צבע (HEX)</Text>
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
                placeholder="#FF5500"
                maxLength={7}
                autoCapitalize="characters"
              />
              <Text style={styles.hexInputHint}>לדוגמה: #FF0000 = אדום, #00FF00 = ירוק</Text>
            </View>

            {/* Quick Color Grid */}
            <View style={styles.quickColorsSection}>
              <Text style={styles.quickColorsLabel}>צבעים נוספים</Text>
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
          </View>
        </View>
      </Modal>
    </View>
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
    paddingTop: 48,
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
  mapSection: {
    height: 300,
    position: 'relative',
  },
  instructionBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Marker action bar styles (like SprayWall)
  markerActionBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(51, 51, 51, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 10,
  },
  markerCancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerConfirmButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerActionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  markerActionHint: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  markerLockedBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 10,
  },
  markerLockedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  markerEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  markerEditText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  mapTouchable: {
    flex: 1,
  },
  previewMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  existingMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  existingMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  existingMarkerText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dragHint: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#3b82f6',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  dragHintText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  lockIndicator: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#22c55e',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  lockIndicatorText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  formSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  fieldGroup: {
    marginVertical: 12,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
  },
  errorInput: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  selectedGradeChip: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColorChip: {
    borderColor: '#1f2937',
  },
  colorCheckmark: {
    fontSize: 18,
    fontWeight: '600',
  },
  customColorChip: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  customColorPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  customColorPlus: {
    fontSize: 24,
    color: '#9ca3af',
    fontWeight: '300',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  bottomPadding: {
    height: 40,
  },
  // Name preview styles
  namePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#1f2937',
  },
  // Color Picker Modal styles
  colorPickerModal: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  colorPickerCancel: {
    fontSize: 16,
    color: '#6b7280',
  },
  colorPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  colorPickerSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  colorPickerContent: {
    flex: 1,
    padding: 20,
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
    borderColor: '#e5e7eb',
  },
  colorPreviewLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  hexInputSection: {
    marginBottom: 30,
  },
  hexInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  hexInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    backgroundColor: '#f9fafb',
  },
  hexInputHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  quickColorsSection: {
    marginBottom: 20,
  },
  quickColorsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
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
});
