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
