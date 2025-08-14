import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
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
  const translateX = useSharedValue(hold.x * imageWidth);
  const translateY = useSharedValue(hold.y * imageHeight);
  const radius = useSharedValue(hold.r * Math.min(imageWidth, imageHeight));

  const panGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      if (onSelect) {
        runOnJS(onSelect)();
      }
    },
    onActive: (event) => {
      translateX.value = event.absoluteX;
      translateY.value = event.absoluteY;
    },
    onEnd: () => {
      if (onUpdate) {
        runOnJS(onUpdate)({
          x: translateX.value,
          y: translateY.value,
          r: radius.value
        });
      }
    },
  });

  const pinchGestureHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      const newRadius = Math.max(15, Math.min(100, radius.value * event.scale));
      radius.value = newRadius;
    },
    onEnd: () => {
      if (onUpdate) {
        runOnJS(onUpdate)({
          x: translateX.value,
          y: translateY.value,
          r: radius.value
        });
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value - radius.value },
        { translateY: translateY.value - radius.value },
      ],
    };
  });

  const holdColor = HOLD_COLORS[hold.type] || '#888888';
  const strokeWidth = isSelected ? 4 : 2;
  const circleRadius = radius.value;

  return (
    <PanGestureHandler onGestureEvent={panGestureHandler}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
          <Animated.View>
            <Svg width={circleRadius * 2} height={circleRadius * 2}>
              {/* Main hold ring */}
              <Circle
                cx={circleRadius}
                cy={circleRadius}
                r={circleRadius - strokeWidth}
                stroke={holdColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                opacity={isSelected ? 1 : 0.8}
              />
              
              {/* Tape rings */}
              {showTapes && (
                <>
                  <Circle
                    cx={circleRadius}
                    cy={circleRadius}
                    r={circleRadius - strokeWidth - 5}
                    stroke={holdColor}
                    strokeWidth={1}
                    fill="transparent"
                    opacity={0.6}
                  />
                  <Circle
                    cx={circleRadius}
                    cy={circleRadius}
                    r={circleRadius - strokeWidth - 10}
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
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  numberContainer: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HoldRing;
