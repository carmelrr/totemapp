import { useRef, useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  PinchGestureHandlerGestureEvent,
  PanGestureHandlerGestureEvent,
  TapGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';

export interface UseMapTransformsConfig {
  screenWidth: number;
  screenHeight: number;
  imageWidth: number;
  imageHeight: number;
  minScale?: number;
  maxScale?: number;
  onTransformChange?: (transform: {
    scale: number;
    translateX: number;
    translateY: number;
  }) => void;
}

/**
 * Hook לניהול טרנספורמציות המפה (Pan/Zoom) עם Reanimated 3
 * מחזיר מטריצת טרנספורם יציבה ופונקציות זום
 */
export function useMapTransforms({
  screenWidth,
  screenHeight,
  imageWidth,
  imageHeight,
  minScale = 1, // Set minimum scale to 1 (initial view size)
  maxScale = 4,
  onTransformChange,
}: UseMapTransformsConfig) {
  
  // ערכים בטוחים למניעת חלוקה באפס
  const safeScreenWidth = Math.max(1, screenWidth || 1);
  const safeScreenHeight = Math.max(1, screenHeight || 1);
  const safeImageWidth = Math.max(1, imageWidth || 1);
  const safeImageHeight = Math.max(1, imageHeight || 1);
  
  // Shared values עבור הטרנספורם
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Throttled notification state
  const lastNotifyScale = useSharedValue(1);
  const lastNotifyX = useSharedValue(0);
  const lastNotifyY = useSharedValue(0);
  
  // ערכי בסיס לגסטורות
  const baseScale = useSharedValue(1);
  const baseTranslateX = useSharedValue(0);
  const baseTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Refs לגסטורות
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const doubleTapRef = useRef<TapGestureHandler>(null);

  // Safe log function for worklets
  const safeLog = useCallback((message: string, data?: any) => {
    console.log(message, data);
  }, []);

  // פונקציה לקליפינג והחלת טרנספורם
  const clampAndApply = useCallback((newScale: number, newX: number, newY: number) => {
    'worklet';
    
    // קליפינג של סקייל
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    // חישוב גבולות תרגום
    const scaledImageWidth = safeImageWidth * clampedScale;
    const scaledImageHeight = safeImageHeight * clampedScale;
    
    const maxTranslateX = Math.max(0, (scaledImageWidth - safeScreenWidth) / 2);
    const maxTranslateY = Math.max(0, (scaledImageHeight - safeScreenHeight) / 2);
    
    const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
    const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));
    
    // החלת הערכים
    scale.value = clampedScale;
    translateX.value = clampedX;
    translateY.value = clampedY;
    
    // התראה לקומפוננט ההורה
    if (onTransformChange) {
      runOnJS(onTransformChange)({
        scale: clampedScale,
        translateX: clampedX,
        translateY: clampedY,
      });
    }
  }, [minScale, maxScale, safeImageWidth, safeImageHeight, safeScreenWidth, safeScreenHeight, onTransformChange]);

  // Notify JS with a small threshold to avoid spamming during gestures
  const notifyIfChanged = useCallback((s: number, x: number, y: number) => {
    'worklet';
    const ds = Math.abs(s - lastNotifyScale.value);
    const dx = Math.abs(x - lastNotifyX.value);
    const dy = Math.abs(y - lastNotifyY.value);
    if (ds > 0.01 || dx > 4 || dy > 4) {
      lastNotifyScale.value = s;
      lastNotifyX.value = x;
      lastNotifyY.value = y;
      if (onTransformChange) {
        runOnJS(onTransformChange)({ scale: s, translateX: x, translateY: y });
      }
    }
  }, [onTransformChange]);

  // Pan gesture handler
  const panGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      baseTranslateX.value = translateX.value;
      baseTranslateY.value = translateY.value;
    },
    onActive: (event) => {
      translateX.value = baseTranslateX.value + event.translationX;
      translateY.value = baseTranslateY.value + event.translationY;
      notifyIfChanged(scale.value, translateX.value, translateY.value);
    },
    onEnd: () => {
      clampAndApply(scale.value, translateX.value, translateY.value);
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
      const newScale = baseScale.value * (event.scale ?? 1);
      
      // זום סביב נקודת המוקד
      const scaleDiff = newScale - baseScale.value;
      const newTranslateX = baseTranslateX.value - (focalX.value - baseTranslateX.value) * (scaleDiff / baseScale.value);
      const newTranslateY = baseTranslateY.value - (focalY.value - baseTranslateY.value) * (scaleDiff / baseScale.value);
      
      scale.value = newScale;
      translateX.value = newTranslateX;
      translateY.value = newTranslateY;
      notifyIfChanged(scale.value, translateX.value, translateY.value);
    },
    onEnd: () => {
      clampAndApply(scale.value, translateX.value, translateY.value);
    },
  });

  // Double tap gesture handler
  const doubleTapGestureHandler = useAnimatedGestureHandler<TapGestureHandlerGestureEvent>({
    onEnd: (event) => {
      const currentScale = scale.value;
      const targetScale = currentScale < 2 ? 2 : 1;
      
      if (targetScale === 1) {
        // איפוס מבט
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        // זום פנימה סביב נקודת הלחיצה
        const fx = event.x;
        const fy = event.y;
        const scaleDiff = targetScale - currentScale;
        
        const newTranslateX = translateX.value - (fx - translateX.value) * (scaleDiff / currentScale);
        const newTranslateY = translateY.value - (fy - translateY.value) * (scaleDiff / currentScale);
        
        scale.value = withSpring(targetScale);
        translateX.value = withSpring(newTranslateX);
        translateY.value = withSpring(newTranslateY);
      }
      
      if (onTransformChange) {
        runOnJS(onTransformChange)({
          scale: scale.value,
          translateX: translateX.value,
          translateY: translateY.value,
        });
      }
    },
  });

  // סטייל אנימטיבי לקונטיינר המפה
  const mapContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    } as any;
  });

  // פונקציות זום מתוכנתות
  const zoomIn = useCallback(() => {
    const newScale = Math.min(maxScale, scale.value * 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * (scaleDiff / scale.value);
    const newTranslateY = translateY.value - (centerY - translateY.value) * (scaleDiff / scale.value);
    
    scale.value = withTiming(newScale);
    translateX.value = withTiming(newTranslateX);
    translateY.value = withTiming(newTranslateY);
  }, [maxScale, safeScreenWidth, safeScreenHeight]);

  const zoomOut = useCallback(() => {
    const newScale = Math.max(minScale, scale.value / 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * (scaleDiff / scale.value);
    const newTranslateY = translateY.value - (centerY - translateY.value) * (scaleDiff / scale.value);
    
    scale.value = withTiming(newScale);
    translateX.value = withTiming(newTranslateX);
    translateY.value = withTiming(newTranslateY);
  }, [minScale, safeScreenWidth, safeScreenHeight]);

  const resetView = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  }, []);

  // החזרת אובייקט יציב
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
    
    // Styles
    mapContainerStyle,
    
    // Actions
    zoomIn,
    zoomOut,
    resetView,
  }), [
    scale,
    translateX, 
    translateY,
    panGestureHandler,
    pinchGestureHandler,
    doubleTapGestureHandler,
    mapContainerStyle,
    zoomIn,
    zoomOut,
    resetView,
  ]);
}
