import React, { useRef, useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';

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
 * Clamp viewport transforms to keep image in view
 * When image is smaller than screen, center it
 * When image is larger than screen, prevent over-panning
 */
function clampViewport(
  scale: number,
  translateX: number,
  translateY: number,
  screenW: number,
  screenH: number,
  imgW: number,
  imgH: number,
  minScale: number,
  maxScale: number
): { scale: number; translateX: number; translateY: number } {
  'worklet';
  
  // Clamp scale
  const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
  
  // Calculate scaled image dimensions
  const scaledImgW = imgW * clampedScale;
  const scaledImgH = imgH * clampedScale;
  
  let clampedTranslateX = translateX;
  let clampedTranslateY = translateY;
  
  // If image is larger than screen, prevent over-panning
  if (scaledImgW > screenW) {
    const maxTranslateX = 0;
    const minTranslateX = screenW - scaledImgW;
    clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, translateX));
  } else {
    // If image is smaller than screen, center it
    clampedTranslateX = (screenW - scaledImgW) / 2;
  }
  
  if (scaledImgH > screenH) {
    const maxTranslateY = 0;
    const minTranslateY = screenH - scaledImgH;
    clampedTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, translateY));
  } else {
    // If image is smaller than screen, center it
    clampedTranslateY = (screenH - scaledImgH) / 2;
  }
  
  return {
    scale: clampedScale,
    translateX: clampedTranslateX,
    translateY: clampedTranslateY,
  };
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
  minScale = 1,
  maxScale = 4,
  onTransformChange,
}: UseMapTransformsConfig) {
  
  // Safe values to prevent division by zero
  const safeScreenWidth = Math.max(1, screenWidth || 1);
  const safeScreenHeight = Math.max(1, screenHeight || 1);
  const safeImageWidth = Math.max(1, imageWidth || 1);
  const safeImageHeight = Math.max(1, imageHeight || 1);
  const safeMinScale = Math.max(0.1, minScale);
  const safeMaxScale = Math.max(safeMinScale, maxScale);
  
  // Shared values for transforms
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Base values for gestures
  const baseScale = useSharedValue(1);
  const baseTranslateX = useSharedValue(0);
  const baseTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  
  // Flag to track if gesture is active (to skip notifications during gesture)
  const isGestureActive = useSharedValue(false);
  
  // Prevent notification spam
  const lastNotifyRef = useRef<{ scale: number; translateX: number; translateY: number } | null>(null);
  const pendingNotifyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const EPS = 0.01; // Threshold for detecting significant changes
  
  const notifyChange = useCallback((s: number, x: number, y: number) => {
    const prev = lastNotifyRef.current;
    
    // Check if values changed significantly
    if (prev) {
      const near = (a: number, b: number) => Math.abs(a - b) < EPS;
      if (near(prev.scale, s) && near(prev.translateX, x) && near(prev.translateY, y)) {
        return;
      }
    }
    
    lastNotifyRef.current = { scale: s, translateX: x, translateY: y };
    onTransformChange?.({ scale: s, translateX: x, translateY: y });
  }, [onTransformChange]);
  
  // Debounced notification for during gestures - only notify after gesture ends or pauses
  const debouncedNotify = useCallback((s: number, x: number, y: number) => {
    if (pendingNotifyRef.current) {
      clearTimeout(pendingNotifyRef.current);
    }
    pendingNotifyRef.current = setTimeout(() => {
      notifyChange(s, x, y);
      pendingNotifyRef.current = null;
    }, 100);
  }, [notifyChange]);

  // Track dimensions for detecting changes and applying initial centering
  const prevDimensionsRef = useRef({ imgW: 0, imgH: 0, screenW: 0, screenH: 0 });

  // Apply initial centering when dimensions are available or change
  React.useEffect(() => {
    const prev = prevDimensionsRef.current;
    const dimensionsChanged = 
      prev.imgW !== safeImageWidth || 
      prev.imgH !== safeImageHeight ||
      prev.screenW !== safeScreenWidth ||
      prev.screenH !== safeScreenHeight;
    
    if (dimensionsChanged && safeImageWidth > 1 && safeImageHeight > 1 && safeScreenWidth > 1 && safeScreenHeight > 1) {
      prevDimensionsRef.current = { 
        imgW: safeImageWidth, 
        imgH: safeImageHeight, 
        screenW: safeScreenWidth, 
        screenH: safeScreenHeight 
      };
      
      // Calculate initial centered position
      const initialCentered = clampViewport(
        1, 0, 0,
        safeScreenWidth,
        safeScreenHeight,
        safeImageWidth,
        safeImageHeight,
        safeMinScale,
        safeMaxScale
      );
      translateX.value = initialCentered.translateX;
      translateY.value = initialCentered.translateY;
      scale.value = 1;
      notifyChange(1, initialCentered.translateX, initialCentered.translateY);
    }
  }, [safeImageWidth, safeImageHeight, safeScreenWidth, safeScreenHeight, safeMinScale, safeMaxScale, notifyChange]);

  // Pan gesture
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .minDistance(5)
      .onStart(() => {
        'worklet';
        // Cancel any ongoing spring animations for immediate response
        translateX.value = translateX.value;
        translateY.value = translateY.value;
        
        baseTranslateX.value = translateX.value;
        baseTranslateY.value = translateY.value;
        isGestureActive.value = true;
      })
      .onUpdate((event) => {
        'worklet';
        const newX = baseTranslateX.value + event.translationX;
        const newY = baseTranslateY.value + event.translationY;
        
        const clamped = clampViewport(
          scale.value, newX, newY,
          safeScreenWidth, safeScreenHeight,
          safeImageWidth, safeImageHeight,
          safeMinScale, safeMaxScale
        );
        
        translateX.value = clamped.translateX;
        translateY.value = clamped.translateY;
        
        // Debounced notification during pan (won't block UI thread)
        runOnJS(debouncedNotify)(scale.value, clamped.translateX, clamped.translateY);
      })
      .onEnd((event) => {
        'worklet';
        isGestureActive.value = false;
        
        // Apply velocity for momentum (reduced for smoother feel)
        const velocityX = event.velocityX * 0.08;
        const velocityY = event.velocityY * 0.08;
        
        const projectedX = translateX.value + velocityX;
        const projectedY = translateY.value + velocityY;
        
        const clamped = clampViewport(
          scale.value, projectedX, projectedY,
          safeScreenWidth, safeScreenHeight,
          safeImageWidth, safeImageHeight,
          safeMinScale, safeMaxScale
        );
        
        // Gentler spring for smoother ending
        const springConfig = { damping: 22, stiffness: 180, mass: 0.8 };
        translateX.value = withSpring(clamped.translateX, springConfig);
        translateY.value = withSpring(clamped.translateY, springConfig);
        
        // Immediate notification at end
        runOnJS(notifyChange)(scale.value, clamped.translateX, clamped.translateY);
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange, debouncedNotify]
  );

  // Pinch gesture - simplified for maximum smoothness
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart((event) => {
        'worklet';
        // Cancel any ongoing spring animations for immediate response
        scale.value = scale.value;
        translateX.value = translateX.value;
        translateY.value = translateY.value;
        
        baseScale.value = scale.value;
        baseTranslateX.value = translateX.value;
        baseTranslateY.value = translateY.value;
        focalX.value = event.focalX;
        focalY.value = event.focalY;
        isGestureActive.value = true;
      })
      .onUpdate((event) => {
        'worklet';
        const rawScale = baseScale.value * (event.scale ?? 1);
        const clampedScale = Math.max(safeMinScale, Math.min(safeMaxScale, rawScale));
        
        // Calculate image coordinates of focal point using base values
        // This keeps the focal point stationary during zoom
        const fxImg = (focalX.value - baseTranslateX.value) / baseScale.value;
        const fyImg = (focalY.value - baseTranslateY.value) / baseScale.value;
        
        // Calculate new translation to keep the original focal point in place on screen
        const newTranslateX = focalX.value - fxImg * clampedScale;
        const newTranslateY = focalY.value - fyImg * clampedScale;
        
        const clamped = clampViewport(
          clampedScale, newTranslateX, newTranslateY,
          safeScreenWidth, safeScreenHeight,
          safeImageWidth, safeImageHeight,
          safeMinScale, safeMaxScale
        );
        
        scale.value = clamped.scale;
        translateX.value = clamped.translateX;
        translateY.value = clamped.translateY;
        
        // Debounced notification during pinch (won't block UI thread)
        runOnJS(debouncedNotify)(clamped.scale, clamped.translateX, clamped.translateY);
      })
      .onEnd(() => {
        'worklet';
        isGestureActive.value = false;
        
        const clamped = clampViewport(
          scale.value, translateX.value, translateY.value,
          safeScreenWidth, safeScreenHeight,
          safeImageWidth, safeImageHeight,
          safeMinScale, safeMaxScale
        );
        
        // Gentler spring for smoother ending
        const springConfig = { damping: 20, stiffness: 100, mass: 1 };
        scale.value = withSpring(clamped.scale, springConfig);
        translateX.value = withSpring(clamped.translateX, springConfig);
        translateY.value = withSpring(clamped.translateY, springConfig);
        
        // Immediate notification at end
        runOnJS(notifyChange)(clamped.scale, clamped.translateX, clamped.translateY);
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange, debouncedNotify]
  );

  // Double tap gesture
  const doubleTapGesture = useMemo(() =>
    Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        'worklet';
        const currentScale = scale.value;
        const targetScale = currentScale < 2 ? 2 : 1;
        const springConfig = { damping: 18, stiffness: 130, mass: 0.9 };
        
        if (targetScale === 1) {
          // Reset to initial centered position
          const centered = clampViewport(
            1, 0, 0,
            safeScreenWidth, safeScreenHeight,
            safeImageWidth, safeImageHeight,
            safeMinScale, safeMaxScale
          );
          
          scale.value = withSpring(1, springConfig);
          translateX.value = withSpring(centered.translateX, springConfig);
          translateY.value = withSpring(centered.translateY, springConfig);
          
          runOnJS(notifyChange)(1, centered.translateX, centered.translateY);
        } else {
          // Zoom in around tap point
          const fx = event.x;
          const fy = event.y;
          
          // Calculate image coordinates of tap point
          const imgX = (fx - translateX.value) / currentScale;
          const imgY = (fy - translateY.value) / currentScale;
          
          // Calculate new translation to keep tap point in place
          const newTranslateX = fx - imgX * targetScale;
          const newTranslateY = fy - imgY * targetScale;
          
          const clamped = clampViewport(
            targetScale, newTranslateX, newTranslateY,
            safeScreenWidth, safeScreenHeight,
            safeImageWidth, safeImageHeight,
            safeMinScale, safeMaxScale
          );
          
          scale.value = withSpring(clamped.scale, springConfig);
          translateX.value = withSpring(clamped.translateX, springConfig);
          translateY.value = withSpring(clamped.translateY, springConfig);
          
          runOnJS(notifyChange)(clamped.scale, clamped.translateX, clamped.translateY);
        }
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange]
  );

  // Compose all gestures
  const composedGesture = useMemo(() => 
    Gesture.Race(
      doubleTapGesture,
      Gesture.Simultaneous(panGesture, pinchGesture)
    ),
    [panGesture, pinchGesture, doubleTapGesture]
  );

  // Animated style for map container
  // We use scale-first transform order. The translation values represent where the 
  // image's top-left corner should be in screen coordinates. After scaling from center,
  // we compensate to position the image correctly.
  const mapContainerStyle = useAnimatedStyle(() => {
    const s = scale.value;
    const imgW = safeImageWidth;
    const imgH = safeImageHeight;
    
    // When scaling from center, the center stays in place.
    // Original center: (imgW/2, imgH/2)
    // After scale: center is still at (imgW/2, imgH/2) but image extends from:
    //   left: imgW/2 - (imgW*s)/2 = imgW*(1-s)/2
    //   top: imgH/2 - (imgH*s)/2 = imgH*(1-s)/2
    // We want top-left to be at (translateX, translateY), so we need to add compensation
    const scaleCompensationX = imgW * (1 - s) / 2;
    const scaleCompensationY = imgH * (1 - s) / 2;
    
    return {
      transform: [
        { scale: s },
        { translateX: (translateX.value - scaleCompensationX) / s },
        { translateY: (translateY.value - scaleCompensationY) / s },
      ],
    } as any;
  });

  // Reset view function
  const resetView = useCallback(() => {
    const centered = clampViewport(
      1, 0, 0,
      safeScreenWidth, safeScreenHeight,
      safeImageWidth, safeImageHeight,
      safeMinScale, safeMaxScale
    );
    const springConfig = { damping: 15, stiffness: 150 };
    scale.value = withSpring(1, springConfig);
    translateX.value = withSpring(centered.translateX, springConfig);
    translateY.value = withSpring(centered.translateY, springConfig);
    notifyChange(1, centered.translateX, centered.translateY);
  }, [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange]);

  // Zoom in function
  const zoomIn = useCallback(() => {
    const currentScale = scale.value || 1;
    const newScale = Math.min(safeMaxScale, currentScale * 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    // Calculate image coordinates at center
    const imgX = (centerX - translateX.value) / currentScale;
    const imgY = (centerY - translateY.value) / currentScale;
    
    // Calculate new translation to keep center
    const newTranslateX = centerX - imgX * newScale;
    const newTranslateY = centerY - imgY * newScale;
    
    const clamped = clampViewport(
      newScale, newTranslateX, newTranslateY,
      safeScreenWidth, safeScreenHeight,
      safeImageWidth, safeImageHeight,
      safeMinScale, safeMaxScale
    );
    
    const springConfig = { damping: 15, stiffness: 150 };
    scale.value = withSpring(clamped.scale, springConfig);
    translateX.value = withSpring(clamped.translateX, springConfig);
    translateY.value = withSpring(clamped.translateY, springConfig);
    notifyChange(clamped.scale, clamped.translateX, clamped.translateY);
  }, [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange]);

  // Zoom out function
  const zoomOut = useCallback(() => {
    const currentScale = scale.value || 1;
    const newScale = Math.max(safeMinScale, currentScale / 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    // Calculate image coordinates at center
    const imgX = (centerX - translateX.value) / currentScale;
    const imgY = (centerY - translateY.value) / currentScale;
    
    // Calculate new translation to keep center
    const newTranslateX = centerX - imgX * newScale;
    const newTranslateY = centerY - imgY * newScale;
    
    const clamped = clampViewport(
      newScale, newTranslateX, newTranslateY,
      safeScreenWidth, safeScreenHeight,
      safeImageWidth, safeImageHeight,
      safeMinScale, safeMaxScale
    );
    
    const springConfig = { damping: 15, stiffness: 150 };
    scale.value = withSpring(clamped.scale, springConfig);
    translateX.value = withSpring(clamped.translateX, springConfig);
    translateY.value = withSpring(clamped.translateY, springConfig);
    notifyChange(clamped.scale, clamped.translateX, clamped.translateY);
  }, [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange]);

  // Return stable object
  return useMemo(() => ({
    // Shared values
    scale,
    translateX,
    translateY,
    
    // Gesture handlers
    panGesture,
    pinchGesture,
    doubleTapGesture,
    composedGesture,
    
    // Styles
    mapContainerStyle,
    
    // Actions
    zoomIn,
    zoomOut,
    resetView,
    
    // Config
    minScale: safeMinScale,
    maxScale: safeMaxScale,
  }), [
    scale,
    translateX, 
    translateY,
    panGesture,
    pinchGesture,
    doubleTapGesture,
    composedGesture,
    mapContainerStyle,
    zoomIn,
    zoomOut,
    resetView,
    safeMinScale,
    safeMaxScale,
  ]);
}
