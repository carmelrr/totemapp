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
  /** Allow panning even when image is smaller than screen (zoom = 1) */
  allowPanAtMinZoom?: boolean;
  /** Initial vertical position when image is smaller than screen: 'top', 'center', or 'bottom' */
  initialVerticalPosition?: 'top' | 'center' | 'bottom';
  /** Bottom inset (in pixels) to exclude from centering calculations (e.g., panel height) */
  centeringBottomInset?: number;
  onTransformChange?: (transform: {
    scale: number;
    translateX: number;
    translateY: number;
  }) => void;
}

/**
 * Clamp viewport transforms to keep image in view
 * With transform order [translate, scale]: scale happens from image center
 * Screen position = (imagePos - imgCenter) * scale + imgCenter + translate
 * 
 * For left edge (imagePos = 0): screenPos = -imgW/2 * scale + imgW/2 + translate
 * For right edge (imagePos = imgW): screenPos = imgW/2 * scale + imgW/2 + translate
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
  maxScale: number,
  allowPanAtMinZoom: boolean = true // Default true for better UX - allow panning even when not zoomed
): { scale: number; translateX: number; translateY: number } {
  'worklet';
  
  // Clamp scale
  const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
  
  // Image center
  const imgCenterX = imgW / 2;
  const imgCenterY = imgH / 2;
  
  // Calculate where image edges appear on screen:
  // Left edge (imageX=0): screenX = (0 - imgCenterX) * scale + imgCenterX + translateX
  //                      = imgCenterX * (1 - scale) + translateX
  // Right edge (imageX=imgW): screenX = (imgW - imgCenterX) * scale + imgCenterX + translateX
  //                          = imgCenterX * scale + imgCenterX + translateX
  //                          = imgCenterX * (1 + scale) + translateX
  
  const leftEdge = imgCenterX * (1 - clampedScale) + translateX;
  const rightEdge = imgCenterX * (1 + clampedScale) + translateX;
  const scaledWidth = rightEdge - leftEdge; // = imgW * scale
  
  const topEdge = imgCenterY * (1 - clampedScale) + translateY;
  const bottomEdge = imgCenterY * (1 + clampedScale) + translateY;
  const scaledHeight = bottomEdge - topEdge; // = imgH * scale
  
  let clampedTranslateX = translateX;
  let clampedTranslateY = translateY;
  
  // If scaled image is larger than screen, keep edges within bounds
  if (scaledWidth > screenW) {
    // Don't let left edge go past screen left (leftEdge <= 0)
    // leftEdge = imgCenterX * (1 - scale) + translateX <= 0
    // translateX <= imgCenterX * (scale - 1)
    const maxTranslateX = imgCenterX * (clampedScale - 1);
    
    // Don't let right edge go before screen right (rightEdge >= screenW)
    // rightEdge = imgCenterX * (1 + scale) + translateX >= screenW
    // translateX >= screenW - imgCenterX * (1 + scale)
    const minTranslateX = screenW - imgCenterX * (1 + clampedScale);
    
    clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, translateX));
  } else if (allowPanAtMinZoom) {
    // Allow panning, but keep image at least partially visible
    // Don't let image go completely off screen - keep at least 50% visible
    const margin = scaledWidth * 0.25;
    const maxTranslateX = screenW - margin - imgCenterX * (1 - clampedScale);
    const minTranslateX = margin - imgCenterX * (1 + clampedScale);
    clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, translateX));
  } else {
    // Center the image horizontally (legacy behavior)
    clampedTranslateX = (screenW - imgW) / 2;
  }
  
  if (scaledHeight > screenH) {
    const maxTranslateY = imgCenterY * (clampedScale - 1);
    const minTranslateY = screenH - imgCenterY * (1 + clampedScale);
    clampedTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, translateY));
  } else if (allowPanAtMinZoom) {
    // Allow vertical panning too, keep at least 50% visible
    const margin = scaledHeight * 0.25;
    const maxTranslateY = screenH - margin - imgCenterY * (1 - clampedScale);
    const minTranslateY = margin - imgCenterY * (1 + clampedScale);
    clampedTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, translateY));
  } else {
    // Center the image vertically (legacy behavior)
    clampedTranslateY = (screenH - imgH) / 2;
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
  maxScale = 8,
  allowPanAtMinZoom = true, // Default to true for better UX
  initialVerticalPosition = 'top', // Default to top for better visibility with bottom panels
  centeringBottomInset = 0,
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
  // Stored initial vertical position for double-tap reset
  const initialTranslateYValue = useSharedValue(0);
  // Store IMAGE coordinates of focal point (not screen coordinates)
  const focalImageX = useSharedValue(0);
  const focalImageY = useSharedValue(0);
  
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

  // Cleanup pending timeout on unmount to prevent memory leaks and touch issues
  React.useEffect(() => {
    return () => {
      if (pendingNotifyRef.current) {
        clearTimeout(pendingNotifyRef.current);
        pendingNotifyRef.current = null;
      }
    };
  }, []);

  // Track dimensions for detecting changes and applying initial centering
  const prevDimensionsRef = useRef({ imgW: 0, imgH: 0, screenW: 0, screenH: 0, bottomInset: 0 });
  const hasInitializedRef = useRef(false);

  // Apply initial centering when dimensions are available or change
  React.useEffect(() => {
    const prev = prevDimensionsRef.current;
    const imageDimsChanged = 
      prev.imgW !== safeImageWidth || 
      prev.imgH !== safeImageHeight;
    const screenDimsChanged =
      prev.screenW !== safeScreenWidth ||
      prev.screenH !== safeScreenHeight;
    const bottomInsetChanged = prev.bottomInset !== centeringBottomInset;
    const dimensionsChanged = imageDimsChanged || screenDimsChanged || bottomInsetChanged;
    
    if (dimensionsChanged && safeImageWidth > 1 && safeImageHeight > 1 && safeScreenWidth > 1 && safeScreenHeight > 1) {
      prevDimensionsRef.current = { 
        imgW: safeImageWidth, 
        imgH: safeImageHeight, 
        screenW: safeScreenWidth, 
        screenH: safeScreenHeight,
        bottomInset: centeringBottomInset,
      };

      // If already initialized and the user is zoomed in, skip re-centering
      // AND skip re-clamping. This prevents the map from shifting when the
      // bottom panel is dragged, which changes the container height and would
      // otherwise force translateY to a new clamped value.
      // We still notify the parent so it can recalculate viewport bounds
      // with the new container dimensions.
      if (hasInitializedRef.current && scale.value > 1.05) {
        lastNotifyRef.current = null; // Clear dedup cache to force notification
        notifyChange(scale.value, translateX.value, translateY.value);
        return;
      }

      hasInitializedRef.current = true;
      
      // Calculate initial position
      const initialCentered = clampViewport(
        1, 0, 0,
        safeScreenWidth,
        safeScreenHeight,
        safeImageWidth,
        safeImageHeight,
        safeMinScale,
        safeMaxScale
      );
      
      // Adjust vertical position based on initialVerticalPosition setting
      let initialTranslateY = initialCentered.translateY;
      if (safeImageHeight < safeScreenHeight) {
        // Image is smaller than screen, we can position it
        const visibleHeight = safeScreenHeight - centeringBottomInset;
        
        if (initialVerticalPosition === 'top') {
          initialTranslateY = 0;
        } else if (initialVerticalPosition === 'bottom') {
          initialTranslateY = safeScreenHeight - safeImageHeight;
        } else {
          // 'center' - center within visible area (above the panel)
          initialTranslateY = (visibleHeight - safeImageHeight) / 2;
        }
      }
      
      translateX.value = initialCentered.translateX;
      translateY.value = initialTranslateY;
      initialTranslateYValue.value = initialTranslateY;
      scale.value = 1;
      notifyChange(1, initialCentered.translateX, initialTranslateY);
    }
  }, [safeImageWidth, safeImageHeight, safeScreenWidth, safeScreenHeight, safeMinScale, safeMaxScale, notifyChange, initialVerticalPosition, centeringBottomInset]);

  // Pan gesture - with low minDistance for more responsive movement
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .minDistance(2)
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
        const velocityX = event.velocityX * 0.12;
        const velocityY = event.velocityY * 0.12;
        
        const projectedX = translateX.value + velocityX;
        const projectedY = translateY.value + velocityY;
        
        const clamped = clampViewport(
          scale.value, projectedX, projectedY,
          safeScreenWidth, safeScreenHeight,
          safeImageWidth, safeImageHeight,
          safeMinScale, safeMaxScale
        );
        
        // Smoother spring for momentum - higher damping reduces oscillation
        const springConfig = { damping: 28, stiffness: 120, mass: 0.6 };
        translateX.value = withSpring(clamped.translateX, springConfig);
        translateY.value = withSpring(clamped.translateY, springConfig);
        
        // Immediate notification at end
        runOnJS(notifyChange)(scale.value, clamped.translateX, clamped.translateY);
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange, debouncedNotify]
  );

  // Pinch gesture - zoom centered on the point between your fingers
  // With transform order [scale, translateX/scale, translateY/scale]:
  // Screen position = (imagePos - imgCenter) * scale + imgCenter + translate
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart((event) => {
        'worklet';
        // Cancel any ongoing spring animations
        scale.value = scale.value;
        translateX.value = translateX.value;
        translateY.value = translateY.value;
        
        baseScale.value = scale.value;
        isGestureActive.value = true;
      })
      .onUpdate((event) => {
        'worklet';
        const rawScale = baseScale.value * (event.scale ?? 1);
        const newScale = Math.max(safeMinScale, Math.min(safeMaxScale, rawScale));
        const oldScale = scale.value;
        
        // Focal point on screen
        const focalX = event.focalX;
        const focalY = event.focalY;
        
        // Image dimensions
        const imgCenterX = safeImageWidth / 2;
        const imgCenterY = safeImageHeight / 2;
        
        // Current transform: screenPos = (imagePos - imgCenter) * oldScale + imgCenter + translate
        // Find image position under focal point:
        // imagePos = (focalX - imgCenter - translateX) / oldScale + imgCenter
        const imageX = (focalX - imgCenterX - translateX.value) / oldScale + imgCenterX;
        const imageY = (focalY - imgCenterY - translateY.value) / oldScale + imgCenterY;
        
        // New transform should put same image point at same screen position:
        // focalX = (imageX - imgCenter) * newScale + imgCenter + newTranslateX
        // newTranslateX = focalX - (imageX - imgCenter) * newScale - imgCenter
        const newTranslateX = focalX - (imageX - imgCenterX) * newScale - imgCenterX;
        const newTranslateY = focalY - (imageY - imgCenterY) * newScale - imgCenterY;
        
        const clamped = clampViewport(
          newScale, newTranslateX, newTranslateY,
          safeScreenWidth, safeScreenHeight,
          safeImageWidth, safeImageHeight,
          safeMinScale, safeMaxScale
        );
        
        scale.value = clamped.scale;
        translateX.value = clamped.translateX;
        translateY.value = clamped.translateY;
        
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
        
        // Smoother spring for pinch ending - minimal bounce
        const springConfig = { damping: 30, stiffness: 90, mass: 0.5 };
        scale.value = withSpring(clamped.scale, springConfig);
        translateX.value = withSpring(clamped.translateX, springConfig);
        translateY.value = withSpring(clamped.translateY, springConfig);
        
        // Immediate notification at end
        runOnJS(notifyChange)(clamped.scale, clamped.translateX, clamped.translateY);
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange, debouncedNotify]
  );

  // Double tap gesture - zooms to 3x for better view with higher max zoom
  const doubleTapGesture = useMemo(() =>
    Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        'worklet';
        const currentScale = scale.value;
        // Zoom to 3x for better detail, reset if already zoomed
        const targetScale = currentScale < 2.5 ? 3 : 1;
        const springConfig = { damping: 24, stiffness: 110, mass: 0.7 };
        
        if (targetScale === 1) {
          // Reset to initial centered position (same as on mount)
          const centered = clampViewport(
            1, 0, 0,
            safeScreenWidth, safeScreenHeight,
            safeImageWidth, safeImageHeight,
            safeMinScale, safeMaxScale
          );
          const resetTranslateY = initialTranslateYValue.value;
          
          scale.value = withSpring(1, springConfig);
          translateX.value = withSpring(centered.translateX, springConfig);
          translateY.value = withSpring(resetTranslateY, springConfig);
          
          runOnJS(notifyChange)(1, centered.translateX, resetTranslateY);
        } else {
          // Zoom in around tap point
          const fx = event.x;
          const fy = event.y;
          
          // Image center for transform calculations
          const imgCenterX = safeImageWidth / 2;
          const imgCenterY = safeImageHeight / 2;
          
          // Calculate image coordinates of tap point
          // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
          // To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
          const imgX = (fx - imgCenterX - translateX.value) / currentScale + imgCenterX;
          const imgY = (fy - imgCenterY - translateY.value) / currentScale + imgCenterY;
          
          // Calculate new translation to keep tap point in place at new scale
          // screenPos = (imagePos - imgCenter) * newScale + imgCenter + newTranslate
          // newTranslate = screenPos - (imagePos - imgCenter) * newScale - imgCenter
          const newTranslateX = fx - (imgX - imgCenterX) * targetScale - imgCenterX;
          const newTranslateY = fy - (imgY - imgCenterY) * targetScale - imgCenterY;
          
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
  // Transform order [translate, scale]: translate moves the image, then scale from center
  // This means screen position = (imagePos - imgCenter) * scale + imgCenter + translate
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
  const resetView = useCallback(() => {
    const centered = clampViewport(
      1, 0, 0,
      safeScreenWidth, safeScreenHeight,
      safeImageWidth, safeImageHeight,
      safeMinScale, safeMaxScale
    );
    const resetTranslateY = initialTranslateYValue.value;
    const springConfig = { damping: 15, stiffness: 150 };
    scale.value = withSpring(1, springConfig);
    translateX.value = withSpring(centered.translateX, springConfig);
    translateY.value = withSpring(resetTranslateY, springConfig);
    notifyChange(1, centered.translateX, resetTranslateY);
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

  // Set zoom to specific scale, centered on current view center
  const setZoomToCenter = useCallback((newScale: number) => {
    const currentScale = scale.value || 1;
    const clampedNewScale = Math.max(safeMinScale, Math.min(safeMaxScale, newScale));
    
    // Center of the current view (where user is looking)
    const viewCenterX = safeScreenWidth / 2;
    const viewCenterY = safeScreenHeight / 2;
    
    // Image center
    const imgCenterX = safeImageWidth / 2;
    const imgCenterY = safeImageHeight / 2;
    
    // Find the image point currently at view center
    // With transform [translate, scale]: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
    // Solving for imagePos: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
    const imageX = (viewCenterX - imgCenterX - translateX.value) / currentScale + imgCenterX;
    const imageY = (viewCenterY - imgCenterY - translateY.value) / currentScale + imgCenterY;
    
    // Calculate new translation to keep same image point at view center
    // screenPos = (imagePos - imgCenter) * newScale + imgCenter + newTranslate
    // newTranslate = screenPos - (imagePos - imgCenter) * newScale - imgCenter
    const newTranslateX = viewCenterX - (imageX - imgCenterX) * clampedNewScale - imgCenterX;
    const newTranslateY = viewCenterY - (imageY - imgCenterY) * clampedNewScale - imgCenterY;
    
    const clamped = clampViewport(
      clampedNewScale, newTranslateX, newTranslateY,
      safeScreenWidth, safeScreenHeight,
      safeImageWidth, safeImageHeight,
      safeMinScale, safeMaxScale
    );
    
    // Use direct assignment without animation for smoother slider experience
    scale.value = clamped.scale;
    translateX.value = clamped.translateX;
    translateY.value = clamped.translateY;
    notifyChange(clamped.scale, clamped.translateX, clamped.translateY);
  }, [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale, notifyChange]);

  /**
   * Zoom and pan to fit a rectangle (in image/room coordinates) within the viewport.
   * The rect is { x, y, width, height } in the room coordinate system.
   * Image dimensions map 1:1 to room dimensions via the SVG viewBox.
   */
  const zoomToRect = useCallback((rect: { x: number; y: number; width: number; height: number }, padding: number = 0.1, options?: { verticalAlign?: 'top' | 'center' }) => {
    if (safeImageWidth === 0 || safeImageHeight === 0) return;
    
    const verticalAlign = options?.verticalAlign ?? 'center';
    
    // rect is already in image pixel coordinates (caller converts from room coords)
    const rectCenterX = rect.x + rect.width / 2;
    const rectTopY = rect.y;
    const rectCenterY = rect.y + rect.height / 2;
    
    // Calculate scale to fit the rect in the viewport (with padding)
    const paddingFactor = 1 + padding;
    const scaleX = safeScreenWidth / (rect.width * paddingFactor);
    const scaleY = safeScreenHeight / (rect.height * paddingFactor);
    const targetScale = Math.min(scaleX, scaleY, safeMaxScale);
    const clampedScale = Math.max(safeMinScale, targetScale);
    
    // Image center
    const imgCenterX = safeImageWidth / 2;
    const imgCenterY = safeImageHeight / 2;
    
    // Calculate translation to position the rect in the viewport
    // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
    // translate = targetScreenPos - (imagePos - imgCenter) * scale - imgCenter
    const viewCenterX = safeScreenWidth / 2;
    const newTranslateX = viewCenterX - (rectCenterX - imgCenterX) * clampedScale - imgCenterX;
    
    let newTranslateY: number;
    if (verticalAlign === 'top') {
      // Position the top edge of the rect near the top of the screen
      // with a small top margin (e.g. 20px below screen top for header clearance)
      const topMargin = 20;
      // We want rectTopY to appear at topMargin on screen:
      // topMargin = (rectTopY - imgCenterY) * scale + imgCenterY + translateY
      // translateY = topMargin - (rectTopY - imgCenterY) * scale - imgCenterY
      newTranslateY = topMargin - (rectTopY - imgCenterY) * clampedScale - imgCenterY;
    } else {
      // Center vertically (original behavior)
      const viewCenterY = safeScreenHeight / 2;
      newTranslateY = viewCenterY - (rectCenterY - imgCenterY) * clampedScale - imgCenterY;
    }
    
    const clamped = clampViewport(
      clampedScale, newTranslateX, newTranslateY,
      safeScreenWidth, safeScreenHeight,
      safeImageWidth, safeImageHeight,
      safeMinScale, safeMaxScale
    );
    
    const springConfig = { damping: 20, stiffness: 120 };
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
    setZoomToCenter,
    zoomToRect,
    
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
    setZoomToCenter,
    zoomToRect,
    safeMinScale,
    safeMaxScale,
  ]);
}
