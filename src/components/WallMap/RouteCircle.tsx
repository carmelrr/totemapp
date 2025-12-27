import React, { useMemo } from 'react';
import Animated, { useAnimatedStyle, useDerivedValue, SharedValue, runOnJS } from 'react-native-reanimated';
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
      console.warn('RouteCircle: Invalid coordinates', { route: route.id, xImg, yImg });
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
  }, [route.id, route.xNorm, route.yNorm, route.color, route.grade, wallWidth, wallHeight, imageWidth, imageHeight, circleSize]);

  // אם הקואורדינטות לא תקינות
  if (!precomputedValues) {
    return null;
  }

  // גודל קבוע על המסך - העיגולים שומרים על אותו קוטר פיזי (למשל 32px) 
  // גם כשעושים זום על המפה. מחלקים ב-scale כדי לפצות על הזום.
  const compensatedSize = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    
    // מחלקים בscale כדי שהגודל על המסך יישאר קבוע
    return precomputedValues.baseSize / safeScale;
  });

  const compensatedFontSize = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    
    return precomputedValues.baseFontSize / safeScale;
  });

  // Offset למרכוז העיגול
  const compensatedOffset = useDerivedValue(() => {
    return compensatedSize.value / 2;
  });

  // Border width שמפצה על הזום
  const compensatedBorderWidth = useDerivedValue(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    const baseBorder = selected ? 3 : 1;
    return baseBorder / safeScale;
  });

  // עיצוב העיגול - גודל קבוע על המסך
  const circleStyle = useAnimatedStyle(() => {
    const size = compensatedSize.value;
    const offset = compensatedOffset.value;
    const borderW = compensatedBorderWidth.value;
    
    return {
      position: 'absolute',
      left: precomputedValues.xImg - offset,
      top: precomputedValues.yImg - offset,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: precomputedValues.colorHex,
      borderWidth: borderW,
      borderColor: selected ? '#0066cc' : '#ffffff',
      elevation: selected ? 8 : 4,
      justifyContent: 'center',
      alignItems: 'center',
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    fontSize: compensatedFontSize.value,
    fontWeight: 'bold' as const,
    color: precomputedValues.textColor,
  }));

  const shadowStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  };

  const handlePress = () => {
    console.log('[RouteCircle] Tap on route:', route.id);
    onPress?.(route);
  };

  const handleLongPress = () => {
    console.log('[RouteCircle] LongPress on route:', route.id);
    onLongPress?.(route);
  };

  // Gesture handlers using react-native-gesture-handler
  const tapGesture = useMemo(() => 
    Gesture.Tap()
      .enabled(!gesturesDisabled)
      .onEnd(() => {
        'worklet';
        runOnJS(handlePress)();
      }),
    [route, onPress, gesturesDisabled]
  );

  const longPressGesture = useMemo(() =>
    Gesture.LongPress()
      .minDuration(400)
      .enabled(!gesturesDisabled)
      .onEnd(() => {
        'worklet';
        runOnJS(handleLongPress)();
      }),
    [route, onLongPress, gesturesDisabled]
  );

  const composedGesture = useMemo(() =>
    Gesture.Exclusive(longPressGesture, tapGesture),
    [longPressGesture, tapGesture]
  );

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[circleStyle, shadowStyle]}>
        <Animated.Text style={textStyle}>
          {route.calculatedGrade || route.grade || '?'}
        </Animated.Text>
      </Animated.View>
    </GestureDetector>
  );
}, (prevProps, nextProps) => {
  // React.memo comparison function for optimization
  // אל תקרא את scale.value כאן כי זה גורם לרנדור warning
  // ✅ חשוב: חייבים להשוות גם calculatedGrade ו-grade כדי שהעיגול יתעדכן אחרי feedback
  return (
    prevProps.route.id === nextProps.route.id &&
    prevProps.route.calculatedGrade === nextProps.route.calculatedGrade && // ✅ FIX: re-render on grade change
    prevProps.route.grade === nextProps.route.grade && // ✅ FIX: also check original grade
    prevProps.route.color === nextProps.route.color && // ✅ FIX: also check color changes
    prevProps.selected === nextProps.selected &&
    prevProps.imageWidth === nextProps.imageWidth &&
    prevProps.imageHeight === nextProps.imageHeight &&
    prevProps.wallWidth === nextProps.wallWidth &&
    prevProps.wallHeight === nextProps.wallHeight &&
    prevProps.scale === nextProps.scale && // השוואת reference במקום קריאת value
    prevProps.gesturesDisabled === nextProps.gesturesDisabled
  );
});

RouteCircle.displayName = 'RouteCircle';

export default RouteCircle;
