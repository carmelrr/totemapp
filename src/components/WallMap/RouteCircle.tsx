import React, { useMemo } from 'react';
import { Vibration, TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue, runOnJS, interpolate, Extrapolation } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
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
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  onPress?: (route: RouteDoc) => void;
  onLongPress?: (route: RouteDoc) => void;
  selected?: boolean;
  multiSelected?: boolean;
  multiSelectMode?: boolean;
  gesturesDisabled?: boolean; // Disable gestures when in move mode
  balanceTarget?: boolean;    // Route belongs to the balance date group
  balanceExtreme?: boolean;   // Route is one of the 2 selected extremes
  balanceModeActive?: boolean; // Balance mode is active globally
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
  translateX,
  translateY,
  onPress,
  onLongPress,
  selected = false,
  multiSelected = false,
  multiSelectMode = false,
  gesturesDisabled = false,
  balanceTarget = false,
  balanceExtreme = false,
  balanceModeActive = false,
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
  const baseBorderWidth = selected || multiSelected ? 3 : 1;

  // ── Static (JS-dependent) style ──
  // IMPORTANT: backgroundColor and other JS-dependent props MUST live outside
  // useAnimatedStyle. Reanimated worklets only re-run when a SharedValue
  // (.value) changes. Putting JS variables like colorHex inside the worklet
  // means the style won't visually update until the next zoom/pan gesture.
  const staticStyle = useMemo(() => {
    // Determine opacity: in balance mode, non-target routes are heavily dimmed
    let opacity = 1;
    if (balanceModeActive) {
      opacity = balanceTarget ? 1 : 0.15;
    } else if (multiSelectMode && !multiSelected) {
      opacity = 0.5;
    }

    // Border: balance extreme gets gold highlight
    let borderColor = multiSelected ? '#E53935' : selected ? '#0066cc' : '#ffffff';
    let borderWidth = baseBorderWidth;
    if (balanceExtreme) {
      borderColor = '#FFD700';
      borderWidth = 3;
    }

    return {
      backgroundColor: precomputedValues.colorHex,
      borderWidth,
      borderColor,
      elevation: (selected || multiSelected || balanceExtreme) ? 8 : 4,
      opacity,
      width: baseSize,
      height: baseSize,
      borderRadius: baseSize / 2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    };
  }, [precomputedValues.colorHex, baseBorderWidth, multiSelected, selected, multiSelectMode, baseSize, balanceModeActive, balanceTarget, balanceExtreme]);

  // ── Animated (SharedValue-dependent) style ──
  // Only position & transform depend on SharedValues (scale, translateX, translateY)
  const circleStyle = useAnimatedStyle(() => {
    const currentScale = scale?.value ?? 1;
    const safeScale = Number.isFinite(currentScale) && currentScale > 0 
      ? Math.min(Math.max(currentScale, 0.1), 10) 
      : 1;
    
    const tx = translateX?.value ?? 0;
    const ty = translateY?.value ?? 0;
    
    // At low zoom (scale ≤ 1.8), show circles at HALF size to reduce overlap.
    // Smoothly transition to full size between scale 1.8 and 2.2.
    // Above 2.2, circles stay at full user-chosen size (zoom-compensated as before).
    const sizeFactor = interpolate(
      safeScale,
      [1.0, 1.8, 2.2],
      [0.5, 0.5, 1.0],
      Extrapolation.CLAMP
    );
    
    // Calculate screen position from image coordinates
    // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
    const imgCenterX = imageWidth / 2;
    const imgCenterY = imageHeight / 2;
    const screenX = (precomputedValues.xImg - imgCenterX) * safeScale + imgCenterX + tx;
    const screenY = (precomputedValues.yImg - imgCenterY) * safeScale + imgCenterY + ty;
    
    return {
      position: 'absolute',
      left: screenX - baseOffset,
      top: screenY - baseOffset,
      transform: [{ scale: sizeFactor }],
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
    <Animated.View style={[circleStyle, staticStyle, shadowStyle]} pointerEvents="box-none">
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
      {/* Multi-select checkmark badge */}
      {multiSelected && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#E53935" />
        </View>
      )}
      {/* Balance extreme star badge */}
      {balanceExtreme && (
        <View style={styles.extremeBadge}>
          <Ionicons name="star" size={16} color="#FFD700" />
        </View>
      )}
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // React.memo comparison function for optimization
  // IMPORTANT: must compare all route fields that affect rendering (color, grade, position)
  return (
    prevProps.route.id === nextProps.route.id &&
    prevProps.route.color === nextProps.route.color &&
    prevProps.route.grade === nextProps.route.grade &&
    prevProps.route.xNorm === nextProps.route.xNorm &&
    prevProps.route.yNorm === nextProps.route.yNorm &&
    prevProps.selected === nextProps.selected &&
    prevProps.multiSelected === nextProps.multiSelected &&
    prevProps.multiSelectMode === nextProps.multiSelectMode &&
    prevProps.imageWidth === nextProps.imageWidth &&
    prevProps.imageHeight === nextProps.imageHeight &&
    prevProps.wallWidth === nextProps.wallWidth &&
    prevProps.wallHeight === nextProps.wallHeight &&
    prevProps.scale === nextProps.scale &&
    prevProps.translateX === nextProps.translateX &&
    prevProps.translateY === nextProps.translateY &&
    prevProps.gesturesDisabled === nextProps.gesturesDisabled &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLongPress === nextProps.onLongPress &&
    prevProps.balanceTarget === nextProps.balanceTarget &&
    prevProps.balanceExtreme === nextProps.balanceExtreme &&
    prevProps.balanceModeActive === nextProps.balanceModeActive
  );
});

RouteCircle.displayName = 'RouteCircle';

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  extremeBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
});

export default RouteCircle;
