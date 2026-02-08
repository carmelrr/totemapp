import React from 'react';
import { StyleSheet, TouchableOpacity, Text, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, SharedValue } from 'react-native-reanimated';
import type { Sector } from '@/features/wall-editor/types';

interface SectorLabelsOverlayProps {
  sectors: Sector[];
  /** Animated scale shared value from useMapTransforms */
  scale: SharedValue<number>;
  /** Animated translateX shared value from useMapTransforms */
  translateX: SharedValue<number>;
  /** Animated translateY shared value from useMapTransforms */
  translateY: SharedValue<number>;
  /** Image width in pixels (layout size) */
  imgW: number;
  /** Image height in pixels (layout size) */
  imgH: number;
  /** Room width in room coordinates */
  wallWidth: number;
  /** Room height in room coordinates */
  wallHeight: number;
  /** Called when a sector label is pressed */
  onSectorPress?: (sector: Sector) => void;
  /** Currently active (selected) sector ID for highlighting */
  activeSectorId?: string | null;
}

/**
 * Renders sector labels as a native RN overlay on top of the map.
 * Labels track sector positions based on the current map transform (pan/zoom)
 * and are rendered as TouchableOpacity buttons.
 * 
 * Positioned absolutely over the WallMap container.
 */
export default function SectorLabelsOverlay({
  sectors,
  scale,
  translateX,
  translateY,
  imgW,
  imgH,
  wallWidth,
  wallHeight,
  onSectorPress,
  activeSectorId,
}: SectorLabelsOverlayProps) {
  if (!sectors || sectors.length === 0 || imgW === 0 || imgH === 0) return null;

  return (
    <Animated.View style={styles.container} pointerEvents="box-none">
      {sectors.map(sector => (
        <SectorLabel
          key={sector.id}
          sector={sector}
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          imgW={imgW}
          imgH={imgH}
          wallWidth={wallWidth}
          wallHeight={wallHeight}
          onPress={onSectorPress}
          isActive={activeSectorId === sector.id}
        />
      ))}
    </Animated.View>
  );
}

interface SectorLabelProps {
  sector: Sector;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  imgW: number;
  imgH: number;
  wallWidth: number;
  wallHeight: number;
  onPress?: (sector: Sector) => void;
  isActive?: boolean;
}

function SectorLabel({
  sector,
  scale,
  translateX,
  translateY,
  imgW,
  imgH,
  wallWidth,
  wallHeight,
  onPress,
  isActive = false,
}: SectorLabelProps) {
  const labelOffset = sector.labelOffset || { x: 0, y: 0 };
  const labelOpacity = sector.labelOpacity ?? 1;

  // Track measured button size for centering — shared values avoid React re-renders
  const halfLabelW = useSharedValue(0);
  const halfLabelH = useSharedValue(0);

  // Convert room coordinates to image coordinates (static)
  const scaleX = imgW / wallWidth;
  const scaleY = imgH / wallHeight;

  // Label center in image coordinates
  const imgCenterX = sector.bounds.x + sector.bounds.width / 2 + labelOffset.x;
  const imgCenterY = sector.bounds.y + sector.bounds.height / 2 + labelOffset.y;
  const labelImgX = imgCenterX * scaleX;
  const labelImgY = imgCenterY * scaleY;

  // Image center for transform model
  const halfImgW = imgW / 2;
  const halfImgH = imgH / 2;

  // Animated style: convert image coordinates to screen coordinates
  // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
  const animatedStyle = useAnimatedStyle(() => {
    const s = scale.value;
    const tx = translateX.value;
    const ty = translateY.value;

    const screenX = (labelImgX - halfImgW) * s + halfImgW + tx;
    const screenY = (labelImgY - halfImgH) * s + halfImgH + ty;

    return {
      left: screenX - halfLabelW.value,
      top: screenY - halfLabelH.value,
      opacity: labelOpacity,
    };
  }, [labelImgX, labelImgY, halfImgW, halfImgH, labelOpacity]);

  // Use sector's configured font size directly
  // Scale it based on the relationship between image dimensions and room dimensions
  // to match what appears in the wall editor
  const baseFontSize = sector.labelFontSize || 14;
  const fontScale = imgW / wallWidth; // Same as how room coords map to image coords
  const fontSize = baseFontSize * fontScale;
  const paddingH = 10 * fontScale;
  const paddingV = 4 * fontScale;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const newHalfW = width / 2;
    const newHalfH = height / 2;
    if (newHalfW !== halfLabelW.value || newHalfH !== halfLabelH.value) {
      halfLabelW.value = newHalfW;
      halfLabelH.value = newHalfH;
    }
  };

  return (
    <Animated.View style={[styles.labelWrapper, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress?.(sector)}
        onLayout={handleLayout}
        style={[
          styles.labelButton,
          {
            backgroundColor: sector.color,
            paddingHorizontal: paddingH,
            paddingVertical: paddingV,
            borderRadius: (fontSize + paddingV * 2) / 2,
            borderWidth: isActive ? 3 : 0,
            borderColor: '#fff',
            transform: isActive ? [{ scale: 1.1 }] : [],
          },
          isActive && {
            shadowOpacity: 0.6,
            shadowRadius: 4,
            elevation: 8,
          },
        ]}
      >
        <Text style={[styles.labelText, { fontSize }]}>{sector.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20, // Above routes (zIndex 10)
    elevation: 20, // Android needs elevation for z-ordering
  },
  labelWrapper: {
    position: 'absolute',
  },
  labelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  labelText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
});
