import React, { useState } from 'react';
import { View, Text, LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
} from 'react-native-gesture-handler';
import WallMapSVG from '@/assets/WallMapSVG';
import { useMapTransforms } from '../hooks/useMapTransforms';
import { MapTransforms } from '../types/route';

interface MapViewportProps {
  children?: React.ReactNode;
  onMeasured?: (dimensions: { imgW: number; imgH: number }) => void;
  onTransformChange?: (transforms: MapTransforms) => void;
  /**
   * Callback to expose the internal transform handlers from useMapTransforms to
   * the parent. This is useful for controlling zoom/pan from outside the
   * viewport without creating a second set of transform values. It will be
   * invoked whenever a new transforms object is created. The returned object
   * contains shared values (scale, translateX, translateY) as well as
   * imperative actions (zoomIn, zoomOut, resetView).
   */
  onTransformsReady?: (transforms: any) => void;
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

  /*
   * Inform parent components about the newly created transforms.  We don't
   * include transforms as a dependency here because useMapTransforms returns a
   * fresh object on each render by design (it contains shared values and
   * handlers). Wrapping this in a useEffect prevents us from calling the
   * callback every render unless the reference actually changes.  The parent
   * should memoize its handler with useCallback to avoid re-creating it
   * unnecessarily.
   */
  const didNotifyRef = React.useRef(false);
  React.useEffect(() => {
    // Notify only once to avoid infinite loops.  The transforms object
    // contains stable shared values and functions, so subsequent re-renders
    // don't require updating the parent controls.  Should the screen
    // dimensions or image dimensions change, the parent must re-mount
    // MapViewport to receive a new transforms object.
    if (!didNotifyRef.current && onTransformsReady) {
      didNotifyRef.current = true;
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
      <PanGestureHandler
        ref={transforms.panRef}
        onGestureEvent={transforms.panGestureHandler}
        simultaneousHandlers={[transforms.pinchRef]}
        minPointers={1}
        maxPointers={1}
      >
        <Animated.View style={styles.gestureContainer}>
          <PinchGestureHandler
            ref={transforms.pinchRef}
            onGestureEvent={transforms.pinchGestureHandler}
            simultaneousHandlers={[transforms.panRef]}
          >
            <Animated.View style={styles.gestureContainer}>
              <TapGestureHandler
                ref={transforms.doubleTapRef}
                onGestureEvent={transforms.doubleTapGestureHandler}
                numberOfTaps={2}
              >
                <Animated.View style={styles.gestureContainer}>
                  <Animated.View style={[styles.mapContainer, transforms.mapContainerStyle]}>
                    <WallMapSVG
                      width={imageDimensions.imgW}
                      height={imageDimensions.imgH}
                      preserveAspectRatio="xMidYMid meet"
                    />
                    {children}
                  </Animated.View>
                </Animated.View>
              </TapGestureHandler>
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});
