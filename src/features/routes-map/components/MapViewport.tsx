import React, { useState, useMemo } from 'react';
import { View, Text, LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated, { runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import WallMapSVG from '@/assets/WallMapSVG';
import { useMapTransforms } from '@/hooks/useMapTransforms';
import { MapTransforms } from '../types/route';

interface MapViewportProps {
  children?: React.ReactNode;
  onMeasured?: (dimensions: { imgW: number; imgH: number }) => void;
  onTransformChange?: (transforms: MapTransforms) => void;
  /**
   * Callback that receives the internal transform handlers (scale, translation
   * shared values and zoom/reset functions) when the viewport is initialized.
   * This allows parent components to control zoom and pan without creating
   * another set of transforms. It is invoked once after the transforms are
   * created.
   */
  onTransformsReady?: (transforms: any) => void;
  /**
   * Callback for single tap on the map. Receives IMAGE coordinates (xImg, yImg),
   * already converted from screen coordinates using current transforms.
   * This matches WallMap's onMapTap behavior for consistency.
   */
  onTap?: (coordinates: { xImg: number; yImg: number }) => void;
  debug?: boolean;
}

// SVG viewBox dimensions from WallMapSVG
const SVG_WIDTH = 2560;
const SVG_HEIGHT = 1600;
const SVG_ASPECT_RATIO = SVG_HEIGHT / SVG_WIDTH;

export default function MapViewport({
  children,
  onMeasured,
  onTransformChange,
  onTransformsReady,
  onTap,
  debug = false,
}: MapViewportProps) {
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [imageDimensions, setImageDimensions] = useState({
    imgW: 0,
    imgH: 0,
  });
  const [isReady, setIsReady] = useState(false);

  const transforms = useMapTransforms({
    screenWidth: containerDimensions.width,
    screenHeight: containerDimensions.height,
    imageWidth: imageDimensions.imgW,
    imageHeight: imageDimensions.imgH,
    onTransformChange,
  });

  // Callback to pass calculated image coordinates to parent
  // Receives already-calculated image coordinates from worklet
  const handleTapCallback = React.useCallback((xImg: number, yImg: number) => {
    if (!onTap) return;
    
    // Validate calculated coordinates
    if (typeof xImg !== 'number' || typeof yImg !== 'number' || 
        isNaN(xImg) || isNaN(yImg)) {
      console.error('[MapViewport] Invalid calculated coordinates:', { xImg, yImg });
      return;
    }
    
    onTap({ xImg, yImg });
  }, [onTap]);

  // Single tap gesture for placing markers - configured for responsive tap detection
  // Coordinates are calculated directly in the worklet for accuracy
  const singleTapGesture = useMemo(() => 
    Gesture.Tap()
      .numberOfTaps(1)
      .maxDuration(350) // Slightly longer for more forgiving tap detection
      .maxDistance(15) // Allow more finger movement during tap for natural touch
      .onEnd((event) => {
        'worklet';
        if (onTap) {
          // Calculate image coordinates directly in worklet for accuracy
          // event.x and event.y are relative to the GestureDetector container
          const screenX = event.x;
          const screenY = event.y;
          
          // Read transforms directly from shared values in worklet
          const s = transforms.scale.value;
          const tx = transforms.translateX.value;
          const ty = transforms.translateY.value;
          
          // The map container uses a complex transform with scale compensation:
          // transform: [
          //   { scale: s },
          //   { translateX: (tx - scaleCompX) / s },
          //   { translateY: (ty - scaleCompY) / s },
          // ]
          // where scaleCompX = imgW * (1-s) / 2 and scaleCompY = imgH * (1-s) / 2
          //
          // This means a point at image coords (xImg, yImg) appears at screen coords:
          // screenX = xImg * s + tx  (after simplification)
          // screenY = yImg * s + ty
          //
          // So to invert:
          // xImg = (screenX - tx) / s
          // yImg = (screenY - ty) / s
          const xImg = (screenX - tx) / s;
          const yImg = (screenY - ty) / s;
          
          // Log all values for debugging
          console.log('=== TAP DEBUG ===' );
          console.log('Screen tap:', { screenX, screenY });
          console.log('Transforms:', { scale: s, translateX: tx, translateY: ty });
          console.log('Image dimensions:', { imgW: imageDimensions.imgW, imgH: imageDimensions.imgH });
          console.log('Calculated image coords:', { xImg, yImg });
          console.log('================');
          
          // Call JS callback with calculated coordinates
          runOnJS(handleTapCallback)(xImg, yImg);
        }
      }),
    [onTap, handleTapCallback, transforms.scale, transforms.translateX, transforms.translateY, imageDimensions]
  );

  // Combine gestures - structure matches WallMap for consistency
  const combinedGesture = useMemo(() => {
    if (onTap) {
      // When placing markers, tap has priority but still allow pan/pinch
      return Gesture.Exclusive(
        singleTapGesture,
        Gesture.Race(
          transforms.doubleTapGesture,
          Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
        )
      );
    }
    // Normal mode - just use the composed gesture from transforms
    return transforms.composedGesture;
  }, [transforms.composedGesture, transforms.doubleTapGesture, transforms.panGesture, transforms.pinchGesture, singleTapGesture, onTap]);

  // Notify parent of the transforms exactly once.  A ref tracks whether
  // notification has occurred to avoid an infinite update loop.
  const notifiedRef = React.useRef(false);
  React.useEffect(() => {
    if (!notifiedRef.current && onTransformsReady) {
      notifiedRef.current = true;
      onTransformsReady(transforms);
    }
  }, [onTransformsReady, transforms]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    
    // Only update if dimensions actually changed to prevent loops
    if (width !== containerDimensions.width || height !== containerDimensions.height) {
      setContainerDimensions({ width, height });

      // Calculate image dimensions based on container and SVG aspect ratio
      let imgW = width;
      let imgH = width * SVG_ASPECT_RATIO;

      // If image height exceeds container height, fit by height instead
      if (imgH > height) {
        imgH = height;
        imgW = height / SVG_ASPECT_RATIO;
      }

      setImageDimensions({ imgW, imgH });
      setIsReady(true);
      onMeasured?.({ imgW, imgH });
    }
  };

  // Don't render anything until we have valid dimensions
  if (!isReady || containerDimensions.width === 0 || containerDimensions.height === 0) {
    return (
      <View style={styles.container} onLayout={handleLayout}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={styles.gestureContainer} collapsable={false}>
          <Animated.View style={[styles.mapContainer, transforms.mapContainerStyle]} collapsable={false}>
            <WallMapSVG
              width={imageDimensions.imgW}
              height={imageDimensions.imgH}
              preserveAspectRatio="xMidYMid meet"
            />
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
    backgroundColor: '#f5f5f5',
    overflow: 'hidden', // Prevent map from visually going outside bounds
  },
  gestureContainer: {
    flex: 1,
    overflow: 'hidden', // Double ensure clipping
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});
