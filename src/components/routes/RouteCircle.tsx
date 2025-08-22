import React, { useState, useEffect } from "react";
import { Text, TouchableOpacity, InteractionManager } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useAnimatedGestureHandler,
  runOnJS,
  withSpring,
  useDerivedValue,
  useAnimatedReaction,
  runOnUI,
} from "react-native-reanimated";
import { getDisplayGrade } from "@/features/routes/routesService";
import { useUser } from "@/features/auth/UserContext";

const ORIGINAL_MAP_WIDTH = 2560;
const ORIGINAL_MAP_HEIGHT = 1600;

// Function to get appropriate font size based on circle size
const getFontSize = (circleSize) => {
  const sizeMap = {
    10: 8, // קטן
    15: 12, // בינוני
    20: 14, // גדול
    25: 16, // ענק
  };
  return sizeMap[circleSize] || 12;
};

// פונקציה לקבלת צבע הטקסט המתאים לצבע הרקע
const getTextColor = (backgroundColor) => {
  // מיפוי שמות הצבעים בעברית לקודי צבעים
  const colorMap = {
    אדום: "#FF0000",
    "אדום כהה": "#FF1744",
    "אדום כתום": "#FF5722",
    "ורוד אדום": "#E91E63",
    "אדום חי": "#F44336",
    "אדום בהיר": "#FF6B6B",
    "אדום פסטל": "#FF8A80",
    "ורוד בהיר": "#FFCDD2",
    כתום: "#FF9800",
    "כתום זהב": "#FF8F00",
    "כתום כהה": "#FF6F00",
    "כתום בהיר": "#FFB74D",
    "כתום צהוב": "#FFCC02",
    "כתום חיוור": "#FFE082",
    "כתום פסטל": "#FFECB3",
    צהוב: "#FFEB3B",
    "צהוב זהב": "#FFC107",
    "צהוב כתום": "#FF8F00",
    "צהוב בהיר": "#FFFF00",
    "צהוב חיוור": "#FFFF8D",
    שנהב: "#FFFDE7",
    "ירוק צהוב": "#F9FBE7",
    ירוק: "#4CAF50",
    "ירוק בהיר": "#8BC34A",
    "ירוק ליים": "#CDDC39",
    "ירוק זית": "#689F38",
    "ירוק יער": "#388E3C",
    "ירוק כהה": "#2E7D32",
    "ירוק פסטל": "#A5D6A7",
    "ירוק חיוור": "#C8E6C9",
    תכלת: "#00BCD4",
    "תכלת בהיר": "#26C6DA",
    "תכלת כהה": "#00ACC1",
    "תכלת עמוק": "#0097A7",
    "תכלת חיוור": "#80DEEA",
    "תכלת פסטל": "#B2EBF2",
    אקווה: "#E0F2F1",
    ציאן: "#4DD0E1",
    כחול: "#2196F3",
    "כחול כהה": "#1976D2",
    "כחול נייבי": "#0D47A1",
    "כחול בהיר": "#42A5F5",
    "כחול שמיים": "#64B5F6",
    "כחול חיוור": "#90CAF9",
    "כחול פסטל": "#BBDEFB",
    "כחול בייבי": "#E3F2FD",
    סגול: "#9C27B0",
    "סגול כהה": "#673AB7",
    "סגול כחול": "#3F51B5",
    "סגול עמוק": "#7B1FA2",
    "סגול בהיר": "#AB47BC",
    "סגול ורוד": "#BA68C8",
    "סגול חיוור": "#CE93D8",
    "סגול פסטל": "#E1BEE7",
    חום: "#795548",
    "חום בהיר": "#8D6E63",
    "חום כהה": "#6D4C41",
    "חום קפה": "#5D4037",
    "חום חול": "#A1887F",
    "חום פסטל": "#BCAAA4",
    "בז'": "#D7CCC8",
    קרם: "#EFEBE9",
    אפור: "#9E9E9E",
    "אפור כהה": "#757575",
    "אפור פחם": "#424242",
    "אפור בהיר": "#BDBDBD",
    "אפור חיוור": "#E0E0E0",
    "אפור פסטל": "#F5F5F5",
    שחור: "#000000",
    לבן: "#FFFFFF",
    "לבן שנהב": "#FFFEF7",
  };

  // המר את שם הצבע לקוד צבע אם צריך
  const colorCode = colorMap[backgroundColor] || backgroundColor;

  // צבעים בהירים שצריכים טקסט שחור
  const lightColors = [
    "#FFFFFF",
    "#FFFEF7",
    "#FFFDE7",
    "#F9FBE7",
    "#F0F4C3",
    "#E0F2F1",
    "#E3F2FD",
    "#E1BEE7",
    "#EFEBE9",
    "#D7CCC8",
    "#BCAAA4",
    "#E0E0E0",
    "#F5F5F5",
    "#FFCDD2",
    "#FFE082",
    "#FFECB3",
    "#A5D6A7",
    "#C8E6C9",
    "#B2EBF2",
    "#80DEEA",
    "#90CAF9",
    "#BBDEFB",
    "#CE93D8",
    "#FFFF8D",
    "#FFFF00",
    "#FFCC02",
    "#FFB74D",
    "#FFE082",
    "#FFECB3",
    "#FF8A80",
    "#FF6B6B",
    "#BDBDBD",
  ];

  // אם הצבע בהיר, החזר שחור. אחרת, החזר לבן
  return lightColors.includes(colorCode?.toUpperCase()) ? "#000000" : "#FFFFFF";
};

