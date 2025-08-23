import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { RouteDoc } from '../types/route';
import { getContrastTextColor } from '../utils/colors';

interface RouteMarkerProps {
  route: RouteDoc;
  scale: Animated.SharedValue<number> | null;
  onPress?: (route: RouteDoc) => void;
  selected?: boolean;
}

export default function RouteMarker({
  route,
  scale,
  onPress,
  selected = false,
}: RouteMarkerProps) {
  console.log('🔍 RouteMarker render:', {
    routeId: route?.id,
    routeGrade: route?.grade,
    scaleExists: !!scale,
    selected
  });

  // Compensate for scale to keep constant size with safety guards
  const compensatedStyle = useAnimatedStyle(() => {
    console.log('🔍 RouteMarker useAnimatedStyle called');
    // guard + clamping
    const raw = scale?.value ?? 1;
    console.log('🔍 RouteMarker raw scale:', raw);
    // אל תאפשר 0/NaN/Infinity, הצמד לטווח סביר
    const s = Number.isFinite(raw) && raw > 0 ? Math.min(Math.max(raw, 0.5), 8) : 1;
    console.log('🔍 RouteMarker safe scale:', s, 'compensated:', 1/s);
    return { transform: [{ scale: 1 / s }] } as any;
  });

  const textColor = getContrastTextColor(route.color);

  const handlePress = () => {
    onPress?.(route);
  };

  return (
    <Animated.View style={[styles.container, compensatedStyle]}>
      <TouchableOpacity
        style={[
          styles.marker,
          {
            borderColor: route.color,
            backgroundColor: route.color + '20', // 20% opacity
          },
          selected && styles.selectedMarker,
        ]}
        onPress={handlePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.gradeText,
            { color: route.color },
            selected && { color: textColor },
          ]}
        >
          {route.grade}
        </Text>
      </TouchableOpacity>
      
      {/* Name label - appears on selection or hover */}
      {selected && (
        <View style={[styles.nameLabel, { backgroundColor: route.color }]}>
          <Text style={[styles.nameText, { color: textColor }]} numberOfLines={1}>
            {route.name}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedMarker: {
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 120,
  },
  nameText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
