// components/map/InteractiveImage.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type Props = {
  children?: React.ReactNode;
  imageNaturalSize: { width: number; height: number };
  minScale?: number;
  maxScale?: number;
  onTransformChange?: (scale: number, tx: number, ty: number) => void;
  onLayout?: (frameWidth: number, frameHeight: number) => void;
  debug?: boolean;
};

export default function InteractiveImage({
  children,
  imageNaturalSize,
  minScale = 1,
  maxScale = 4,
  onTransformChange,
  onLayout,
  debug = false,
}: Props) {
  // מידות המסגרת (נקבעות על ידי onLayout)
  const [frameDimensions, setFrameDimensions] = useState({ width: 0, height: 0 });

  // Shared values
  const scale = useSharedValue(minScale);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // Shared frame and aspect-fit content sizes
  const frameW = useSharedValue(0);
  const frameH = useSharedValue(0);
  const contentW = useSharedValue(0);
  const contentH = useSharedValue(0);

  // JS-side logger that can be called from worklets via runOnJS
  const log = useCallback((event: string, data?: any) => {
    // Always log for now to debug the issue
    console.log(`[InteractiveImage] ${event}`, data ?? {});
  }, []);

  // לזכור ערכי התחלה של מחווה
  const startScale = useSharedValue(minScale);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // טיפול ב-layout של המסגרת
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrameDimensions({ width, height });

    // Update shared frame sizes
    frameW.value = width;
    frameH.value = height;

    // Compute aspect-fit content size from natural image size
    const iw = Math.max(1, imageNaturalSize?.width || width || 1);
    const ih = Math.max(1, imageNaturalSize?.height || height || 1);
    const imageAR = iw / ih;
    const frameAR = width > 0 && height > 0 ? width / height : imageAR;

    let cw = width;
    let ch = height;
    if (imageAR > frameAR) {
      // Fit by width
      cw = width;
      ch = width / imageAR;
    } else {
      // Fit by height
      ch = height;
      cw = height * imageAR;
    }

    contentW.value = cw;
    contentH.value = ch;

    // Debug layout sizes with more details
    console.log('[InteractiveImage] layout detail', { 
      frame: { width, height }, 
      content: { width: cw, height: ch }, 
      imageNatural: imageNaturalSize,
      aspectRatio: { image: imageAR, frame: frameAR }
    });

    onLayout?.(width, height);
  }, [onLayout, imageNaturalSize?.width, imageNaturalSize?.height, log]);

  // פונקציית גבולות לפי scale נוכחי - גרסה משופרת עם תיקון דחוף
  const getBounds = (s: number) => {
    'worklet';
    const fw = frameW.value;
    const fh = frameH.value;
    const cw = contentW.value;
    const ch = contentH.value;
    
    // גודל התמונה המוגדלת
    const scaledW = cw * s;
    const scaledH = ch * s;
    
    // חישוב גבולות - הגרסה הכי פשוטה ובטוחה
    let minX, maxX, minY, maxY;
    
    if (scaledW <= fw) {
      // התמונה צרה מהמסגרת - מרכוז מלא
      const margin = (fw - scaledW) / 2;
      minX = margin;
      maxX = margin;
    } else {
      // התמונה רחבה מהמסגרת - מניעת חשיפת רקע
      minX = fw - scaledW; // שלילי כאשר התמונה גדולה יותר
      maxX = 0;
    }
    
    if (scaledH <= fh) {
      // התמונה נמוכה מהמסגרת - מרכוז מלא
      const margin = (fh - scaledH) / 2;
      minY = margin;
      maxY = margin;
    } else {
      // התמונה גבוהה מהמסגרת - מניעת חשיפת רקע
      minY = fh - scaledH; // שלילי כאשר התמונה גדולה יותר
      maxY = 0;
    }
    
    console.log('[InteractiveImage] BOUNDS', {
      scale: s,
      frame: { width: fw, height: fh },
      content: { width: cw, height: ch },
      scaledContent: { width: scaledW, height: scaledH },
      bounds: { minX, maxX, minY, maxY }
    });
    
    return { minX, maxX, minY, maxY };
  };

  // Standard bounds based on content size and frame dimensions
  // Ensures proper clipping and prevents seeing background outside image
  // Key points:
  // 1. When scale=1, image is centered in frame
  // 2. When scale>1, panning is limited to keep content within frame
  // 3. minX/minY are negative values when content is larger than frame
  // 4. maxX/maxY adjust for centering when content is smaller than frame

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      runOnJS(log)('pan/begin', { tx: tx.value, ty: ty.value, s: scale.value });
    })
    .onChange((e) => {
      const { minX, maxX, minY, maxY } = getBounds(scale.value);
      const nextX = clamp(startX.value + e.translationX, minX, maxX);
      const nextY = clamp(startY.value + e.translationY, minY, maxY);
      tx.value = nextX;
      ty.value = nextY;
      runOnJS(log)('pan/change', { s: scale.value, dx: e.translationX, dy: e.translationY, tx: nextX, ty: nextY, bounds: { minX, maxX, minY, maxY } });
      
      // Call the transform change callback on each pan change too
      if (onTransformChange) {
        runOnJS(onTransformChange)(scale.value, nextX, nextY);
      }
    })
    .onEnd(() => {
      // ייצוב הקליפינג
      const { minX, maxX, minY, maxY } = getBounds(scale.value);
      tx.value = withTiming(clamp(tx.value, minX, maxX), { duration: 120 });
      ty.value = withTiming(clamp(ty.value, minY, maxY), { duration: 120 });
      runOnJS(log)('pan/end', { s: scale.value, tx: tx.value, ty: ty.value, bounds: { minX, maxX, minY, maxY } });
      
      // דיווח על שינוי טרנספורם
      if (onTransformChange) {
        onTransformChange(scale.value, tx.value, ty.value);
      }
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
      runOnJS(log)('pinch/begin', { s: scale.value });
    })
    .onChange((e) => {
      // יחס זום יחסי למחווה
      const next = clamp(startScale.value * e.scale, minScale, maxScale);
      scale.value = next;

      // בזמן זום עדכן Clamp לפאן
      const { minX, maxX, minY, maxY } = getBounds(next);
      tx.value = clamp(tx.value, minX, maxX);
      ty.value = clamp(ty.value, minY, maxY);
      runOnJS(log)('pinch/change', { s: next, tx: tx.value, ty: ty.value, bounds: { minX, maxX, minY, maxY } });
      
      // Call the transform change callback on each pinch change too
      if (onTransformChange) {
        runOnJS(onTransformChange)(next, tx.value, ty.value);
      }
    })
    .onEnd(() => {
      // ייצוב קטן
      scale.value = withTiming(clamp(scale.value, minScale, maxScale), { duration: 120 });
      const { minX, maxX, minY, maxY } = getBounds(scale.value);
      tx.value = withTiming(clamp(tx.value, minX, maxX), { duration: 120 });
      ty.value = withTiming(clamp(ty.value, minY, maxY), { duration: 120 });
      runOnJS(log)('pinch/end', { s: scale.value, tx: tx.value, ty: ty.value, bounds: { minX, maxX, minY, maxY } });
      
      // דיווח על שינוי טרנספורם
      if (onTransformChange) {
        onTransformChange(scale.value, tx.value, ty.value);
      }
    });

  // דאבל טאפ לאיפוס
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(minScale, { duration: 300 });
      tx.value = withTiming(0, { duration: 300 });
      ty.value = withTiming(0, { duration: 300 });
      runOnJS(log)('doubleTap/reset', { s: minScale, tx: 0, ty: 0 });
      
      // דיווח על שינוי טרנספורם
      if (onTransformChange) {
        onTransformChange(minScale, 0, 0);
      }
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTap, pinch),
    pan
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: '100%',               // מילוי 100% מהמסגרת
      height: '100%',
      transform: [
        { scale: scale.value },      // קודם scale
        { translateX: tx.value },    // אחר כך translateX
        { translateY: ty.value },    // ולבסוף translateY
      ] as const,
    };
  }, [frameDimensions.width, frameDimensions.height]);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <GestureDetector gesture={composed}>
        <Animated.View style={styles.gestureContainer}>
          <Animated.View style={animatedStyle}>
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
    width: '100%',
    height: '100%',
    // ההורה (mapClip) כבר עם overflow:'hidden'
  },
  gestureContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
