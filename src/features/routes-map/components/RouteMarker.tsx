import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { RouteDoc } from '../types/route';
import { getContrastTextColor } from '../utils/colors';

interface RouteMarkerProps {
  route: RouteDoc;
  scale: SharedValue<number> | null;
  onPress?: (route: RouteDoc) => void;
  selected?: boolean;
}

export default function RouteMarker({
  route,
  scale,
  onPress,
  selected = false,
}: RouteMarkerProps) {
  // Compensate for scale to keep constant size.  Clamp the raw scale to avoid
  // division by zero or exploding values during pinch gestures.  If scale is
  // not provided, fall back to 1.
  const compensatedStyle = useAnimatedStyle(() => {
    const raw = scale?.value ?? 1;
    // If raw is not finite or zero, default to 1.  Clamp to a sensible range.
    const safeRaw = Number.isFinite(raw) && raw > 0 ? Math.min(Math.max(raw, 0.5), 8) : 1;
    return {
      transform: [{ scale: 1 / safeRaw }],
    } as any;
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
            backgroundColor: route.color, // Use exact route color as fill
            borderColor: '#FFF', // White border for contrast
            borderWidth: 2,
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
            { color: textColor }, // Use contrast color for text
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
    borderColor: '#3498db', // Blue border for selected state
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
