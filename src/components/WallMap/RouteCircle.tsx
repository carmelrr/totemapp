import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { RouteDoc } from '@/features/routes-map/types/route';
import { getContrastTextColor } from '@/features/routes-map/utils/colors';

interface RouteCircleProps {
  route: RouteDoc;
  imageWidth: number;
  imageHeight: number;
  wallWidth: number;
  wallHeight: number;
  scale: Animated.SharedValue<number>;
  onPress?: (route: RouteDoc) => void;
  selected?: boolean;
}

/**
 * עיגול מסלול יחיד שנשאר בגודל קבוע על המסך (compensate for zoom)
 * משתמש בקואורדינטות תמונה מלאות במקום נורמליזציה
 */
export default function RouteCircle({
  route,
  imageWidth,
  imageHeight,
  wallWidth,
  wallHeight,
  scale,
  onPress,
  selected = false,
}: RouteCircleProps) {
  
  // המרת קואורדינטות מהקיר המקורי לתמונה המוצגת
  const xImg = (route.xNorm * wallWidth * imageWidth) / wallWidth;
  const yImg = (route.yNorm * wallHeight * imageHeight) / wallHeight;
  
  // בדיקת תקינות הקואורדינטות
  if (!Number.isFinite(xImg) || !Number.isFinite(yImg)) {
    console.warn('RouteCircle: Invalid coordinates', { route: route.id, xImg, yImg });
    return null;
  }

  // Compensate for scale - עיגול נשאר בגודל קבוע במסך
  const compensatedStyle = useAnimatedStyle(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    
    return {
      transform: [{ scale: 1 / safeScale }],
    } as any;
  });

  const textColor = getContrastTextColor(route.color);
  const markerSize = 36;

  const handlePress = () => {
    onPress?.(route);
  };

  return (
    <View
      style={[
        styles.container,
        {
          left: xImg - markerSize / 2,
          top: yImg - markerSize / 2,
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={compensatedStyle}>
        <TouchableOpacity
          style={[
            styles.circle,
            {
              borderColor: route.color,
              backgroundColor: route.color + '20', // 20% opacity
            },
            selected && styles.selectedCircle,
            selected && { backgroundColor: route.color },
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
        
        {/* תווית שם - מופיעה בבחירה */}
        {selected && route.name && (
          <View style={[styles.nameLabel, { backgroundColor: route.color }]}>
            <Text style={[styles.nameText, { color: textColor }]} numberOfLines={1}>
              {route.name}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
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
  selectedCircle: {
    borderWidth: 3,
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
