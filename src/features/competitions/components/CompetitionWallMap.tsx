/**
 * @fileoverview Competition Wall Map Component
 * @description Interactive wall map for competition routes
 * Supports two modes:
 * - Admin/Judge mode: Can place routes on map, edit positions
 * - Participant mode: View-only (national_league) or interactive (totemtition)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Text } from 'react-native';
import Animated, { runOnJS } from 'react-native-reanimated';
import { 
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useMapTransforms } from '@/hooks/useMapTransforms';
import { DynamicWallMap } from '@/features/wall-editor/components';
import { Room } from '@/features/wall-editor/types';
import CompetitionRouteCircle from './CompetitionRouteCircle';
import { CompetitionRoute, CompetitionFormat } from '@/features/competitions/types';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';

interface CompetitionWallMapProps {
  routes: CompetitionRoute[];
  wallWidth: number;
  wallHeight: number;
  format: CompetitionFormat;
  onRoutePress?: (route: CompetitionRoute) => void;
  onMapTap?: (coordinates: { xNorm: number; yNorm: number }) => void; // For placing routes
  selectedRouteId?: string;
  children?: React.ReactNode;
  isEditing?: boolean; // Admin/judge editing mode
  userCompletedRoutes?: string[]; // Route IDs that user has completed (for totemtition)
  routeCompletionCounts?: Record<string, number>; // Route completion counts (for totemtition)
  circleSize?: number;
  /** Room data for rendering the dynamic wall map (optional — shows fallback if not provided) */
  room?: Room | null;
  /** Route prefix to prepend to route numbers (e.g., "M" → M1, M2) */
  routePrefix?: string;
}

/**
 * Competition Wall Map - displays competition routes on the wall image
 * Supports zoom, pan, and optional route placement
 */
