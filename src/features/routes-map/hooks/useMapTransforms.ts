import { useRef, useCallback, useMemo } from 'react';
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
  const LOG = __DEV__ && false; // הפוך ל-true כשצריך דיבוג
  if (LOG) console.log('🔍 useMapTransforms init:', {
    minScale, maxScale, screenWidth, screenHeight, imageWidth, imageHeight
  });

  // ✅ Safety: וידוא שכל הפרמטרים תקינים
  const safeMinScale = Math.max(0.1, isFinite(minScale) ? minScale : 0.5);
  const safeMaxScale = Math.max(safeMinScale, isFinite(maxScale) ? maxScale : 4);
  const safeScreenWidth = Math.max(1, isFinite(screenWidth) ? screenWidth : 1);
  const safeScreenHeight = Math.max(1, isFinite(screenHeight) ? screenHeight : 1);
  const safeImageWidth = Math.max(1, isFinite(imageWidth) ? imageWidth : 1);
  const safeImageHeight = Math.max(1, isFinite(imageHeight) ? imageHeight : 1);
  
  if (LOG) console.log('🔍 useMapTransforms safe values:', {
    safeMinScale, safeMaxScale, safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight
  });

  // ✅ הגנה מפני ping-pong - זוכר ערכים אחרונים שנשלחו
  const lastSentRef = useRef<MapTransforms>({ scale: 1, translateX: 0, translateY: 0 });
  const EPS = 0.08; // סבילות קטנה לרעידות

  const onTransformChangeGuarded = useCallback((t: MapTransforms) => {
    const p = lastSentRef.current;
    const near = (a: number, b: number) => Math.abs(a - b) < EPS;
    if (near(p.scale, t.scale) && near(p.translateX, t.translateX) && near(p.translateY, t.translateY)) {
      return; // אל תטריג loop
    }
    lastSentRef.current = t;
    onTransformChange?.(t);
  }, [onTransformChange]);

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
      runOnJS(onTransformChangeGuarded)({
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
        safeScreenWidth,
        safeScreenHeight,
        safeImageWidth,
        safeImageHeight,
        safeMinScale,
        safeMaxScale
      );
      
      translateX.value = withTiming(clamped.translateX);
      translateY.value = withTiming(clamped.translateY);
      
      if (onTransformChange) {
        runOnJS(onTransformChangeGuarded)(clamped);
      }
    },
  });

  // Pinch gesture handler
  const pinchGestureHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onStart: (event) => {
      if (LOG) console.log('🔍 Pinch onStart');
      baseScale.value = scale.value;
      baseTranslateX.value = translateX.value;
      baseTranslateY.value = translateY.value;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    },
    onUpdate: (event) => {
      // ✅ קלמפ מיידי של ה-scale החדש
      const rawScale = baseScale.value * (event.scale ?? 1);
      const clampedScale = Math.max(safeMinScale, Math.min(safeMaxScale, rawScale));
      
      // ✅ Zoom around focal point - מתרגמים focal לעולם התמונה
      const currentScale = scale.value || 1;
      const fxImg = (focalX.value - translateX.value) / currentScale;
      const fyImg = (focalY.value - translateY.value) / currentScale;
      
      // עדכון עם ה-scale המקולמפ
      scale.value = clampedScale;
      translateX.value = focalX.value - fxImg * clampedScale;
      translateY.value = focalY.value - fyImg * clampedScale;
    },
    onEnd: () => {
      if (LOG) console.log('🔍 Pinch onEnd - final clamp');
      // Clamp on gesture end with animation
      const clamped = clampViewport(
        { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
        safeScreenWidth,
        safeScreenHeight,
        safeImageWidth,
        safeImageHeight,
        safeMinScale,
        safeMaxScale
      );
      
      scale.value = withTiming(clamped.scale);
      translateX.value = withTiming(clamped.translateX);
      translateY.value = withTiming(clamped.translateY);
      
      if (onTransformChange) {
        runOnJS(onTransformChangeGuarded)(clamped);
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
      onTransformChangeGuarded({ scale: 1, translateX: 0, translateY: 0 });
    }
  };

  // Manual zoom functions
  const zoomIn = () => {
    const newScale = Math.min(safeMaxScale, scale.value * 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    // Zoom around center
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * scaleDiff / scale.value;
    const newTranslateY = translateY.value - (centerY - translateY.value) * scaleDiff / scale.value;
    
    const clamped = clampViewport(
      { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
      safeScreenWidth,
      safeScreenHeight,
      safeImageWidth,
      safeImageHeight,
      safeMinScale,
      safeMaxScale
    );
    
    scale.value = withTiming(clamped.scale);
    translateX.value = withTiming(clamped.translateX);
    translateY.value = withTiming(clamped.translateY);
    
    if (onTransformChange) {
      onTransformChangeGuarded(clamped);
    }
  };

  const zoomOut = () => {
    const newScale = Math.max(safeMinScale, scale.value / 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    // Zoom around center
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * scaleDiff / scale.value;
    const newTranslateY = translateY.value - (centerY - translateY.value) * scaleDiff / scale.value;
    
    const clamped = clampViewport(
      { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
      safeScreenWidth,
      safeScreenHeight,
      safeImageWidth,
      safeImageHeight,
      safeMinScale,
      safeMaxScale
    );
    
    scale.value = withTiming(clamped.scale);
    translateX.value = withTiming(clamped.translateX);
    translateY.value = withTiming(clamped.translateY);
    
    if (onTransformChange) {
      onTransformChangeGuarded(clamped);
    }
  };

  // Memoize the returned object to keep a stable reference where possible
  return useMemo(() => ({
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
  }), [
    panGestureHandler,
    pinchGestureHandler,
    doubleTapGestureHandler,
    mapContainerStyle,
    resetView,
    zoomIn,
    zoomOut,
    minScale,
    maxScale,
    scale,
    translateX,
    translateY,
    panRef,
    pinchRef,
    doubleTapRef,
  ]);
}
