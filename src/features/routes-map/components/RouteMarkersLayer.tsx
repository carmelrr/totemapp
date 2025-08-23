import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { RouteDoc, MapTransforms } from '../types/route';
import { fromNorm } from '../utils/coords';
import RouteMarker from './RouteMarker';

interface RouteMarkersLayerProps {
  routes: RouteDoc[];
  imageWidth: number;
  imageHeight: number;
  /**
   * Shared value representing the current scale of the map. The marker size
   * compensation will use this to keep a constant on‑screen size. This value
   * should come from the same useMapTransforms instance that drives the map
   * container.
   */
  scale: Animated.SharedValue<number>;
  /**
   * Shared value representing the horizontal translation of the map. Only used
   * for debugging or advanced positioning; markers do not apply this
   * translation themselves because they are children of the map container
   * which already has the translation applied.
   */
  translateX: Animated.SharedValue<number>;
  /**
   * Shared value representing the vertical translation of the map. See
   * translateX notes above.
   */
  translateY: Animated.SharedValue<number>;
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
   * The markers live inside the map container defined in MapViewport.  That
   * container already applies the current translation and scaling to its
   * children.  Therefore we do not apply an additional transform here.  Each
   * marker will compensate its own size using 1/scale, so it remains a
   * constant visual size while the position stays locked to the underlying
   * image.
   */
  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {routes.map((route) => {
        // Convert normalized coordinates to image pixel coordinates
        const { xImg, yImg } = fromNorm(
          { xNorm: route.xNorm, yNorm: route.yNorm },
          { imgW: imageWidth, imgH: imageHeight }
        );

        // Position marker container at the route location. Offset by half
        // marker size to center it.  Clamp to non‑negative values so
        // markers on the very edge don't render outside the screen (e.g.
        // negative left/top would cause them to sit off the page).  We do
        // not clamp the maximum because the map container handles clipping.
        const markerSize = 36; // Should match marker size in RouteMarker
        let left = xImg - markerSize / 2;
        let top = yImg - markerSize / 2;
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
