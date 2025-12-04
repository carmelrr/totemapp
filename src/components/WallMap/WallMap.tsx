import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { runOnJS } from 'react-native-reanimated';
import { 
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useMapTransforms } from '@/hooks/useMapTransforms';
import { RouteDoc } from '@/features/routes-map/types/route';
import WallMapSVG from '@/assets/WallMapSVG';
import RouteCircle from './RouteCircle';

interface WallMapProps {
  routes: RouteDoc[];
  wallWidth: number;
  wallHeight: number;
  onRoutePress?: (route: RouteDoc) => void;
  onRouteLongPress?: (route: RouteDoc) => void;
  onLongPress?: (coordinates: { xImg: number; yImg: number }) => void;
  onMapTap?: (coordinates: { xImg: number; yImg: number }) => void; // For placing routes
  selectedRouteId?: string;
  children?: React.ReactNode;
  gesturesEnabled?: boolean;
  onGestureStateChange?: (enabled: boolean) => void;
  onTransformChange?: (transform: { scale: number; translateX: number; translateY: number }) => void;
}

/**
 * המפה האינטראקטיבית הראשית עם Pan/Zoom ומסלולים
 * משתמשת בקואורדינטות תמונה (xImg, yImg) כמקור האמת
 */
export default function WallMap({
  routes,
  wallWidth,
  wallHeight,
  onRoutePress,
  onRouteLongPress,
  onLongPress,
  onMapTap,
  selectedRouteId,
  children,
  gesturesEnabled = true,
  onGestureStateChange,
  onTransformChange,
}: WallMapProps) {
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });
  
  const [imageDimensions, setImageDimensions] = useState({
    imgW: 0,
    imgH: 0,
  });

  const [internalGesturesEnabled, setInternalGesturesEnabled] = useState(true);

  // משלב בין הגדרה חיצונית ופנימית
  const effectiveGesturesEnabled = gesturesEnabled && internalGesturesEnabled;

  // מפעיל מחדש את המחוות כשחוזרים למסך
  useFocusEffect(
    useCallback(() => {
      setInternalGesturesEnabled(true);
      onGestureStateChange?.(true);
    }, [onGestureStateChange])
  );

  const transforms = useMapTransforms({
    screenWidth: containerDimensions.width,
    screenHeight: containerDimensions.height,
    imageWidth: imageDimensions.imgW,
    imageHeight: imageDimensions.imgH,
    onTransformChange,
  });

  console.log('[WallMap] Render state:', {
    containerDimensions,
    imageDimensions,
    effectiveGesturesEnabled,
    hasTransforms: !!transforms,
  });

  // חישוב מידות התמונה בהתאם לאספקט רטיו של הקיר
  const wallAspectRatio = wallHeight / wallWidth;
  
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    
    if (width !== containerDimensions.width || height !== containerDimensions.height) {
      setContainerDimensions({ width, height });

      // חישוב מידות התמונה בהתאם לקונטיינר
      let imgW = width;
      let imgH = width * wallAspectRatio;

      // אם הגובה חורג מהקונטיינר, התאם לפי גובה
      if (imgH > height) {
        imgH = height;
        imgW = height / wallAspectRatio;
      }

      setImageDimensions({ imgW, imgH });
    }
  }, [containerDimensions, wallAspectRatio]);

  // המרת קואורדינטות מסך לקואורדינטות תמונה
  const screenToImage = useCallback((screenX: number, screenY: number) => {
    if (!transforms) {
      return { xImg: screenX, yImg: screenY };
    }
    
    // Convert screen coordinates to image coordinates
    // Need to account for current transform state
    const scale = transforms.scale.value;
    const translateX = transforms.translateX.value;
    const translateY = transforms.translateY.value;
    
    // Calculate image coordinates considering the current pan and zoom
    const xImg = (screenX - translateX) / scale;
    const yImg = (screenY - translateY) / scale;
    
    return { xImg, yImg };
  }, [transforms]);

  // Log when onMapTap changes
  React.useEffect(() => {
    console.log('[WallMap] onMapTap changed, exists:', !!onMapTap);
  }, [onMapTap]);

  // Callback wrapper that can be called via runOnJS
  const handleMapTapCallback = useCallback((screenX: number, screenY: number) => {
    console.log('[WallMap] handleMapTapCallback called with:', screenX, screenY);
    console.log('[WallMap] onMapTap exists:', !!onMapTap);
    
    if (!onMapTap) return;
    
    try {
      // Validate input coordinates
      if (typeof screenX !== 'number' || typeof screenY !== 'number' || 
          isNaN(screenX) || isNaN(screenY)) {
        console.error('[WallMap] Invalid screen coordinates:', { screenX, screenY });
        return;
      }
      
      console.log('[WallMap] transforms:', { 
        scale: transforms.scale.value, 
        translateX: transforms.translateX.value, 
        translateY: transforms.translateY.value 
      });
      console.log('[WallMap] imageDimensions:', imageDimensions);
      
      // Convert screen coordinates to image coordinates
      // Need to account for current transform state
      const scale = transforms.scale.value;
      const translateX = transforms.translateX.value;
      const translateY = transforms.translateY.value;
      
      // Validate transform values
      if (isNaN(scale) || isNaN(translateX) || isNaN(translateY) || scale === 0) {
        console.error('[WallMap] Invalid transform values:', { scale, translateX, translateY });
        return;
      }
      
      // Calculate image coordinates considering the current pan and zoom
      const imageX = (screenX - translateX) / scale;
      const imageY = (screenY - translateY) / scale;
      
      // Validate calculated coordinates
      if (isNaN(imageX) || isNaN(imageY)) {
        console.error('[WallMap] Invalid calculated coordinates:', { imageX, imageY });
        return;
      }
      
      console.log('[WallMap] Converted to image coordinates:', { imageX, imageY });
      
      onMapTap({ xImg: imageX, yImg: imageY });
      console.log('[WallMap] onMapTap completed successfully');
    } catch (error) {
      console.error('[WallMap] Error in onMapTap:', error);
    }
  }, [onMapTap, transforms, imageDimensions]);

  // Tap gesture for placing routes (used in move mode)
  // We recreate this gesture when onMapTap changes
  const mapTapGesture = useMemo(() => {
    return Gesture.Tap()
      .enabled(!!onMapTap)
      .maxDuration(300) // Shorter duration for more responsive taps
      .maxDistance(10) // Smaller distance for more precise taps
      .onEnd((event) => {
        'worklet';
        try {
          runOnJS(handleMapTapCallback)(event.x, event.y);
        } catch (error) {
          console.error('[WallMap] Error in tap gesture:', error);
        }
      });
  }, [onMapTap, handleMapTapCallback]);

  // Long press gesture using new Gesture API
  // Only for adding new routes on empty space (longer duration than RouteCircle)
  const longPressGesture = useMemo(() =>
    Gesture.LongPress()
      .minDuration(1000) // 1 second - longer than RouteCircle's 400ms
      .enabled(effectiveGesturesEnabled && !!onLongPress) // Only if onLongPress callback exists
      .onEnd((event) => {
        'worklet';
        if (onLongPress) {
          const processLongPress = (screenX: number, screenY: number) => {
            // כבה מחוות לפני הניווט
            setInternalGesturesEnabled(false);
            onGestureStateChange?.(false);
            onLongPress({ xImg: screenX, yImg: screenY });
          };
          runOnJS(processLongPress)(event.x, event.y);
        }
      }),
    [effectiveGesturesEnabled, onLongPress, onGestureStateChange]
  );

  // Compose gestures - if onMapTap exists, use tap gesture with higher priority
  const composedGesture = useMemo(() => {
    // If in move mode (onMapTap exists), disable pan/pinch and only allow tap
    if (onMapTap) {
      return Gesture.Exclusive(
        mapTapGesture,
        Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
      );
    }
    
    return Gesture.Race(
      longPressGesture,
      Gesture.Race(
        transforms.doubleTapGesture,
        Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
      )
    );
  }, [onMapTap, mapTapGesture, longPressGesture, transforms.doubleTapGesture, transforms.panGesture, transforms.pinchGesture]);

  const isReady = containerDimensions.width > 0 && imageDimensions.imgW > 0;

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
          <Animated.View style={[styles.mapContainer, transforms.mapContainerStyle]} collapsable={false}>
            {/* תמונת הקיר */}
            <WallMapSVG
              width={imageDimensions.imgW}
              height={imageDimensions.imgH}
              preserveAspectRatio="xMidYMid meet"
            />
            
            {/* שכבת המסלולים - pointerEvents="auto" to capture touch events */}
            <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents={onMapTap ? 'none' : 'box-none'}>
              {routes.map((route) => (
                <RouteCircle
                  key={route.id}
                  route={route}
                  imageWidth={imageDimensions.imgW}
                  imageHeight={imageDimensions.imgH}
                  wallWidth={wallWidth}
                  wallHeight={wallHeight}
                  scale={transforms.scale}
                  onPress={onRoutePress}
                  onLongPress={onRouteLongPress}
                  selected={selectedRouteId === route.id}
                  gesturesDisabled={!!onMapTap} // Disable route gestures when in move mode
                />
              ))}
            </View>
            
            {/* תוכן נוסף */}
            {children}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#01467D',
    width: '100%',
    height: '100%',
  },
  gestureContainer: {
    flex: 1,
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#e5e5e5',
  },
});
