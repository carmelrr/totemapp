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
  // Offset for the image within the container (for resizeMode="contain" letterboxing)
  imageOffsetX?: number;
  imageOffsetY?: number;
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
  offsetX: number;
  offsetY: number;
  strokeWidth: number;
}> = ({ hold, imageWidth, imageHeight, offsetX, offsetY, strokeWidth }) => {
  // Position is relative to the actual displayed image area (with offset for letterboxing)
  const cx = hold.x * imageWidth + offsetX;
  const cy = hold.y * imageHeight + offsetY;
  const r = hold.radius * imageWidth;
  const diameter = r * 2;

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
  offsetX: number;
  offsetY: number;
  strokeWidth: number;
  sharedX: SharedValue<number>;
  sharedY: SharedValue<number>;
  sharedRadius: SharedValue<number>;
}> = ({ hold, imageWidth, imageHeight, offsetX, offsetY, strokeWidth, sharedX, sharedY, sharedRadius }) => {
  const animatedStyle = useAnimatedStyle(() => {
    // Position is relative to the actual displayed image area (with offset for letterboxing)
    const cx = sharedX.value * imageWidth + offsetX;
    const cy = sharedY.value * imageHeight + offsetY;
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
  imageOffsetX = 0,
  imageOffsetY = 0,
  activeHold = null,
  activeHoldX,
  activeHoldY,
  activeHoldRadius,
}) => {
  if (!imageWidth || !imageHeight) return null;

  const staticStrokeWidth = 2;  // Reduced from 4 to prevent thick fill look
  const activeStrokeWidth = 2;   // Reduced from 3

  // Check if we have valid shared values for active hold
  const hasActiveAnimation = activeHold && activeHoldX && activeHoldY && activeHoldRadius;

  return (
    <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]} pointerEvents="none">
      {/* Render all static (locked) holds */}
      {holds.map((hold) => (
        <StaticRingView
          key={hold.id}
          hold={hold}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          offsetX={imageOffsetX}
          offsetY={imageOffsetY}
          strokeWidth={staticStrokeWidth}
        />
      ))}

      {/* Render active hold with animation */}
      {hasActiveAnimation && (
        <AnimatedRingView
          hold={activeHold}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          offsetX={imageOffsetX}
          offsetY={imageOffsetY}
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