export default function CompetitionWallMap({
  routes,
  wallWidth,
  wallHeight,
  format,
  onRoutePress,
  onMapTap,
  selectedRouteId,
  children,
  isEditing = false,
  userCompletedRoutes = [],
  routeCompletionCounts = {},
  circleSize,
  room,
  routePrefix,
}: CompetitionWallMapProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });
  
  const [imageDimensions, setImageDimensions] = useState({
    imgW: 0,
    imgH: 0,
  });

  const [internalGesturesEnabled, setInternalGesturesEnabled] = useState(true);

  // Re-enable gestures when screen is focused
  useFocusEffect(
    useCallback(() => {
      setInternalGesturesEnabled(true);
    }, [])
  );

  const transforms = useMapTransforms({
    screenWidth: containerDimensions.width,
    screenHeight: containerDimensions.height,
    imageWidth: imageDimensions.imgW,
    imageHeight: imageDimensions.imgH,
  });

  // Calculate wall aspect ratio
  const wallAspectRatio = wallHeight / wallWidth;
  
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    
    if (width !== containerDimensions.width || height !== containerDimensions.height) {
      setContainerDimensions({ width, height });

      // Calculate image dimensions based on container
      let imgW = width;
      let imgH = width * wallAspectRatio;

      // If height exceeds container, adjust by height
      if (imgH > height) {
        imgH = height;
        imgW = height / wallAspectRatio;
      }

      setImageDimensions({ imgW, imgH });
    }
  }, [containerDimensions, wallAspectRatio]);

  // Convert screen coordinates to normalized coordinates
  const handleMapTapCallback = useCallback((screenX: number, screenY: number) => {
    if (!onMapTap) return;
    
    try {
      // Validate input coordinates
      if (typeof screenX !== 'number' || typeof screenY !== 'number' || 
          isNaN(screenX) || isNaN(screenY)) {
        console.error('[CompetitionWallMap] Invalid screen coordinates:', { screenX, screenY });
        return;
      }
      
      // Convert screen coordinates to image coordinates
      const scale = transforms.scale.value;
      const translateX = transforms.translateX.value;
      const translateY = transforms.translateY.value;
      
      // Validate transform values
      if (isNaN(scale) || isNaN(translateX) || isNaN(translateY) || scale === 0) {
        console.error('[CompetitionWallMap] Invalid transform values:', { scale, translateX, translateY });
        return;
      }
      
      // Image center for transform calculations
      const imgCenterX = imageDimensions.imgW / 2;
      const imgCenterY = imageDimensions.imgH / 2;
      
      // Calculate image coordinates
      // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
      // To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
      const imageX = (screenX - imgCenterX - translateX) / scale + imgCenterX;
      const imageY = (screenY - imgCenterY - translateY) / scale + imgCenterY;
      
      // Convert to normalized coordinates (0-1)
      const xNorm = imageX / imageDimensions.imgW;
      const yNorm = imageY / imageDimensions.imgH;
      
      // Validate normalized coordinates are in range
      if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) {
        console.log('[CompetitionWallMap] Tap outside map bounds:', { xNorm, yNorm });
        return;
      }
      
      console.log('[CompetitionWallMap] Tap at normalized:', { xNorm, yNorm });
      onMapTap({ xNorm, yNorm });
    } catch (error) {
      console.error('[CompetitionWallMap] Error in onMapTap:', error);
    }
  }, [onMapTap, transforms, imageDimensions]);

  // Tap gesture for placing routes (editing mode)
  const mapTapGesture = useMemo(() => {
    return Gesture.Tap()
      .enabled(isEditing && !!onMapTap)
      .maxDuration(300)
      .maxDistance(10)
      .onEnd((event) => {
        'worklet';
        try {
          runOnJS(handleMapTapCallback)(event.x, event.y);
        } catch (error) {
          console.error('[CompetitionWallMap] Error in tap gesture:', error);
        }
      });
  }, [isEditing, onMapTap, handleMapTapCallback]);

  // Compose gestures
  const composedGesture = useMemo(() => {
    if (isEditing && onMapTap) {
      return Gesture.Exclusive(
        mapTapGesture,
        Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
      );
    }
    
    return Gesture.Race(
      transforms.doubleTapGesture,
      Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
    );
  }, [isEditing, onMapTap, mapTapGesture, transforms]);

  const isReady = containerDimensions.width > 0 && imageDimensions.imgW > 0;

  // Determine if routes are interactive based on format
  const isInteractive = (format === 'totemtition' || format === 'points_competition') && !isEditing;

  // For points_competition, show grade as label instead of route number
  const isPointsCompetition = format === 'points_competition';

  const styles = createStyles(theme);

  if (!isReady) {
    return (
      <View style={styles.container} onLayout={handleLayout}>
        <View style={styles.loadingContainer} />
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.gestureContainer} collapsable={false}>
          <Animated.View
            style={[
              styles.mapContainer,
              { width: imageDimensions.imgW, height: imageDimensions.imgH },
              transforms.mapContainerStyle,
            ]}
            collapsable={false}
          >
            {/* Wall image - dynamic map from wall editor */}
            {room ? (
              <DynamicWallMap
                room={room}
                width={imageDimensions.imgW}
                height={imageDimensions.imgH}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <View style={{ width: imageDimensions.imgW, height: imageDimensions.imgH, backgroundColor: theme.card }} />
            )}

            {/* Children (e.g., editing indicator) */}
            {children}
          </Animated.View>
          
          {/* Route circles layer - outside scaled container for crisp rendering on iOS */}
          <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents={isEditing ? 'none' : 'box-none'}>
            {routes.map((route) => (
              <CompetitionRouteCircle
                key={route.id}
                route={route}
                imageWidth={imageDimensions.imgW}
                imageHeight={imageDimensions.imgH}
                wallWidth={wallWidth}
                wallHeight={wallHeight}
                scale={transforms.scale}
                translateX={transforms.translateX}
                translateY={transforms.translateY}
                onPress={onRoutePress}
                selected={selectedRouteId === route.id}
                interactive={isInteractive || isEditing}
                isCompleted={userCompletedRoutes.includes(route.id)}
                completionCount={routeCompletionCounts[route.id]}
                circleSize={circleSize}
                displayLabel={
                  isPointsCompetition
                    ? (route.grade || '?')
                    : (routePrefix ? `${routePrefix}${route.routeNumber}` : undefined)
                }
              />
            ))}
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Editing mode indicator */}
      {isEditing && (
        <View style={styles.editingBadge}>
          <Text style={styles.editingText}>{t.competitionExt.tapToPlaceBadge}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gestureContainer: {
    flex: 1,
  },
  mapContainer: {
    position: 'absolute',
    transformOrigin: 'center center',
    direction: 'ltr',
  },
  editingBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
