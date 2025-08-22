import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PanGestureHandler, PinchGestureHandler, State, Directions } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const HOLD_COLORS = {
  START: '#FF4444',
  TOP: '#FF4444', 
  MID: '#4444FF',
  FOOT: '#FFFF44'
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
  holdNumber = 1
}) => {
  // Calculate absolute position from normalized coordinates
  const absoluteX = hold.x * imageWidth;
  const absoluteY = hold.y * imageHeight;
  const absoluteRadius = hold.r * Math.min(imageWidth, imageHeight);
  
  const translateX = useSharedValue(absoluteX);
  const translateY = useSharedValue(absoluteY);
  const radius = useSharedValue(absoluteRadius);
  
  const [currentRadius, setCurrentRadius] = useState(absoluteRadius);

  console.log('HoldRing render:', { 
    hold, 
    imageWidth, 
    imageHeight, 
    absoluteX, 
    absoluteY, 
    absoluteRadius,
    currentRadius
  });

  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      console.log('Pan started');
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
      if (onSelect) {
        runOnJS(onSelect)();
      }
    },
    onActive: (event, ctx) => {
      console.log('Pan active, translation:', event.translationX, event.translationY);
      const nx = ctx.startX + event.translationX;
      const ny = ctx.startY + event.translationY;
      // גבולות – שהטבעת לא תצא מהתמונה
      const minX = radius.value;
      const maxX = imageWidth - radius.value;
      const minY = radius.value;
      const maxY = imageHeight - radius.value;
      translateX.value = Math.max(minX, Math.min(maxX, nx));
      translateY.value = Math.max(minY, Math.min(maxY, ny));
    },
    onEnd: () => {
      console.log('Pan ended');
      if (onUpdate) {
        runOnJS(onUpdate)({
          x: translateX.value,
          y: translateY.value,
          r: radius.value
        });
      }
    },
  }, [], false); // Disable native driver

  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => { 
      console.log('Pinch started');
      ctx.baseR = radius.value; 
    },
    onActive: (event, ctx) => {
      console.log('Pinch active, scale:', event.scale);
      const MIN_R = 12;
      const MAX_R = Math.min(imageWidth, imageHeight) / 3;
      const newR = Math.max(MIN_R, Math.min(MAX_R, ctx.baseR * event.scale));
      radius.value = newR;
      runOnJS(setCurrentRadius)(newR); // Update state to trigger re-render
      console.log('New radius:', newR);
    },
    onEnd: () => {
      console.log('Pinch ended');
      if (onUpdate) {
        runOnJS(onUpdate)({
          x: translateX.value,
          y: translateY.value,
          r: radius.value
        });
      }
    },
  }, [], false); // Disable native driver

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value - radius.value },
        { translateY: translateY.value - radius.value },
      ],
    };
  }, [], false); // Disable native driver

  const animatedSvgStyle = useAnimatedStyle(() => {
    return {
      width: radius.value * 2,
      height: radius.value * 2,
    };
  }, [], false);

  const holdColor = HOLD_COLORS[hold.type] || '#888888';
  const strokeWidth = isSelected ? 4 : 2;

  return (
    <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
      <Animated.View>
        <PanGestureHandler onGestureEvent={panGestureHandler}>
          <Animated.View style={[styles.container, animatedStyle, { 
            backgroundColor: 'rgba(255, 0, 0, 0.2)', // Debug background to see if ring is positioned
          }]}>
            <Svg width={currentRadius * 2} height={currentRadius * 2}>
              {/* Main hold ring */}
              <Circle
                cx={currentRadius}
                cy={currentRadius}
                r={currentRadius - strokeWidth}
                stroke={holdColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                opacity={isSelected ? 1 : 0.8}
              />
              
              {/* Tape rings */}
              {showTapes && (
                <>
                  <Circle
                    cx={currentRadius}
                    cy={currentRadius}
                    r={currentRadius - strokeWidth - 5}
                    stroke={holdColor}
                    strokeWidth={1}
                    fill="transparent"
                    opacity={0.6}
                  />
                  <Circle
                    cx={currentRadius}
                    cy={currentRadius}
                    r={currentRadius - strokeWidth - 10}
                    stroke={holdColor}
                    strokeWidth={1}
                    fill="transparent"
                    opacity={0.4}
                  />
                </>
              )}
            </Svg>
            
            {/* Hold number */}
            {showNumber && (
              <View style={[styles.numberContainer, { 
                backgroundColor: holdColor,
                top: -8,
                right: -8
              }]}>
                <Text style={styles.numberText}>{holdNumber}</Text>
              </View>
            )}
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 20, // עוד יותר גבוה כדי להיות בטוח שהטבעות נראות
  },
  numberContainer: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 21,
  },
  numberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HoldRing;
