import React, { useState, useCallback } from 'react';
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

import { toImg, toNorm } from '../utils/coords';
import { GRADES } from '../utils/grades';
import { ROUTE_COLORS, getRandomRouteColor } from '../utils/colors';
import { RoutesService } from '../services/RoutesService';
import { MapTransforms } from '../types/route';

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

export default function AddRouteScreen() {
  const navigation = useNavigation<NavigationProp>();

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

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMapMeasured = useCallback((dimensions: { imgW: number; imgH: number }) => {
    setImageDimensions(dimensions);
  }, []);

  const handleMapPress = useCallback((event: any) => {
    if (imageDimensions.imgW === 0 || imageDimensions.imgH === 0) return;

    const { locationX, locationY } = event.nativeEvent;
    
    // Convert screen coordinates to image coordinates
    const { xImg, yImg } = toImg(
      { xS: locationX, yS: locationY },
      currentTransforms
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
    if (!validateForm() || !preview) return;

    setIsSubmitting(true);

    try {
      const routeData = {
        name: name.trim(),
        grade,
        color,
        xNorm: preview.xNorm,
        yNorm: preview.yNorm,
        status,
        setter: setter.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      };

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
            onTransformChange={setCurrentTransforms}
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
                  <Text style={styles.colorCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
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
    zIndex: 1,
  },
  instructionText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '500',
  },
  mapTouchable: {
    flex: 1,
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
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  bottomPadding: {
    height: 40,
  },
});
