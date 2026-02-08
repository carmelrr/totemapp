import React, { useCallback } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useUser } from '@/features/auth/UserContext';

// Try to import Slider, with fallback
let Slider: any;
try {
  Slider = require('@react-native-community/slider').default;
} catch (e) {
  if (__DEV__) console.warn('[ZoomSlider] Failed to import Slider:', e);
  Slider = null;
}

interface ZoomSliderProps {
  currentScale: number;
  minScale: number;
  maxScale: number;
  onZoomChange: (scale: number) => void;
  /** Force show the slider regardless of user preference */
  forceShow?: boolean;
  /** Show slider in vertical orientation */
  vertical?: boolean;
}

/**
 * בר גרירה לשליטה בזום של המפה
 * מזום למרכז של התצוגה הנוכחית
 */
export default function ZoomSlider({
  currentScale,
  minScale,
  maxScale,
  onZoomChange,
  forceShow = false,
  vertical = false,
}: ZoomSliderProps) {
  const { theme } = useTheme();
  const { showZoomSlider } = useUser();

  const handleValueChange = useCallback((value: number) => {
    onZoomChange(value);
  }, [onZoomChange]);

  // אם ההגדרה כבויה ולא מכריחים הצגה, לא מציג את הסליידר
  if (!showZoomSlider && !forceShow) {
    return null;
  }
  
  // If Slider failed to load, show error
  if (!Slider) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.error }}>Slider not available</Text>
      </View>
    );
  }

  if (vertical) {
    return (
      <View style={styles.verticalContainer}>
        <Slider
          style={styles.verticalSlider}
          minimumValue={minScale}
          maximumValue={maxScale}
          value={currentScale}
          onValueChange={handleValueChange}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
          step={0.1}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <Slider
        style={styles.slider}
        minimumValue={minScale}
        maximumValue={maxScale}
        value={currentScale}
        onValueChange={handleValueChange}
        minimumTrackTintColor={theme.primary}
        maximumTrackTintColor={theme.border}
        thumbTintColor={theme.primary}
        step={0.1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    marginHorizontal: 4,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  verticalContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    height: '90%',
    width: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  verticalSlider: {
    width: 180,
    height: 12,
    transform: [{ rotate: '-90deg' }],
  },
});
