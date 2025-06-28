import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Alert } from 'react-native';
import { PanGestureHandler, PinchGestureHandler, TapGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import WallMapSVG from '../assets/WallMapSVG';

import RouteCircle from './RouteCircle';
import AddRouteModal from './AddRouteModal';
import { subscribeToRoutes, addRoute } from '../routesService';
import { useUser } from '../context/UserContext';
import { toRelativeCoords } from '../utils/mapUtils';

const window = Dimensions.get('window');
const MAP_WIDTH = window.width;
const MAP_HEIGHT = window.width * 0.65;

export default function WallMap({ sharedScale, sharedTranslateX, sharedTranslateY }) {
  const { isAdmin } = useUser();
  const [routes, setRoutes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCoords, setNewCoords] = useState(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const unsubscribe = subscribeToRoutes(setRoutes);
    return unsubscribe;
  }, []);

  const pinchHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      const newScale = Math.min(Math.max(1, event.scale), 3);
      scale.value = newScale;
      if (sharedScale) runOnJS(sharedScale)(newScale);
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        if (sharedScale) runOnJS(sharedScale)(1);
      }
    },
  });

  const panHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      const scaledWidth = MAP_WIDTH * scale.value;
      const scaledHeight = MAP_HEIGHT * scale.value;

      const maxTranslateX = (scaledWidth - MAP_WIDTH) / 2;
      const maxTranslateY = (scaledHeight - MAP_HEIGHT) / 2;

      let newX = ctx.startX + event.translationX;
      let newY = ctx.startY + event.translationY;

      newX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
      newY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));

      translateX.value = newX;
      translateY.value = newY;
      if (sharedTranslateX) runOnJS(sharedTranslateX)(newX);
      if (sharedTranslateY) runOnJS(sharedTranslateY)(newY);
    },
  });

  const combinedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleTap = useCallback((event) => {
    if (!isAdmin) return;
    const { x, y } = event.nativeEvent;
    const rel = toRelativeCoords(x, y, MAP_WIDTH, MAP_HEIGHT);
    setNewCoords(rel);
    setModalVisible(true);
  }, [isAdmin]);

  const handleSaveRoute = useCallback(async (routeData) => {
    try {
      await addRoute(routeData);
    } catch (e) {
      Alert.alert('Error', 'Failed to add route.');
    }
  }, []);

  return (
    <View style={styles.container}>
      <TapGestureHandler onEnded={handleTap}>
        <Animated.View style={{ flex: 1 }}>
          <PanGestureHandler onGestureEvent={panHandler}>
            <Animated.View style={{ flex: 1 }}>
              <PinchGestureHandler onGestureEvent={pinchHandler}>
                <Animated.View style={[styles.mapWrapper, combinedStyle]}>
                  <WallMapSVG
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                  />
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </TapGestureHandler>

      {routes.map(route => (
        <RouteCircle
          key={route.id}
          route={route}
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          mapWidth={MAP_WIDTH}
          mapHeight={MAP_HEIGHT}
        />
      ))}

      <AddRouteModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveRoute}
        initialCoords={newCoords}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    overflow: 'hidden',
  },
  mapWrapper: {
    flex: 1,
  },
});

