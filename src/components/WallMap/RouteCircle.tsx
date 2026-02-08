import React, { useMemo } from 'react';
import { Vibration, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue, runOnJS, interpolate, Extrapolation } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { RouteDoc } from '@/features/routes-map/types/route';
import { getColorHex, getContrastTextColor } from '@/constants/colors';
import { useUser } from '@/features/auth/UserContext';

interface RouteCircleProps {
  route: RouteDoc;
  imageWidth: number;
  imageHeight: number;
  wallWidth: number;
  wallHeight: number;
  scale: SharedValue<number>;
  onPress?: (route: RouteDoc) => void;
  onLongPress?: (route: RouteDoc) => void;
  selected?: boolean;
  gesturesDisabled?: boolean; // Disable gestures when in move mode
}

/**
 * עיגול מסלול יחיד שנשאר בגודל קבוע על המסך (compensate for zoom)
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
  onLongPress,
  selected = false,
  gesturesDisabled = false,
}) => {
  // קבל גודל עיגול מהעדפות המשתמש
  const { circleSize } = useUser();
  
  // חישובים מוקדמים - מחוץ לworklet
  const precomputedValues = useMemo(() => {
    // המרת קואורדינטות מהקיר המקורי לתמונה המוצגת
    const xImg = (route.xNorm * wallWidth * imageWidth) / wallWidth;
    const yImg = (route.yNorm * wallHeight * imageHeight) / wallHeight;
    
    // בדיקת תקינות הקואורדינטות
    if (!Number.isFinite(xImg) || !Number.isFinite(yImg)) {
      if (__DEV__) {
        console.warn('RouteCircle: Invalid coordinates', { route: route.id, xImg, yImg });
      }
      return null;
    }

    // ✅ נורמליזציה חכמה של צבע המסלול
    const normalizeHex = (c?: string) => {
      if (!c) return null;
      const v = c.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
      if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v}`;
      return null;
    };
    
    const colorHex = normalizeHex(route?.color) ?? getColorHex(route.color) ?? '#FF00FF'; // fallback בולט לדיבוג
    const textColor = getContrastTextColor(colorHex);

    // לוג דיבוג לפיתוח - רק בסביבת פיתוח
    if (__DEV__ && !normalizeHex(route?.color)) {
      console.warn('🎨 Invalid route.color:', route?.id, route?.color);
    }

    // גדלים בסיסיים - משתמשים בהעדפת המשתמש (circleSize * 2 כי זה רדיוס)
    // circleSize יכול להיות 6 (קטן), 12 (בינוני), 20 (גדול)
    const baseSize = circleSize * 2.5; // מכפיל לגודל הכולל
    const baseFontSize = Math.max(8, circleSize * 0.8);

    return {
      xImg,
      yImg,
      colorHex,
      textColor,
      baseSize,
      baseFontSize,
    };
  }, [route.id, route.xNorm, route.yNorm, route.color, wallWidth, wallHeight, imageWidth, imageHeight, circleSize]);

  // אם הקואורדינטות לא תקינות
  if (!precomputedValues) {
    return null;
  }

  // גודל קבוע על המסך - משתמשים ב-transform scale במקום שינוי גודל
  // זה מונע ריצוד כי ה-transform מיושם באופן אטומי ע"י מנוע הרינדור
  
  // חישוב גודל וoffset קבועים (ללא תלות ב-scale)
  const baseSize = precomputedValues.baseSize;
  const baseOffset = baseSize / 2;
  const baseBorderWidth = selected ? 3 : 1;

  // עיצוב העיגול - מיקום קבוע, transform לפיצוי זום
  const circleStyle = useAnimatedStyle(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    
    // At low zoom (scale ≤ 1.8), show circles at HALF size to reduce overlap.
    // Smoothly transition to full size between scale 1.8 and 2.2.
    // Above 2.2, circles stay at full user-chosen size (zoom-compensated as before).
    const sizeFactor = interpolate(
      safeScale,
      [1.0, 1.8, 2.2],
      [0.5, 0.5, 1.0],
      Extrapolation.CLAMP
    );
    
    return {
      position: 'absolute',
      left: precomputedValues.xImg - baseOffset,
      top: precomputedValues.yImg - baseOffset,
      width: baseSize,
      height: baseSize,
      borderRadius: baseSize / 2,
      backgroundColor: precomputedValues.colorHex,
      borderWidth: baseBorderWidth,
      borderColor: selected ? '#0066cc' : '#ffffff',
      elevation: selected ? 8 : 4,
      justifyContent: 'center',
      alignItems: 'center',
      transform: [{ scale: sizeFactor / safeScale }],
    };
  });

  // הטקסט לא צריך פיצוי נפרד - ה-transform של ההורה כבר מטפל בזה
  const textStyle = {
    fontSize: precomputedValues.baseFontSize,
    fontWeight: 'bold' as const,
    color: precomputedValues.textColor,
  };

  const shadowStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  };

  const handlePress = () => {
    onPress?.(route);
  };

  const handleLongPress = () => {
    // הפעלת רטט קצר לפידבק
    Vibration.vibrate(50);
    onLongPress?.(route);
  };

  // Use TouchableOpacity for reliable touch detection at any zoom level
  // The touch area is the full circle which maintains correct position
  return (
    <Animated.View style={[circleStyle, shadowStyle]} pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={gesturesDisabled ? undefined : handlePress}
        onLongPress={gesturesDisabled || !onLongPress ? undefined : handleLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
        disabled={gesturesDisabled}
      >
        <Animated.View style={styles.innerContainer}>
          <Text style={textStyle}>
            {route.grade || '?'}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // React.memo comparison function for optimization
  // אל תקרא את scale.value כאן כי זה גורם לרנדור warning
  return (
    prevProps.route.id === nextProps.route.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.imageWidth === nextProps.imageWidth &&
    prevProps.imageHeight === nextProps.imageHeight &&
    prevProps.wallWidth === nextProps.wallWidth &&
    prevProps.wallHeight === nextProps.wallHeight &&
    prevProps.scale === nextProps.scale && // השוואת reference במקום קריאת value
    prevProps.gesturesDisabled === nextProps.gesturesDisabled &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLongPress === nextProps.onLongPress
  );
});

RouteCircle.displayName = 'RouteCircle';

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RouteCircle;
