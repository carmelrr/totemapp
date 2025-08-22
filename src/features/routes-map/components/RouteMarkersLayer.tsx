import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { RouteDoc, MapTransforms } from '../types/route';
import { fromNorm } from '../utils/coords';
import RouteMarker from './RouteMarker';

interface RouteMarkersLayerProps {
  routes: RouteDoc[];
  imageWidth: number;
  imageHeight: number;
  scale: Animated.SharedValue<number>;
  translateX: Animated.SharedValue<number>;
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
  // ✅ Safety: בודק שהמידע תקין לפני רינדור
  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    return null;
  }
  
  if (!scale || !translateX || !translateY) {
    console.warn('RouteMarkersLayer: Invalid transforms provided');
    return null;
  }
  
  if (!isFinite(imageWidth) || !isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    console.warn('RouteMarkersLayer: Invalid image dimensions', { imageWidth, imageHeight });
    return null;
  }

  // ✅ Fix: הסרת הטרנספורמציה הכפולה - השכבה כבר מקבלת transform מההורה
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {routes.map((route) => {
        // ✅ Safety: בודק שהנתונים של הרוט תקינים
        if (!route?.id || 
            typeof route.xNorm !== 'number' || typeof route.yNorm !== 'number' ||
            !isFinite(route.xNorm) || !isFinite(route.yNorm)) {
          console.warn('RouteMarkersLayer: Invalid route data', route);
          return null;
        }
        
        // Convert normalized coordinates to image pixel coordinates
        const { xImg, yImg } = fromNorm(
          { xNorm: route.xNorm, yNorm: route.yNorm },
          { imgW: imageWidth, imgH: imageHeight }
        );

        // ✅ Safety: בודק שהקורדינטות תקינות אחרי הקונברזיה
        if (!isFinite(xImg) || !isFinite(yImg)) {
          console.warn('RouteMarkersLayer: Invalid converted coordinates', { xImg, yImg, route });
          return null;
        }

        // Position marker container at the route location
        // Offset by half marker size to center it
        const markerSize = 36; // Should match marker size in RouteMarker
        const left = xImg - markerSize / 2;
        const top = yImg - markerSize / 2;

        return (
          <View
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
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
