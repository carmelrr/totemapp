import React, { useMemo } from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { RouteDoc } from '@/features/routes-map/types/route';
import { getColorHex, getContrastTextColor } from '@/constants/colors';

interface RouteCircleProps {
  route: RouteDoc;
  imageWidth: number;
  imageHeight: number;
  wallWidth: number;
  wallHeight: number;
  scale: SharedValue<number>;
  onPress?: (route: RouteDoc) => void;
  selected?: boolean;
}

/**
 * עיגול מסלול יחיד מאופטם - שנשאר בגודל קבוע על המסך
 * אופטימיזציה: חישובים מוקדמים ומינימום worklet operations
 */
const RouteCircle = React.memo<RouteCircleProps>(({
  route,
  imageWidth,
  imageHeight,
  wallWidth,
  wallHeight,
  scale,
  onPress,
  selected = false,
}) => {
  
  // חישובים מוקדמים - מחוץ לworklet
  const precomputedValues = useMemo(() => {
    // המרת קואורדינטות מהקיר המקורי לתמונה המוצגת
    const xImg = (route.xNorm * wallWidth * imageWidth) / wallWidth;
    const yImg = (route.yNorm * wallHeight * imageHeight) / wallHeight;
    
    // בדיקת תקינות הקואורדינטות
    if (!Number.isFinite(xImg) || !Number.isFinite(yImg)) {
      console.warn('RouteCircle: Invalid coordinates', { route: route.id, xImg, yImg });
      return null;
    }

    // צבעים מוקדמים
    const colorHex = getColorHex(route.color);
    const textColor = getContrastTextColor(colorHex);

    // גדלים בסיסיים
    const baseSize = 32;
    const baseFontSize = 12;

    return {
      xImg,
      yImg,
      colorHex,
      textColor,
      baseSize,
      baseFontSize,
    };
  }, [route.id, route.xNorm, route.yNorm, route.color, route.grade, wallWidth, wallHeight, imageWidth, imageHeight]);

  // אם הקואורדינטות לא תקינות
  if (!precomputedValues) {
    return null;
  }

  // Derived values לחישובים smooth
  const compensatedSize = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    
    // גודל שנשאר קבוע במסך
    return Math.max(24, precomputedValues.baseSize / Math.sqrt(safeScale));
  });

  const compensatedFontSize = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    
    // גודל גופן שנשאר קריא
    return Math.max(8, Math.min(16, precomputedValues.baseFontSize / Math.sqrt(safeScale)));
  });

  // עיצוב העיגול עם אופטימיזציה
  const circleStyle = useAnimatedStyle(() => {
    const size = compensatedSize.value;
    
    return {
      position: 'absolute',
      left: precomputedValues.xImg - size / 2,
      top: precomputedValues.yImg - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: precomputedValues.colorHex,
      borderWidth: selected ? 3 : 1,
      borderColor: selected ? '#0066cc' : '#ffffff',
      elevation: selected ? 8 : 4,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      justifyContent: 'center',
      alignItems: 'center',
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    fontSize: compensatedFontSize.value,
    fontWeight: 'bold' as const,
    color: precomputedValues.textColor,
    textAlign: 'center' as const,
  }));

  const handlePress = () => {
    onPress?.(route);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={circleStyle}>
        <Animated.Text style={textStyle}>
          {route.grade || '?'}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // React.memo comparison function for optimization
  return (
    prevProps.route.id === nextProps.route.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.imageWidth === nextProps.imageWidth &&
    prevProps.imageHeight === nextProps.imageHeight &&
    prevProps.wallWidth === nextProps.wallWidth &&
    prevProps.wallHeight === nextProps.wallHeight &&
    Math.abs((prevProps.scale?.value ?? 1) - (nextProps.scale?.value ?? 1)) < 0.01
  );
});

RouteCircle.displayName = 'RouteCircle';

export default RouteCircle;
