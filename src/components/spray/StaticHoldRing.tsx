// src/components/spray/StaticHoldRing.tsx
// Static ring component for displaying locked holds
// Uses SVG Circle to draw only stroke (no fill) - ensures overlapping rings stay transparent

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Hold } from '@/features/spraywall/types';

interface StaticHoldRingProps {
  hold: Hold;
  imageWidth: number;
  imageHeight: number;
}

export const StaticHoldRing: React.FC<StaticHoldRingProps> = ({
  hold,
  imageWidth,
  imageHeight,
}) => {
  if (!imageWidth || !imageHeight) return null;

  // Convert normalized values to pixels
  const xPx = hold.x * imageWidth;
  const yPx = hold.y * imageHeight;
  const rPx = hold.radius * imageWidth; // Radius normalized relative to width
  const strokeWidth = 4;

  // SVG container size (diameter + stroke on both sides)
  const size = (rPx + strokeWidth) * 2;
  const center = size / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          width: size,
          height: size,
          left: xPx - size / 2,
          top: yPx - size / 2,
        },
      ]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={rPx}
          stroke={hold.color}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});

export default StaticHoldRing;
