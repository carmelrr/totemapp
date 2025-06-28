// RouteCircle.js - מתוקן: מיקום מדויק עם zoom ו-pan, גודל עקבי ללא קנה מידה הפוך
import React from 'react';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

const MAP_WIDTH = 400;
const MAP_HEIGHT = 260;
const IMAGE_WIDTH = 2560;
const IMAGE_HEIGHT = 1600;
const CIRCLE_RADIUS = 20;

export default function RouteCircle({ route, scale, translateX, translateY }) {
  const animatedStyle = useAnimatedStyle(() => {
    const x = translateX.value + (route.x / IMAGE_WIDTH) * MAP_WIDTH * scale.value;
    const y = translateY.value + (route.y / IMAGE_HEIGHT) * MAP_HEIGHT * scale.value;

    return {
      position: 'absolute',
      left: x - CIRCLE_RADIUS,
      top: y - CIRCLE_RADIUS,
      width: CIRCLE_RADIUS * 2,
      height: CIRCLE_RADIUS * 2,
      borderRadius: CIRCLE_RADIUS,
      backgroundColor: route.color || 'red',
      justifyContent: 'center',
      alignItems: 'center'
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Text style={{ color: 'white', fontWeight: 'bold' }}>{route.grade}</Text>
    </Animated.View>
  );
}
