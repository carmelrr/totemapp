// components/map/InteractiveImage.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
};

export default function InteractiveImage({
  children,
  imageNaturalSize,
  minScale = 1,
  maxScale = 4,
  onTransformChange,
  onLayout,
}: Props) {
  // מידות המסגרת (נקבעות על ידי onLayout)
  const [frameDimensions, setFrameDimensions] = useState({ width: 0, height: 0 });

  // Shared values
  const scale = useSharedValue(minScale);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // לזכור ערכי התחלה של מחווה
  const startScale = useSharedValue(minScale);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // טיפול ב-layout של המסגרת
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrameDimensions({ width, height });
    onLayout?.(width, height);
  }, [onLayout]);

  // פונקציית גבולות לפי scale נוכחי
  const getBounds = (s: number) => {
    'worklet';
    const { width: frameW, height: frameH } = frameDimensions;
    
    // גודל התמונה המוגדלת
    const scaledW = frameW * s;
    const scaledH = frameH * s;
    
    // חישוב גבולות - מבטיח שלא נראה רקע חוץ
    const minX = Math.min(0, frameW - scaledW);
    const maxX = 0;
    const minY = Math.min(0, frameH - scaledH);
    const maxY = 0;
    
    return { minX, maxX, minY, maxY };
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onChange((e) => {
      const { minX, maxX, minY, maxY } = getBounds(scale.value);
      const nextX = clamp(startX.value + e.translationX, minX, maxX);
      const nextY = clamp(startY.value + e.translationY, minY, maxY);
      tx.value = nextX;
      ty.value = nextY;
    })
    .onEnd(() => {
      // ייצוב הקליפינג
      const { minX, maxX, minY, maxY } = getBounds(scale.value);
      tx.value = withTiming(clamp(tx.value, minX, maxX), { duration: 120 });
      ty.value = withTiming(clamp(ty.value, minY, maxY), { duration: 120 });
      
      // דיווח על שינוי טרנספורם
      if (onTransformChange) {
        onTransformChange(scale.value, tx.value, ty.value);
      }
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onChange((e) => {
      // יחס זום יחסי למחווה
      const next = clamp(startScale.value * e.scale, minScale, maxScale);
      scale.value = next;

      // בזמן זום עדכן Clamp לפאן
      const { minX, maxX, minY, maxY } = getBounds(next);
      tx.value = clamp(tx.value, minX, maxX);
      ty.value = clamp(ty.value, minY, maxY);
    })
    .onEnd(() => {
      // ייצוב קטן
      scale.value = withTiming(clamp(scale.value, minScale, maxScale), { duration: 120 });
      const { minX, maxX, minY, maxY } = getBounds(scale.value);
      tx.value = withTiming(clamp(tx.value, minX, maxX), { duration: 120 });
      ty.value = withTiming(clamp(ty.value, minY, maxY), { duration: 120 });
      
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
