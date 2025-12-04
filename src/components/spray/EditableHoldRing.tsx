// src/components/spray/EditableHoldRing.tsx
// Editable ring component - displays the active hold visually
// Uses SVG Circle for true transparency, thinner stroke than static rings
// All gestures (pan, pinch) are now handled at WallImageWithHolds level

import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Hold } from '@/features/spraywall/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface EditableHoldRingProps {
  hold: Hold;
  imageWidth: number;
  imageHeight: number;
  // Shared values for smooth animation (passed from parent)
  sharedX?: SharedValue<number>;
  sharedY?: SharedValue<number>;
  sharedRadius?: SharedValue<number>;
}

export const EditableHoldRing: React.FC<EditableHoldRingProps> = ({
  hold,
  imageWidth,
  imageHeight,
  sharedX,
  sharedY,
  sharedRadius,
}) => {
  if (!imageWidth || !imageHeight) return null;
  
  // Always require shared values - they must be provided by parent
  // This ensures smooth animations without jumps
  if (!sharedX || !sharedY || !sharedRadius) {
    console.warn('EditableHoldRing: shared values are required for smooth animation');
    return null;
  }

  const strokeWidth = 2;

  // Animated style for the container position and size
  // Uses ONLY shared values - never falls back to hold props
  const animatedContainerStyle = useAnimatedStyle(() => {
    const x = sharedX.value;
    const y = sharedY.value;
    const radius = sharedRadius.value;
    
    const centerX = x * imageWidth;
    const centerY = y * imageHeight;
    const radiusPx = radius * imageWidth;
    const size = (radiusPx + strokeWidth) * 2;
    
    return {
      width: size,
      height: size,
      left: centerX - size / 2,
      top: centerY - size / 2,
    };
  });

  // Animated props for the SVG circle
  // Uses ONLY shared values - never falls back to hold props
  const animatedCircleProps = useAnimatedProps(() => {
    const radius = sharedRadius.value;
    const radiusPx = radius * imageWidth;
    const size = (radiusPx + strokeWidth) * 2;
    const center = size / 2;
    
    return {
      cx: center,
      cy: center,
      r: radiusPx,
    };
  });

  // We need a static size for the SVG, but the circle inside will animate
  // Use a large enough size to contain any reasonable ring
  const maxSize = imageWidth; // Max possible size

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <AnimatedCircle
          animatedProps={animatedCircleProps}
          stroke={hold.color}
          strokeWidth={strokeWidth}
          fill="transparent"
          fillOpacity={0}
        />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});

export default EditableHoldRing;
