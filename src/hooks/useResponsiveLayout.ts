import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

export type Orientation = 'portrait' | 'landscape';

export interface ResponsiveLayout {
  /** Current screen width */
  width: number;
  /** Current screen height */
  height: number;
  /** Current orientation */
  orientation: Orientation;
  /** Whether screen is in landscape mode */
  isLandscape: boolean;
  /** Whether screen is in portrait mode */
  isPortrait: boolean;
  /** Whether device is a tablet (shorter dimension >= 600) */
  isTablet: boolean;
  /** Whether device is a phone (not a tablet) */
  isPhone: boolean;
  /** Whether device is a phone in landscape mode */
  isPhoneLandscape: boolean;
  /** Shorter dimension (useful for squares/circles) */
  shortDimension: number;
  /** Longer dimension */
  longDimension: number;
  /** Aspect ratio (width/height) */
  aspectRatio: number;
  /** Safe max map height in portrait (percentage of screen) */
  mapHeightRatio: number;
  /** Layout mode for map screens */
  mapLayoutMode: 'vertical' | 'horizontal' | 'phone-landscape';
  /** Scale factor for UI elements based on screen size */
  scaleFactor: number;
}

/**
 * Hook for responsive layout calculations
 * Automatically updates when screen dimensions change (rotation, resize)
 * 
 * @example
 * const { isLandscape, width, height, mapLayoutMode } = useResponsiveLayout();
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  
  return useMemo(() => {
    const isLandscape = width > height;
    const orientation: Orientation = isLandscape ? 'landscape' : 'portrait';
    const shortDimension = Math.min(width, height);
    const longDimension = Math.max(width, height);
    const isTablet = shortDimension >= 600;
    const isPhone = !isTablet;
    const isPhoneLandscape = isPhone && isLandscape;
    const aspectRatio = width / height;
    
    // Calculate appropriate map height ratio based on device and orientation
    let mapHeightRatio: number;
    if (isLandscape) {
      if (isTablet) {
        // Tablet landscape: side-by-side layout, map uses full height
        mapHeightRatio = 1.0;
      } else {
        // Phone landscape: limited height, map needs to be visible
        // Use higher ratio since screen is very short
        mapHeightRatio = 0.85;
      }
    } else {
      // Portrait mode: map takes upper portion
      mapHeightRatio = isTablet ? 0.5 : 0.45;
    }
    
    // Determine layout mode for map screens
    // horizontal: tablet landscape - map and list side by side
    // phone-landscape: phone landscape - special compact horizontal layout
    // vertical: portrait mode - map on top, list below
    let mapLayoutMode: 'vertical' | 'horizontal' | 'phone-landscape';
    if (isLandscape) {
      if (isTablet) {
        mapLayoutMode = 'horizontal';
      } else {
        mapLayoutMode = 'phone-landscape';
      }
    } else {
      mapLayoutMode = 'vertical';
    }
    
    // Scale factor for UI elements
    // Base scale on 375px (iPhone standard width)
    const baseScale = 375;
    const scaleFactor = Math.min(1.5, Math.max(0.8, shortDimension / baseScale));
    
    return {
      width,
      height,
      orientation,
      isLandscape,
      isPortrait: !isLandscape,
      isTablet,
      isPhone,
      isPhoneLandscape,
      shortDimension,
      longDimension,
      aspectRatio,
      mapHeightRatio,
      mapLayoutMode,
      scaleFactor,
    };
  }, [width, height]);
}

/**
 * Calculate responsive value based on screen size
 * @param baseValue The base value for standard phone (375px width)
 * @param scaleFactor The scale factor from useResponsiveLayout
 * @param min Optional minimum value
 * @param max Optional maximum value
 */
export function responsiveValue(
  baseValue: number,
  scaleFactor: number,
  min?: number,
  max?: number
): number {
  let value = baseValue * scaleFactor;
  if (min !== undefined) value = Math.max(min, value);
  if (max !== undefined) value = Math.min(max, value);
  return value;
}

export default useResponsiveLayout;
