import React from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';

/**
 * Overlay גלובלי שמאפשר להזיז/להגדיל טבעת בעריכה מכל מקום על התמונה.
 * עובד עם SharedValues ישירות - UI thread בלבד!
 */
const GlobalHoldEditor = ({
  selectedHold,        // { x, y, r } normalized
  imageWidth,
  imageHeight,
  // SharedValues שיתעדכנו ישירות ב-UI thread
  translateXShared,
  translateYShared,
  radiusShared,
  // commit function רק לסוף מחווה
  commitToState,
}) => {
  const minSide = Math.min(imageWidth, imageHeight);
  
  // ערכי התחלה לmחווה
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startR = useSharedValue(0);

  // pan: הזזת מרכז - UI thread בלבד!
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = (selectedHold?.x ?? 0.5) * imageWidth;
      startY.value = (selectedHold?.y ?? 0.5) * imageHeight;
      translateXShared.value = startX.value;
      translateYShared.value = startY.value;
    })
    .onUpdate((e) => {
      'worklet';
      // עדכון ישיר ל-SharedValues - אין JS!
      const nx = startX.value + e.translationX;
      const ny = startY.value + e.translationY;
      
      // clamp לגבולות התמונה
      const r = radiusShared.value;
      const clampedX = Math.max(r, Math.min(imageWidth - r, nx));
      const clampedY = Math.max(r, Math.min(imageHeight - r, ny));
      
      translateXShared.value = clampedX;
      translateYShared.value = clampedY;
    })
    .onEnd(() => {
      'worklet';
      // commit ל-state בסוף בלבד
      runOnJS(commitToState)();
    });

  // pinch: שינוי רדיוס - UI thread בלבד!  
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      startR.value = (selectedHold?.r ?? 0.05) * minSide;
      radiusShared.value = startR.value;
    })
    .onUpdate((e) => {
      'worklet';
      // עדכון ישיר ל-SharedValues - אין JS!
      const nextR = startR.value * e.scale;
      
      // clamp רדיוס
      const MIN_R = 12;
      const MAX_R = Math.min(imageWidth, imageHeight) / 3;
      const clampedR = Math.max(MIN_R, Math.min(MAX_R, nextR));
      
      radiusShared.value = clampedR;
      
      // clamp מרכז לגבולות החדשים
      const clampedX = Math.max(clampedR, Math.min(imageWidth - clampedR, translateXShared.value));
      const clampedY = Math.max(clampedR, Math.min(imageHeight - clampedR, translateYShared.value));
      
      translateXShared.value = clampedX;
      translateYShared.value = clampedY;
    })
    .onEnd(() => {
      'worklet';
      // commit ל-state בסוף בלבד
      runOnJS(commitToState)();
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  console.log('GlobalHoldEditor render:', {
    selectedHold,
    imageWidth,
    imageHeight,
    minSide
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        // חשוב: overlay במידות התמונה, מעליה, כדי לתפוס מגעים בכל מקום
        style={[styles.overlay, { width: imageWidth, height: imageHeight }]}
        pointerEvents="auto"
      />
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0, top: 0,
    // שקוף לגמרי – רק תופס מגעים
    backgroundColor: 'transparent',
    zIndex: 50,
  },
});

export default GlobalHoldEditor;
