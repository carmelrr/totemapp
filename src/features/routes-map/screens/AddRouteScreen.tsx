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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import MapViewport from '../components/MapViewport';
import RouteMarker from '../components/RouteMarker';

import { toImg, toNorm } from '@/utils/coordinateUtils';
import { GRADES } from '../utils/grades';
import { ROUTE_COLORS, getVisibleColors, getRandomRouteColor, getContrastTextColor } from '../utils/colors';
import { RoutesService } from '../services/RoutesService';
import { MapTransforms } from '../types/route';
import { useTheme, lightTheme } from '@/features/theme/ThemeContext';
import { containsProfanity } from '@/features/moderation/contentFilter';

type Theme = typeof lightTheme;

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
  const { theme } = useTheme();

  // Form state
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('V0');
  const [color, setColor] = useState(getRandomRouteColor());
  const [status, setStatus] = useState<'active' | 'archived' | 'draft'>('active');
  const [setter, setSetter] = useState('');
  const [tags, setTags] = useState('');

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
  const [currentZoom, setCurrentZoom] = useState(1);
  
  // Reference to map transforms for zoom control
  const mapTransformsRef = useRef<any>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create styles based on theme
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleMapMeasured = useCallback((dimensions: { imgW: number; imgH: number }) => {
    setImageDimensions(dimensions);
  }, []);

  // Handle transforms ready callback from MapViewport
  const handleTransformsReady = useCallback((transforms: any) => {
    mapTransformsRef.current = transforms;
  }, []);

  // Handle transform changes to update zoom level
  const handleTransformChange = useCallback((transforms: MapTransforms) => {
    setCurrentTransforms(transforms);
    setCurrentZoom(transforms.scale);
  }, []);

  const handleMapPress = useCallback((event: any) => {
    if (imageDimensions.imgW === 0 || imageDimensions.imgH === 0) return;

    const { locationX, locationY } = event.nativeEvent;

    // Convert screen coordinates to image coordinates using updated toImg with image dimensions
    const { xImg, yImg } = toImg(
      { xS: locationX, yS: locationY },
      currentTransforms,
      imageDimensions
    );

    // Clamp to image bounds
    const clampedXImg = Math.max(0, Math.min(imageDimensions.imgW, xImg));
    const clampedYImg = Math.max(0, Math.min(imageDimensions.imgH, yImg));

    // Convert to normalized coordinates
    const { xNorm, yNorm } = toNorm(
      { xImg: clampedXImg, yImg: clampedYImg },
      imageDimensions
    );

    setPreview({
      xImg: clampedXImg,
      yImg: clampedYImg,
      xNorm,
      yNorm,
    });

    // Clear position error if it exists
    if (errors.position) {
      setErrors(prev => ({ ...prev, position: '' }));
    }
  }, [imageDimensions, currentTransforms, errors.position]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Route name is required';
    } else if (containsProfanity(name)) {
      newErrors.name = 'Route name contains inappropriate language';
    }

    if (!grade) {
      newErrors.grade = 'Grade is required';
    }

    if (!color) {
      newErrors.color = 'Color is required';
    }

    if (!preview) {
      newErrors.position = 'Please tap on the map to place the route marker';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    console.log('🔥 SAVE_PRESS - כפתור Save נלחץ!');

    if (!validateForm() || !preview) return;

    setIsSubmitting(true);

    try {
      const routeData: any = {
        name: name.trim(),
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
    name: name || 'New Route',
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
        <TouchableOpacity onPress={handleSave} disabled={isSubmitting}>
          <Text style={[styles.saveButton, isSubmitting && styles.disabledButton]}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map Section */}
      <View style={styles.mapSection}>
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionText}>
            Tap on the wall to place your route marker
          </Text>
        </View>

        <TouchableOpacity style={styles.mapTouchable} onPress={handleMapPress}>
          <MapViewport
            onMeasured={handleMapMeasured}
            onTransformChange={handleTransformChange}
            onTransformsReady={handleTransformsReady}
          >
            {previewRoute && imageDimensions.imgW > 0 && (
              <View
                style={[
                  styles.previewMarkerContainer,
                  {
                    left: preview!.xImg - 18,
                    top: preview!.yImg - 18,
                  },
                ]}
              >
                <RouteMarker
                  route={previewRoute}
                  scale={null as any}
                  selected={true}
                />
              </View>
            )}
          </MapViewport>
        </TouchableOpacity>

        {errors.position && (
          <Text style={styles.errorText}>{errors.position}</Text>
        )}
      </View>

      {/* Form Section */}
      <ScrollView style={styles.formSection}>
        {/* Route Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Route Name *</Text>
          <TextInput
            style={[styles.textInput, errors.name && styles.errorInput]}
            value={name}
            onChangeText={setName}
            placeholder="Enter route name"
            maxLength={50}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Grade Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Grade *</Text>
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
          <Text style={styles.fieldLabel}>Color *</Text>
          <View style={styles.colorGrid}>
            {getVisibleColors().map((colorOption) => {
              const hex = colorOption.replace('#', '');
              const r = parseInt(hex.substr(0, 2), 16) || 0;
              const g = parseInt(hex.substr(2, 2), 16) || 0;
              const b = parseInt(hex.substr(4, 2), 16) || 0;
              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              const contrastRing = luminance > 0.7 ? '#333333' : '#FFFFFF';

              return (
                <View key={colorOption} style={[styles.colorChipOuter, { borderColor: contrastRing }]}>
                  <TouchableOpacity
                    style={[
                      styles.colorChip,
                      { backgroundColor: colorOption },
                      color === colorOption && styles.selectedColorChip,
                    ]}
                    onPress={() => setColor(colorOption)}
                  >
                    {color === colorOption && (
                      <Text style={styles.colorCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          {errors.color && <Text style={styles.errorText}>{errors.color}</Text>}
        </View>

        {/* Optional Fields */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Setter (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={setter}
            onChangeText={setSetter}
            placeholder="Who set this route?"
            maxLength={30}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Tags (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={tags}
            onChangeText={setTags}
            placeholder="Separate tags with commas"
            maxLength={100}
          />
          <Text style={styles.helpText}>
            Example: overhang, crimps, slopers
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Dynamic styles based on theme
const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
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
  mapSection: {
    position: 'relative',
    // Allow content to determine height instead of fixed minHeight
  },
  instructionBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: theme.isDark ? 'rgba(102, 126, 234, 0.9)' : 'rgba(59, 130, 246, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1,
  },
  instructionText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '500',
  },
  mapTouchable: {
    height: 280, // Fixed height for map area
  },
  previewMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
  colorChipOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  helpText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  bottomPadding: {
    height: 40,
  },
});
