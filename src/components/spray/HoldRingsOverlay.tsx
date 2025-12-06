// src/components/spray/HoldRingsOverlay.tsx
// Renders all hold rings in a single SVG layer
// This ensures overlapping rings create transparent intersections (cloud effect)

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
import { Hold } from '@/features/spraywall/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.View;

interface HoldRingsOverlayProps {
  holds: Hold[];
  imageWidth: number;
  imageHeight: number;
  // Active hold (being edited) - optional
  activeHold?: Hold | null;
  // Shared values for active hold animation
  activeHoldX?: SharedValue<number>;
  activeHoldY?: SharedValue<number>;
  activeHoldRadius?: SharedValue<number>;
}

// Static ring using View with border (guaranteed transparent center)
const StaticRingView: React.FC<{
  hold: Hold;
  imageWidth: number;
  imageHeight: number;
  strokeWidth: number;
}> = ({ hold, imageWidth, imageHeight, strokeWidth }) => {
  const cx = hold.x * imageWidth;
  const cy = hold.y * imageHeight;
  const r = hold.radius * imageWidth;
  const diameter = r * 2;

  console.log('🟡 Rendering StaticRingView:', { cx, cy, r, diameter, color: hold.color });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - r,
        top: cy - r,
        width: diameter,
        height: diameter,
        borderRadius: r,
        borderWidth: strokeWidth,
        borderColor: hold.color,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
      }}
    />
  );
};

// Animated ring using View with border for active hold
const AnimatedRingView: React.FC<{
  hold: Hold;
  imageWidth: number;
  imageHeight: number;
  strokeWidth: number;
  sharedX: SharedValue<number>;
  sharedY: SharedValue<number>;
  sharedRadius: SharedValue<number>;
}> = ({ hold, imageWidth, imageHeight, strokeWidth, sharedX, sharedY, sharedRadius }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const cx = sharedX.value * imageWidth;
    const cy = sharedY.value * imageHeight;
    const r = sharedRadius.value * imageWidth;
    const diameter = r * 2;

    return {
      position: 'absolute',
      left: cx - r,
      top: cy - r,
      width: diameter,
      height: diameter,
      borderRadius: r,
      borderWidth: strokeWidth,
      borderColor: hold.color,
      backgroundColor: 'transparent',
    };
  });

  return <AnimatedView pointerEvents="none" style={animatedStyle} />;
};

export const HoldRingsOverlay: React.FC<HoldRingsOverlayProps> = ({
  holds,
  imageWidth,
  imageHeight,
  activeHold = null,
  activeHoldX,
  activeHoldY,
  activeHoldRadius,
}) => {
  if (!imageWidth || !imageHeight) return null;

  // DEBUG: בדיקה שהקומפוננט החדש נטען
  console.log('🔵 HoldRingsOverlay rendered with:', {
    holdsCount: holds.length,
    imageWidth,
    imageHeight,
    hasActiveHold: !!activeHold,
  });

  const staticStrokeWidth = 2;  // Reduced from 4 to prevent thick fill look
  const activeStrokeWidth = 2;   // Reduced from 3

  // Check if we have valid shared values for active hold
  const hasActiveAnimation = activeHold && activeHoldX && activeHoldY && activeHoldRadius;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Render all static (locked) holds */}
      {holds.map((hold) => (
        <StaticRingView
          key={hold.id}
          hold={hold}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          strokeWidth={staticStrokeWidth}
        />
      ))}

      {/* Render active hold with animation */}
      {hasActiveAnimation && (
        <AnimatedRingView
          hold={activeHold}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          strokeWidth={activeStrokeWidth}
          sharedX={activeHoldX}
          sharedY={activeHoldY}
          sharedRadius={activeHoldRadius}
        />
      )}
    </View>
  );
};

export default HoldRingsOverlay;
