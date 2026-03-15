// src/components/spray/HoldRingsOverlay.tsx
// Renders all hold rings in a single SVG layer
// This ensures overlapping rings create transparent intersections (cloud effect)
// Also renders hold numbering labels and mask (drawing) paths

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path as SvgPath } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
import { Hold, HoldNumberEntry, MaskPath } from '@/features/spraywall/types';

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
  // Hold numbering
  holdNumbering?: HoldNumberEntry[];
  // Mask paths (black drawing to hide holds)
  maskPaths?: MaskPath[];
}

// Static ring using View with border (guaranteed transparent center)
const StaticRingView: React.FC<{
  hold: Hold;
  imageWidth: number;
  imageHeight: number;
  offsetX: number;
  offsetY: number;
  strokeWidth: number;
  numbers?: number[];
}> = ({ hold, imageWidth, imageHeight, offsetX, offsetY, strokeWidth, numbers }) => {
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
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {numbers && numbers.length > 0 && (
        <View style={{
          position: 'absolute',
          top: -Math.max(6, r * 0.18),
          left: '50%',
          transform: [{ translateX: -Math.max(8, r * 0.22) }],
          backgroundColor: 'transparent',
          borderRadius: Math.max(6, r * 0.3),
          paddingHorizontal: Math.max(2, r * 0.08),
          paddingVertical: 0,
          minWidth: Math.max(14, r * 0.4),
          alignItems: 'center',
        }}>
          <Text style={{
            color: '#fff',
            fontSize: Math.max(7, Math.min(12, r * 0.35)),
            fontWeight: 'bold',
            textAlign: 'center',
            textShadowColor: 'rgba(0,0,0,0.9)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 3,
          }}>
            {numbers.join(',')}
          </Text>
        </View>
      )}
    </View>
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
  holdNumbering,
  maskPaths,
}) => {
  if (!imageWidth || !imageHeight) return null;

  const staticStrokeWidth = 2;  // Reduced from 4 to prevent thick fill look
  const activeStrokeWidth = 2;   // Reduced from 3

  // Check if we have valid shared values for active hold
  const hasActiveAnimation = activeHold && activeHoldX && activeHoldY && activeHoldRadius;

  // Build a map of holdId -> numbers[] for display
  const holdNumberMap = React.useMemo(() => {
    if (!holdNumbering || holdNumbering.length === 0) return new Map<string, number[]>();
    const map = new Map<string, number[]>();
    holdNumbering.forEach((entry) => {
      const nums = map.get(entry.holdId) || [];
      nums.push(entry.number);
      map.set(entry.holdId, nums);
    });
    return map;
  }, [holdNumbering]);

  // Calculate total container size for explicit SVG dimensions (needed for iOS)
  const containerTotalWidth = imageWidth + imageOffsetX * 2;
  const containerTotalHeight = imageHeight + imageOffsetY * 2;

  // Convert mask paths to SVG path strings
  const svgMaskPaths = React.useMemo(() => {
    if (!maskPaths || maskPaths.length === 0) return [];
    return maskPaths.map((mp) => {
      if (mp.points.length < 2) return null;
      const pathParts = mp.points.map((pt, i) => {
        const px = pt.x * imageWidth + imageOffsetX;
        const py = pt.y * imageHeight + imageOffsetY;
        return i === 0 ? `M${px},${py}` : `L${px},${py}`;
      });
      return {
        d: pathParts.join(' '),
        strokeWidth: mp.strokeWidth * imageWidth,
      };
    }).filter(Boolean);
  }, [maskPaths, imageWidth, imageHeight, imageOffsetX, imageOffsetY]);

  return (
    <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]} pointerEvents="none">
      {/* Render mask paths (black drawing to hide holds) */}
      {svgMaskPaths.length > 0 && (
        <Svg
          width={containerTotalWidth}
          height={containerTotalHeight}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {svgMaskPaths.map((path, index) => path && (
            <SvgPath
              key={`mask-${index}`}
              d={path.d}
              stroke="#000"
              strokeWidth={path.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      )}

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
          numbers={holdNumberMap.get(hold.id)}
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
