import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { RouteDoc, MapTransforms } from '../types/route';
import { fromNorm } from '@/utils/coordinateUtils';
import RouteMarker from './RouteMarker';

interface RouteMarkersLayerProps {
  routes: RouteDoc[];
  imageWidth: number;
  imageHeight: number;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  onMarkerPress?: (route: RouteDoc) => void;
  selectedRouteId?: string;
}

export default function RouteMarkersLayer({
  routes,
  imageWidth,
  imageHeight,
  scale,
  translateX,
  translateY,
  onMarkerPress,
  selectedRouteId,
}: RouteMarkersLayerProps) {
  /*
   * The map container (MapViewport) already applies the translation and scale
   * transforms to its children.  Applying the same transform here again would
   * compound the effect and misplace the markers.  Therefore, this layer
   * simply fills the parent without adding transforms.  Each marker uses the
   * provided scale shared value to compensate its size via 1/scale in
   * RouteMarker.
   */
  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {routes.map((route) => {
        // Convert normalized coordinates to image pixel coordinates
        const { xImg, yImg } = fromNorm(
          { xNorm: route.xNorm, yNorm: route.yNorm },
          { imgW: imageWidth, imgH: imageHeight }
        );

        const markerSize = 36;
        let left = xImg - markerSize / 2;
        let top = yImg - markerSize / 2;
        // Clamp positions so markers do not render completely outside
        if (!Number.isFinite(left) || !Number.isFinite(top)) {
          left = 0;
          top = 0;
        }
        left = Math.max(0, left);
        top = Math.max(0, top);
        return (
          <Animated.View
            key={route.id}
            style={[
              styles.markerContainer,
              {
                left,
                top,
              },
            ]}
            pointerEvents="box-none"
          >
            <RouteMarker
              route={route}
              scale={scale}
              onPress={onMarkerPress}
              selected={selectedRouteId === route.id}
            />
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