export default React.memo(function RouteCircle({
  route,
  scale,
  mapWidth = 400,
  mapHeight = 260,
  onPress,
  isEditMode = false,
  isSelected = false,
  isMovingRoute = false,
  onMoveComplete, // יקרא רק כשמסיימים הזזה
}) {
  // EARLY RETURNS FIRST - before any hooks
  if (!route) {
    return null;
  }

  // בדוק שהקואורדינטות תקינות
  if (
    typeof route.x !== "number" ||
    typeof route.y !== "number" ||
    isNaN(route.x) ||
    isNaN(route.y) ||
    route.x < 0 ||
    route.y < 0
  ) {
    return null;
  }

  const { circleSize } = useUser();

  // State רגיל לשמירת ערך הscale עבור gesture handler - מוסר כי אין צורך יותר

  // Shared value לשמירת ה-scale עבור animations - מוסר כי אין צורך יותר

  const CIRCLE_RADIUS = circleSize;
  const fontSize = getFontSize(circleSize);

  // ALL HOOKS MUST BE DEFINED FIRST - לפני כל return statement
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(0);

  // עכשיו scale הוא number רגיל - לא צריך useAnimatedReaction
  const currentScale = scale || 1;

  // Gesture handler for dragging when in moving mode
  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      if (!isMovingRoute) return;
      isDragging.value = 1;
    },
    onActive: (event) => {
      if (!isMovingRoute) return;
      // שמור את התזוזה הגולמית מהgesture
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onEnd: () => {
      if (!isMovingRoute) return;
      isDragging.value = 0;

      // Calculate final position and save immediately
      // השתמש ב-scale ישירות
      const scaleValue = currentScale;

      // ודא שהערך תקין
      if (!scaleValue || scaleValue <= 0) {
        return;
      }

      // התזוזה בפיקסלים על המפה הווירטואלית
      // כאשר יש זום, התזוזה הפיזית של האצבע מתורגמת לתזוזה קטנה יותר על המפה
      const actualMoveX = translateX.value / scaleValue;
      const actualMoveY = translateY.value / scaleValue;

      // המר את התזוזה לקואורדינטות נורמליזה (0-1)
      const deltaXNorm = actualMoveX / mapWidth;
      const deltaYNorm = actualMoveY / mapHeight;

      // Current route position (normalized 0-1 or pixel coordinates)
      const currentX = route.x > 2 ? route.x / ORIGINAL_MAP_WIDTH : route.x;
      const currentY = route.y > 2 ? route.y / ORIGINAL_MAP_HEIGHT : route.y;

      // Calculate new normalized position
      const newXNorm = currentX + deltaXNorm;
      const newYNorm = currentY + deltaYNorm;

      // Clamp to valid range (0-1 for normalized coordinates)
      const clampedX = Math.max(0, Math.min(1, newXNorm));
      const clampedY = Math.max(0, Math.min(1, newYNorm));

      // Convert back to original format (pixel coordinates)
      const newX = clampedX * ORIGINAL_MAP_WIDTH;
      const newY = clampedY * ORIGINAL_MAP_HEIGHT;

      // Reset values with smooth animation
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });

      // Save the move
      if (onMoveComplete) {
        runOnJS(onMoveComplete)(newX, newY);
      }
    },
  });

  // Animation style for dragging
  const dragStyle = useAnimatedStyle(() => {
    "worklet";
    if (!isMovingRoute) {
      return {
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      };
    }

    // השתמש ב-scale ישירות
    const scaleValue = currentScale;

    // ודא שהערך תקין
    if (!scaleValue || scaleValue <= 0) {
      return {
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      };
    }

    // כאשר יש זום, התזוזה הויזואלית צריכה להיות מותאמת
    // כדי שהעיגול יזוז בדיוק לאן שהאצבע מזיזה אותו
    const visualMoveX = translateX.value / scaleValue;
    const visualMoveY = translateY.value / scaleValue;

    // הוסף אפקט קנה מידה קל במהלך הגרירה - מותאם לגודל החדש
    const isDraggingActive = isDragging.value === 1;
    const scaleEffect = isDraggingActive ? 1.05 : 1; // פחות אגרסיבי מ-1.1

    return {
      transform: [
        { translateX: visualMoveX },
        { translateY: visualMoveY },
        { scale: scaleEffect },
      ],
    };
  }, [isMovingRoute, isDragging, currentScale]);

  // Calculate text color outside the worklet
  const textColor = getTextColor(route.color);

  // Animated style for text to ensure it responds to scale changes
  const textStyle = useAnimatedStyle(() => {
    "worklet";
    const scaleValue = currentScale;
    if (!scaleValue || scaleValue <= 0) {
      return {
        color: textColor,
        fontWeight: "bold",
        fontSize: fontSize,
      };
    }

    // חישוב גודל פונט מותאם שנשאר קריא ויחסי
    // ככל שמקרבים (zoom גדל), הפונט צריך להקטן באופן מבוקר
    const adjustedFontSize = fontSize / Math.pow(scaleValue, 0.3); // חזקה קטנה יותר לשינוי עדין

    // גבולות לגודל הפונט
    const minFontSize = fontSize * 0.5; // לא יותר קטן מחצי מהגודל המקורי
    const maxFontSize = fontSize * 1.5; // לא יותר גדול מפי 1.5 מהגודל המקורי

    const finalFontSize = Math.max(
      minFontSize,
      Math.min(maxFontSize, adjustedFontSize),
    );

    return {
      color: textColor,
      fontWeight: "bold",
      fontSize: finalFontSize,
    };
  }, [currentScale, fontSize, textColor]);

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";

    // השתמש ב-scale ישירות
    const scaleValue = currentScale;

    // בדיקת תקינות
    if (!scaleValue || scaleValue <= 0 || isNaN(scaleValue)) {
      return {
        opacity: 0.1,
        transform: [{ scale: 1 }],
      };
    }

    // במקום inverseScale, נחשב את הגודל הנדרש באופן ישיר
    const baseSize = CIRCLE_RADIUS * 2;
    const optimalSize = baseSize / scaleValue;

    // גבול מינימלי וגדול מקסימלי לגודל
    const minSize = baseSize * 0.3; // לא יותר קטן מ-30% מהגודל המקורי
    const maxSize = baseSize * 2.5; // לא יותר גדול מפי 2.5 מהגודל המקורי
    const finalSize = Math.max(minSize, Math.min(maxSize, optimalSize));

    try {
      // תמיכה אוטומטית בשני פורמטים: יחס (0-1) או פיקסלים
      const xNorm = route.x > 2 ? route.x / ORIGINAL_MAP_WIDTH : route.x;
      const yNorm = route.y > 2 ? route.y / ORIGINAL_MAP_HEIGHT : route.y;

      // הקואורדינטות יחסית למפה
      const x = xNorm * mapWidth;
      const y = yNorm * mapHeight;

      // חשב את הגבולות של הגדלה מדי (פיקסל מדויק)
      const borderWidth = isSelected
        ? Math.max(2, 4 / scaleValue)
        : Math.max(1, 2 / scaleValue);
      const radius = finalSize / 2;

      return {
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: finalSize,
        height: finalSize,
        borderRadius: radius,
        backgroundColor: route.color || "red",
        justifyContent: "center",
        alignItems: "center",
        // ללא transform scale - גודל ישיר
        borderWidth: borderWidth,
        borderColor: isSelected
          ? isMovingRoute
            ? "#f39c12"
            : "#3498db"
          : "white",
        elevation: isSelected ? 10 : isMovingRoute ? 8 : 5,
        zIndex: isSelected ? 2000 : 1000,
        // אפקט משופר במצב הזזה
        opacity: isMovingRoute ? 0.9 : 1,
        shadowColor: isMovingRoute ? "#000" : "transparent",
        shadowOpacity: isMovingRoute ? 0.3 : 0,
        shadowRadius: isMovingRoute ? 8 : 0,
        // iOS מיוחד - שיפור איכות ה-rendering
        shouldRasterizeIOS: true,
        renderToHardwareTextureAndroid: true,
      };
    } catch (error) {
      return {
        opacity: 0.5, // שקיפות חלקית במקום הסתרה
        transform: [{ scale: 1 }],
      };
    }
  }, [route, mapWidth, mapHeight, isSelected, isMovingRoute, currentScale]);

  return (
    <PanGestureHandler
      onGestureEvent={gestureHandler}
      enabled={isMovingRoute}
      minPointers={1}
      maxPointers={1}
      avgTouches={false}
      enableTrackpadTwoFingerGesture={false}
      shouldCancelWhenOutside={false}
      activeOffsetX={[-4, 4]}
      activeOffsetY={[-4, 4]}
    >
      <Animated.View style={[animatedStyle, dragStyle]}>
        {onPress ? (
          <TouchableOpacity
            onPress={onPress}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 50, // גבוה מספיק לכל גודל
            }}
            activeOpacity={0.8}
          >
            <Animated.Text style={textStyle}>
              {getDisplayGrade(route) || "N/A"}
            </Animated.Text>
          </TouchableOpacity>
        ) : (
          <Animated.Text style={textStyle}>
            {getDisplayGrade(route) || "N/A"}
          </Animated.Text>
        )}
      </Animated.View>
    </PanGestureHandler>
  );
});
