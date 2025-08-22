import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HOLD_COLORS = {
  START: '#FF4444',
  TOP: '#FF4444',
  MID: '#4444FF',
  FOOT: '#FFFF44',
};

const HoldRing = ({
  hold,
  imageWidth,
  imageHeight,
  isSelected,
  onUpdate,
  onSelect,
  showTapes = false,
  showNumber = false,
  holdNumber = 1,
  onResizeStart,
  onResizeEnd,
  // חדש: כשtrue – כל המגעים הולכים ל-Overlay הגלובלי
  globalEditingActive = false,
  // SharedValues חיצוניים למיקום וגודל "חיים" 
  externalTranslateX,
  externalTranslateY,
  externalRadius,
}) => {
  const absoluteX = hold.x * imageWidth;
  const absoluteY = hold.y * imageHeight;
  const absoluteRadius = hold.r * Math.min(imageWidth, imageHeight);

  const translateX = useSharedValue(absoluteX);
  const translateY = useSharedValue(absoluteY);
  const radius = useSharedValue(absoluteRadius);

  // השתמש רק ב-shared values לרינדור - לא ב-state
  const currentRadiusShared = useSharedValue(absoluteRadius);

  useEffect(() => {
    translateX.value = absoluteX;
    translateY.value = absoluteY;
    radius.value = absoluteRadius;
    currentRadiusShared.value = absoluteRadius;
  }, [absoluteX, absoluteY, absoluteRadius]);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const baseRadius = useSharedValue(absoluteRadius);
  const isResizing = useSharedValue(false);

  const clampCenterToBounds = (r) => {
    'worklet';
    const minX = r;
    const maxX = imageWidth - r;
    const minY = r;
    const maxY = imageHeight - r;
    if (translateX.value < minX) translateX.value = minX;
    if (translateX.value > maxX) translateX.value = maxX;
    if (translateY.value < minY) translateY.value = minY;
    if (translateY.value > maxY) translateY.value = maxY;
  };

  const panGesture = Gesture.Pan()
    .enabled(!globalEditingActive)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      if (onSelect) runOnJS(onSelect)();
    })
    .onUpdate((event) => {
      if (isResizing.value) return;
      const nx = startX.value + event.translationX;
      const ny = startY.value + event.translationY;

      const minX = radius.value;
      const maxX = imageWidth - radius.value;
      const minY = radius.value;
      const maxY = imageHeight - radius.value;

      translateX.value = Math.max(minX, Math.min(maxX, nx));
      translateY.value = Math.max(minY, Math.min(maxY, ny));
    })
    .onEnd(() => {
      if (onUpdate) {
        runOnJS(onUpdate)({
          x: translateX.value,
          y: translateY.value,
          r: radius.value,
        });
      }
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(!globalEditingActive)
    .onStart(() => {
      isResizing.value = true;
      baseRadius.value = radius.value;
      if (onResizeStart) runOnJS(onResizeStart)();
    })
    .onUpdate((event) => {
      const MIN_R = 12;
      const MAX_R = Math.min(imageWidth, imageHeight) / 3;
      const nextR = Math.max(MIN_R, Math.min(MAX_R, baseRadius.value * event.scale));

      radius.value = nextR;
      currentRadiusShared.value = nextR; // עדכון חלק יותר
      clampCenterToBounds(nextR);
    })
    .onEnd(() => {
      isResizing.value = false;
      if (onResizeEnd) runOnJS(onResizeEnd)();
      if (onUpdate) {
        runOnJS(onUpdate)({
          x: translateX.value,
          y: translateY.value,
          r: radius.value,
        });
      }
    });

  const composedGestures = Gesture.Simultaneous(panGesture, pinchGesture);

  const positionStyle = useAnimatedStyle(() => ({
    transform: [
      { 
        translateX: (externalTranslateX ? externalTranslateX.value : translateX.value) - 
                   (externalRadius ? externalRadius.value : currentRadiusShared.value)
      },
      { 
        translateY: (externalTranslateY ? externalTranslateY.value : translateY.value) - 
                   (externalRadius ? externalRadius.value : currentRadiusShared.value)
      },
    ],
  }), [externalTranslateX, externalTranslateY, externalRadius]);

  const sizeStyle = useAnimatedStyle(() => ({
    width: (externalRadius ? externalRadius.value : currentRadiusShared.value) * 2,
    height: (externalRadius ? externalRadius.value : currentRadiusShared.value) * 2,
  }), [externalRadius]);

  // Animated style for SVG content
  const svgStyle = useAnimatedStyle(() => ({
    width: (externalRadius ? externalRadius.value : currentRadiusShared.value) * 2,
    height: (externalRadius ? externalRadius.value : currentRadiusShared.value) * 2,
  }), [externalRadius]);

  const holdColor = HOLD_COLORS[hold.type] || '#888888';
  const strokeWidth = isSelected ? 4 : 2;

  // Animated props for SVG Circle
  const circleProps = useAnimatedProps(() => ({
    r: `${Math.max(0, 50 - (strokeWidth / (externalRadius ? externalRadius.value : currentRadiusShared.value)) * 50)}%`,
  }));

  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.View
        style={[styles.container, positionStyle, sizeStyle]}
        pointerEvents="box-none"
      >
        <Animated.View style={svgStyle}>
          <Svg width="100%" height="100%">
            <AnimatedCircle
              cx="50%"
              cy="50%"
              stroke={holdColor}
              strokeWidth={strokeWidth}
              fill="transparent"
              opacity={isSelected ? 1 : 0.85}
              animatedProps={circleProps}
            />
          </Svg>
        </Animated.View>

        {showNumber && (
          <View
            style={[
              styles.numberContainer,
              { backgroundColor: holdColor, top: -8, right: -8 },
            ]}
          >
            <Text style={styles.numberText}>{holdNumber}</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', zIndex: 20 },
  numberContainer: {
    position: 'absolute',
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', zIndex: 21,
  },
  numberText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
});

export default memo(HoldRing);
