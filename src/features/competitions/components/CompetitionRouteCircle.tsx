/**
 * @fileoverview Competition Route Circle Component
 * @description Circle marker for competition routes on the wall map
 * Supports two modes:
 * - Display mode (national_league): Shows route number, no interaction
 * - Interactive mode (totemtition): Clickable to enter scores
 */

import React, { useMemo } from 'react';
import { Vibration } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useDerivedValue, 
  SharedValue, 
  runOnJS 
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CompetitionRoute } from '@/features/competitions/types';
import { getColorHex, getContrastTextColor } from '@/constants/colors';

interface CompetitionRouteCircleProps {
  route: CompetitionRoute;
  imageWidth: number;
  imageHeight: number;
  wallWidth: number;
  wallHeight: number;
  scale: SharedValue<number>;
  onPress?: (route: CompetitionRoute) => void;
  selected?: boolean;
  interactive?: boolean; // true for totemtition, false for national_league display-only
  completionCount?: number; // For totemtition - show how many completed
  isCompleted?: boolean; // For totemtition - if current user completed this route
  circleSize?: number; // Override default circle size
  displayLabel?: string; // Override label (e.g., "M1" instead of "1")
}

/**
 * Grade to color mapping for visual distinction
 */
const GRADE_COLORS: Record<string, string> = {
  'V0': '#22c55e', // green
  'V1': '#84cc16', // lime
  'V2': '#eab308', // yellow
  'V3': '#f97316', // orange
  'V4': '#ef4444', // red
  'V5': '#dc2626', // red darker
  'V6': '#9333ea', // purple
  'V7': '#7c3aed', // violet
  'V8': '#4f46e5', // indigo
  'V9': '#2563eb', // blue
  'V10': '#1d4ed8', // blue darker
  'TOTEM': '#3b82f6', // blue for totemtition
};

/**
 * Custom comparison function for React.memo
 * Ensures component re-renders when route color changes
 */
const arePropsEqual = (
  prevProps: CompetitionRouteCircleProps,
  nextProps: CompetitionRouteCircleProps
): boolean => {
  // Check route-specific properties that affect rendering
  if (prevProps.route.id !== nextProps.route.id) return false;
  if (prevProps.route.color !== nextProps.route.color) return false;
  if (prevProps.route.grade !== nextProps.route.grade) return false;
  if (prevProps.route.xNorm !== nextProps.route.xNorm) return false;
  if (prevProps.route.yNorm !== nextProps.route.yNorm) return false;
  if (prevProps.route.routeNumber !== nextProps.route.routeNumber) return false;
  
  // Check other props
  if (prevProps.imageWidth !== nextProps.imageWidth) return false;
  if (prevProps.imageHeight !== nextProps.imageHeight) return false;
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.interactive !== nextProps.interactive) return false;
  if (prevProps.isCompleted !== nextProps.isCompleted) return false;
  if (prevProps.completionCount !== nextProps.completionCount) return false;
  if (prevProps.circleSize !== nextProps.circleSize) return false;
  if (prevProps.displayLabel !== nextProps.displayLabel) return false;
  
  return true;
};

/**
 * Competition Route Circle - displays route number with optional interaction
 */
const CompetitionRouteCircle = React.memo<CompetitionRouteCircleProps>(({
  route,
  imageWidth,
  imageHeight,
  wallWidth,
  wallHeight,
  scale,
  onPress,
  selected = false,
  interactive = true,
  completionCount,
  isCompleted = false,
  circleSize: customCircleSize,
  displayLabel,
}) => {
  // Default circle size if not provided
  const baseCircleSize = customCircleSize ?? 16;

  // Pre-computed values - outside worklet
  const precomputedValues = useMemo(() => {
    // Get normalized coordinates (0-1 range)
    const xNorm = route.xNorm ?? 0;
    const yNorm = route.yNorm ?? 0;

    // Convert normalized coordinates to image coordinates
    const xImg = xNorm * imageWidth;
    const yImg = yNorm * imageHeight;

    // Validate coordinates
    if (!Number.isFinite(xImg) || !Number.isFinite(yImg)) {
      if (__DEV__) {
        console.warn('CompetitionRouteCircle: Invalid coordinates', { 
          routeId: route.id, 
          xNorm, 
          yNorm, 
          xImg, 
          yImg 
        });
      }
      return null;
    }

    // Get color - prefer route's custom color, fallback to grade-based color
    const colorHex = route.color || GRADE_COLORS[route.grade] || '#3b82f6';
    const textColor = getContrastTextColor(colorHex);

    // Base sizes
    const baseSize = baseCircleSize * 2.5;
    const baseFontSize = Math.max(8, baseCircleSize * 0.8);

    return {
      xImg,
      yImg,
      colorHex,
      textColor,
      baseSize,
      baseFontSize,
    };
  }, [route.id, route.xNorm, route.yNorm, route.grade, route.color, imageWidth, imageHeight, baseCircleSize]);

  // Return null if coordinates are invalid
  if (!precomputedValues) {
    return null;
  }

  // Compensated size - stays constant on screen regardless of zoom
  const compensatedSize = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    return precomputedValues.baseSize / safeScale;
  });

  const compensatedFontSize = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    return precomputedValues.baseFontSize / safeScale;
  });

  // Offset for centering the circle
  const compensatedOffset = useDerivedValue(() => {
    return compensatedSize.value / 2;
  });

  // Border width that compensates for zoom
  const compensatedBorderWidth = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    const baseBorder = selected ? 3 : (isCompleted ? 2 : 1);
    return baseBorder / safeScale;
  });

  // Circle style with animation
  const circleStyle = useAnimatedStyle(() => {
    const size = compensatedSize.value;
    const offset = compensatedOffset.value;
    const borderW = compensatedBorderWidth.value;
    
    return {
      position: 'absolute',
      left: precomputedValues.xImg - offset,
      top: precomputedValues.yImg - offset,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: isCompleted ? '#22c55e' : precomputedValues.colorHex,
      borderWidth: borderW,
      borderColor: selected ? '#0066cc' : (isCompleted ? '#16a34a' : '#ffffff'),
      elevation: selected ? 8 : 4,
      justifyContent: 'center',
      alignItems: 'center',
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    fontSize: compensatedFontSize.value,
    fontWeight: 'bold' as const,
    color: isCompleted ? '#ffffff' : precomputedValues.textColor,
    textAlign: 'center' as const,
  }));

  const shadowStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  };

  const handlePress = () => {
    if (onPress && interactive) {
      Vibration.vibrate(30);
      onPress(route);
    }
  };

  // Tap gesture - only enabled if interactive
  const tapGesture = useMemo(() => 
    Gesture.Tap()
      .enabled(interactive && !!onPress)
      .hitSlop({ top: 15, bottom: 15, left: 15, right: 15 })
      .onEnd(() => {
        'worklet';
        runOnJS(handlePress)();
      }),
    [interactive, onPress, route]
  );

  // Display route number (1-based) or custom label
  const routeLabel = displayLabel ?? String(route.routeNumber ?? route.number ?? 0);

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[circleStyle, shadowStyle]}>
        <Animated.Text style={textStyle} allowFontScaling={false}>
          {routeLabel}
        </Animated.Text>
      </Animated.View>
    </GestureDetector>
  );
}, arePropsEqual);

CompetitionRouteCircle.displayName = 'CompetitionRouteCircle';

export default CompetitionRouteCircle;
