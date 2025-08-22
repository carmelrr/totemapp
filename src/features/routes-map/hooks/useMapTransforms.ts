import { useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  PinchGestureHandlerGestureEvent,
  PanGestureHandlerGestureEvent,
  TapGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import { clampViewport } from '../utils/coords';
import { MapTransforms } from '../types/route';

export interface UseMapTransformsConfig {
  minScale?: number;
  maxScale?: number;
  screenWidth: number;
  screenHeight: number;
  imageWidth: number;
  imageHeight: number;
  onTransformChange?: (transforms: MapTransforms) => void;
}

export function useMapTransforms({
  minScale = 0.5,
  maxScale = 4,
  screenWidth,
  screenHeight,
  imageWidth,
  imageHeight,
  onTransformChange,
}: UseMapTransformsConfig) {
  // ✅ Safety: וידוא שכל הפרמטרים תקינים
  const safeMinScale = Math.max(0.1, isFinite(minScale) ? minScale : 0.5);
  const safeMaxScale = Math.max(safeMinScale, isFinite(maxScale) ? maxScale : 4);
  const safeScreenWidth = Math.max(1, isFinite(screenWidth) ? screenWidth : 1);
  const safeScreenHeight = Math.max(1, isFinite(screenHeight) ? screenHeight : 1);
  const safeImageWidth = Math.max(1, isFinite(imageWidth) ? imageWidth : 1);
  const safeImageHeight = Math.max(1, isFinite(imageHeight) ? imageHeight : 1);
  
  // Shared values for transforms - initialize with safe values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Gesture state
  const baseScale = useSharedValue(1);
  const baseTranslateX = useSharedValue(0);
  const baseTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Refs for gesture handlers
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const doubleTapRef = useRef<TapGestureHandler>(null);

  // Helper to safely clamp and apply transforms
  const clampAndApply = (newScale: number, newTranslateX: number, newTranslateY: number) => {
    'worklet';
    
    // Ensure we have valid dimensions before clamping
    // ✅ Safety: בודק שכל הערכים תקינים לפני שליחה ל־clampViewport
    if (!safeScreenWidth || !safeScreenHeight || !safeImageWidth || !safeImageHeight) {
      console.warn('clampAndUpdateTransforms: Invalid dimensions');
      return;
    }
    
    // וידוא שהערכים החדשים תקינים
    const safeNewScale = Math.max(0.1, isFinite(newScale) ? newScale : 1);
    const safeNewTranslateX = isFinite(newTranslateX) ? newTranslateX : 0;
    const safeNewTranslateY = isFinite(newTranslateY) ? newTranslateY : 0;
    
    const clamped = clampViewport(
      { scale: safeNewScale, translateX: safeNewTranslateX, translateY: safeNewTranslateY },
      safeScreenWidth,
      safeScreenHeight,
      safeImageWidth,
      safeImageHeight,
      safeMinScale,
      safeMaxScale
    );
    
    // Ensure values are finite
    scale.value = isFinite(clamped.scale) ? clamped.scale : 1;
    translateX.value = isFinite(clamped.translateX) ? clamped.translateX : 0;
    translateY.value = isFinite(clamped.translateY) ? clamped.translateY : 0;
    
    if (onTransformChange) {
      runOnJS(onTransformChange)({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      });
    }
  };

  // Pan gesture handler
  const panGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      baseTranslateX.value = translateX.value;
      baseTranslateY.value = translateY.value;
    },
    onActive: (event) => {
      translateX.value = baseTranslateX.value + event.translationX;
      translateY.value = baseTranslateY.value + event.translationY;
    },
    onEnd: () => {
      // Clamp on gesture end with animation
      const clamped = clampViewport(
        { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
        screenWidth,
        screenHeight,
        imageWidth,
        imageHeight,
        minScale,
        maxScale
      );
      
      translateX.value = withTiming(clamped.translateX);
      translateY.value = withTiming(clamped.translateY);
      
      if (onTransformChange) {
        runOnJS(onTransformChange)(clamped);
      }
    },
  });

  // Pinch gesture handler
  const pinchGestureHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onStart: (event) => {
      baseScale.value = scale.value;
      baseTranslateX.value = translateX.value;
      baseTranslateY.value = translateY.value;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    },
    onActive: (event) => {
      const newScale = baseScale.value * event.scale;
      
      // Zoom around focal point
      const scaleDiff = newScale - baseScale.value;
      const fx = focalX.value;
      const fy = focalY.value;
      
      translateX.value = baseTranslateX.value - (fx - baseTranslateX.value) * scaleDiff / baseScale.value;
      translateY.value = baseTranslateY.value - (fy - baseTranslateY.value) * scaleDiff / baseScale.value;
      scale.value = newScale;
    },
    onEnd: () => {
      // Clamp on gesture end with animation
      const clamped = clampViewport(
        { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
        screenWidth,
        screenHeight,
        imageWidth,
        imageHeight,
        minScale,
        maxScale
      );
      
      scale.value = withTiming(clamped.scale);
      translateX.value = withTiming(clamped.translateX);
      translateY.value = withTiming(clamped.translateY);
      
      if (onTransformChange) {
        runOnJS(onTransformChange)(clamped);
      }
    },
  });

  // Double tap gesture handler (zoom to fit or zoom in)
  const doubleTapGestureHandler = useAnimatedGestureHandler<TapGestureHandlerGestureEvent>({
    onEnd: (event) => {
      const currentScale = scale.value;
      const targetScale = currentScale < 2 ? 2 : 1;
      
      if (targetScale === 1) {
        // Reset view
        clampAndApply(1, 0, 0);
      } else {
        // Zoom in around tap point
        const fx = event.x;
        const fy = event.y;
        const scaleDiff = targetScale - currentScale;
        
        const newTranslateX = translateX.value - (fx - translateX.value) * scaleDiff / currentScale;
        const newTranslateY = translateY.value - (fy - translateY.value) * scaleDiff / currentScale;
        
        clampAndApply(targetScale, newTranslateX, newTranslateY);
      }
      
      scale.value = withTiming(scale.value);
      translateX.value = withTiming(translateX.value);
      translateY.value = withTiming(translateY.value);
    },
  });

  // Animated style for the map container
  const mapContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    } as any;
  });

  // Reset view function
  const resetView = () => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    
    if (onTransformChange) {
      onTransformChange({ scale: 1, translateX: 0, translateY: 0 });
    }
  };

  // Manual zoom functions
  const zoomIn = () => {
    const newScale = Math.min(maxScale, scale.value * 1.5);
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    
    // Zoom around center
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * scaleDiff / scale.value;
    const newTranslateY = translateY.value - (centerY - translateY.value) * scaleDiff / scale.value;
    
    const clamped = clampViewport(
      { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
      screenWidth,
      screenHeight,
      imageWidth,
      imageHeight,
      minScale,
      maxScale
    );
    
    scale.value = withTiming(clamped.scale);
    translateX.value = withTiming(clamped.translateX);
    translateY.value = withTiming(clamped.translateY);
    
    if (onTransformChange) {
      onTransformChange(clamped);
    }
  };

  const zoomOut = () => {
    const newScale = Math.max(minScale, scale.value / 1.5);
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    
    // Zoom around center
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * scaleDiff / scale.value;
    const newTranslateY = translateY.value - (centerY - translateY.value) * scaleDiff / scale.value;
    
    const clamped = clampViewport(
      { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
      screenWidth,
      screenHeight,
      imageWidth,
      imageHeight,
      minScale,
      maxScale
    );
    
    scale.value = withTiming(clamped.scale);
    translateX.value = withTiming(clamped.translateX);
    translateY.value = withTiming(clamped.translateY);
    
    if (onTransformChange) {
      onTransformChange(clamped);
    }
  };

  return {
    // Shared values
    scale,
    translateX,
    translateY,
    
    // Gesture handlers
    panGestureHandler,
    pinchGestureHandler,
    doubleTapGestureHandler,
    
    // Gesture refs
    panRef,
    pinchRef,
    doubleTapRef,
    
    // Animated styles
    mapContainerStyle,
    
    // Actions
    resetView,
    zoomIn,
    zoomOut,
    
    // Config
    minScale,
    maxScale,
  };
}
