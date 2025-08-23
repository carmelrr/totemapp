import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  LongPressGestureHandler,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  runOnUI,
  withTiming,
  useAnimatedReaction,
  Easing,
} from "react-native-reanimated";
import WallMapSVG from "@/assets/WallMapSVG";
import Slider from "@react-native-community/slider";

import RouteCircle from "@/components/routes/RouteCircle";
import EditRouteModal from "@/components/routes/EditRouteModal";
import RouteDialog from "@/components/routes/RouteDialog";
import {
  subscribeToRoutes,
  addRoute,
  deleteRoute,
  updateRoute,
} from "@/features/routes/routesService";
import { useUser } from "@/features/auth/UserContext";
import { useTheme } from "@/features/theme/ThemeContext";
import { toRelativeCoords } from "@/utils/mapUtils";

const window = Dimensions.get("window");
const MAP_WIDTH = window.width;
const MAP_HEIGHT = window.width * 0.65;

export default function WallMap({
  sharedScale,
  sharedTranslateX,
  sharedTranslateY,
  onRoutesUpdate,
  filteredRoutes,
  editingRoute,
  setEditingRoute,
  isMovingRoute,
  setIsMovingRoute,
  hideZoomBar = false,
  onRoutePress = null, // callback לטיפול בלחיצה על מסלול
  onEditModeChange = null, // callback לעדכון מצב עריכה
}) {
  const { isAdmin } = useUser();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [routes, setRoutes] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [selectedRouteForDialog, setSelectedRouteForDialog] = useState(null);
  const [showRouteDialog, setShowRouteDialog] = useState(false);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // הוסף state לזום אם אין sharedScale
  const [localScale, setLocalScale] = useState(1);

  // השתמש ב-ref במקום state עבור isSliderActive למניעת דיליי
  const isSliderActiveRef = useRef(false);
  const lastSliderValueRef = useRef(1); // שמור את הערך האחרון של הסליידר

  // refs לגישה לgesture handlers
  const panRef = useRef();
  const pinchRef = useRef();
  const longPressRef = useRef();

  useEffect(() => {
    const unsubscribe = subscribeToRoutes((newRoutes) => {
      setRoutes(newRoutes);
      // עדכן את ה-parent component אם יש callback
      if (onRoutesUpdate) {
        onRoutesUpdate(newRoutes);
      }
    });

    // ניקוי כאשר הקומפוננטה נהרסת
    return () => {
      unsubscribe();
    };
  }, [onRoutesUpdate]);

  // טיפול במחיקת מסלול מתפריט העריכה
  useEffect(() => {
    if (editingRoute && editingRoute.shouldDelete) {
      handleDeleteRoute(editingRoute.id);
    }
  }, [editingRoute]);

  // יצירת רשימת המסלולים להצגה - כולל המסלול שנבחר לעריכה גם אם הוא לא במסלולים המסוננים
  const displayRoutes = React.useMemo(() => {
    const routesToDisplay = filteredRoutes || routes;

    // אם יש מסלול שנבחר לעריכה והוא לא ברשימה המסוננת, הוסף אותו
    if (
      editingRoute &&
      !routesToDisplay.some((route) => route.id === editingRoute.id)
    ) {
      return [...routesToDisplay, editingRoute];
    }

    return routesToDisplay;
  }, [filteredRoutes, routes, editingRoute]);

  // עדכן את הקומפוננטה האב עם הערכים הראשוניים
  useEffect(() => {
    if (sharedScale) {
      sharedScale(localScale);
    }
    // גישה ל-shared values באמצעות runOnUI
    if (sharedTranslateX && translateX) {
      runOnUI(() => {
        "worklet";
        const currentTranslateX = translateX.value;
        runOnJS(sharedTranslateX)(currentTranslateX);
      })();
    }
    if (sharedTranslateY && translateY) {
      runOnUI(() => {
        "worklet";
        const currentTranslateY = translateY.value;
        runOnJS(sharedTranslateY)(currentTranslateY);
      })();
    }
  }, []);

  // עדכן את הקומפוננטה האב כאשר localScale משתנה - רק אם זה באמת נחוץ
  useEffect(() => {
    // עדכן את הערך האחרון גם כאשר localScale משתנה מבחוץ
    if (!isSliderActiveRef.current) {
      lastSliderValueRef.current = localScale;
    }

    if (sharedScale) {
      sharedScale(localScale);
    }
  }, [localScale, sharedScale]);

  // עדכן את הקומפוננטה האב כאשר translateX או translateY משתנים
  useAnimatedReaction(
    () => [translateX.value, translateY.value],
    ([newTranslateX, newTranslateY]) => {
      if (sharedTranslateX) runOnJS(sharedTranslateX)(newTranslateX);
      if (sharedTranslateY) runOnJS(sharedTranslateY)(newTranslateY);
    },
  );

  const pinchHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      // בטל את שינוי הזום מהפינץ' (השאר רק את הבר)
      // לא לעשות כלום כאן
    },
    onEnd: () => {
      // לא לעשות כלום כאן
    },
  });

  const panHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      "worklet";
      // הגבל את התנועה כך שהמפה לא תצא מהגבולות שלה בזמן זום
      const currentScale = scale.value;

      // חשב כמה המפה יכולה לזוז מבלי לצאת מהגבולות
      const maxTranslateX =
        currentScale > 1 ? (MAP_WIDTH * currentScale - MAP_WIDTH) / 2 : 0;
      const maxTranslateY =
        currentScale > 1 ? (MAP_HEIGHT * currentScale - MAP_HEIGHT) / 2 : 0;

      let newX = ctx.startX + event.translationX;
      let newY = ctx.startY + event.translationY;

      // הגבל את התנועה בתוך הגבולות
      newX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
      newY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));

      translateX.value = newX;
      translateY.value = newY;
    },
    onEnd: () => {
      // תוכל להוסיף כאן לוגים אם צריך
    },
  });

  const combinedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleTap = useCallback(
    (event) => {
      if (!isAdmin || !isEditMode) return;

      // אם אנחנו במצב הוספת מסלול
      if (isAddingRoute) {
        try {
          // חשב את הקואורדינטות של הלחיצה
          const { x, y } = event.nativeEvent;

          // המר את הקואורדינטות לרלטיביות
          const rel = toRelativeCoords(x, y, MAP_WIDTH, MAP_HEIGHT);

          // נווט לדף יצירת המסלול
          navigation.navigate("AddRouteScreen", {
            coords: rel,
          });

          // צא ממצב הוספת מסלול
          setIsAddingRoute(false);
        } catch (error) {
          setIsAddingRoute(false);
        }
      }
    },
    [isAdmin, isEditMode, isAddingRoute, navigation],
  );

  const handleRoutePress = useCallback(
    (route) => {
      if (isAdmin && isEditMode) {
        // Admin in edit mode - show edit panel
        if (isMovingRoute && editingRoute && editingRoute.id === route.id) {
          // אם אנחנו במצב הזזה ולחצנו על אותו מסלול, נסיים את מצב ההזזה
          setIsMovingRoute(false);
        } else {
          // בחר מסלול לעריכה
          setEditingRoute(route);
          setIsMovingRoute(false);
        }
      } else {
        // Regular user or admin not in edit mode - use callback if provided, otherwise show route dialog
        if (onRoutePress) {
          onRoutePress(route);
        } else {
          setSelectedRouteForDialog(route);
          setShowRouteDialog(true);
        }
      }
    },
    [
      isAdmin,
      isEditMode,
      isMovingRoute,
      editingRoute,
      setEditingRoute,
      setIsMovingRoute,
      onRoutePress,
    ],
  );

  const handleDeleteRoute = useCallback(
    async (routeId) => {
      Alert.alert("מחיקת מסלול", "האם אתה בטוח שברצונך למחוק את המסלול?", [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoute(routeId);
              // נסגור את תפריט העריכה
              if (setEditingRoute) {
                setEditingRoute(null);
              }
              if (setIsMovingRoute) {
                setIsMovingRoute(false);
              }
              Alert.alert("הצלחה", "המסלול נמחק בהצלחה");
            } catch (e) {
              Alert.alert("שגיאה", "נכשל במחיקת המסלול");
            }
          },
        },
      ]);
    },
    [setEditingRoute, setIsMovingRoute],
  );

  // שלוט על הזום גם מהבר וגם מהפינץ' - עם שיפור יציבות
  const handleSliderChange = useCallback(
    (value) => {
      // אם הSlider לא פעיל, אל תעדכן
      if (!isSliderActiveRef.current) {
        return;
      }

      // בדוק אם הערך באמת השתנה מהערך הקודם
      const clampedValue = Math.max(1, Math.min(4, value));
      if (Math.abs(lastSliderValueRef.current - clampedValue) < 0.001) {
        return;
      }

      // עדכן את הערך האחרון
      lastSliderValueRef.current = clampedValue;

      // עדכן מיידית בלי אנימציה במהלך הגרירה
      runOnUI(() => {
        "worklet";
        scale.value = clampedValue;

        // חשב את הגבולות החדשים לאחר שינוי הזום
        const scaledWidth = MAP_WIDTH * clampedValue;
        const scaledHeight = MAP_HEIGHT * clampedValue;

        // הגבל את התזוזה כך שהמפה לא תצא מהמסגרת שלה
        const maxTranslateX = Math.max(0, (scaledWidth - MAP_WIDTH) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - MAP_HEIGHT) / 2);

        // וודא שהקואורדינטות נשארות בתוך הגבולות
        translateX.value = Math.max(
          -maxTranslateX,
          Math.min(maxTranslateX, translateX.value),
        );
        translateY.value = Math.max(
          -maxTranslateY,
          Math.min(maxTranslateY, translateY.value),
        );
      })();

      // עדכן את ה-state רק אם הערך באמת השתנה
      if (Math.abs(localScale - clampedValue) > 0.01) {
        setLocalScale(clampedValue);
      }
    },
    [localScale],
  );

  // פונקציה נפרדת לסיום הגרירה - נוטרלת את הסליידר מיידית
  const handleSliderComplete = useCallback(
    (value) => {
      const clampedValue = Math.max(1, Math.min(4, value));

      // עדכן את הערך האחרון
      lastSliderValueRef.current = clampedValue;

      // עדכן את הזום הסופי
      setLocalScale(clampedValue);

      // נטרל את הסליידר מיידית
      isSliderActiveRef.current = false;
    },
    [localScale],
  );

  const styles = createStyles(theme);

  return (
    <View
      style={[
        styles.container,
        { height: hideZoomBar ? MAP_HEIGHT : MAP_HEIGHT + 42 },
      ]}
    >
      <View style={styles.mapBox}>
        <TapGestureHandler
          ref={longPressRef}
          onActivated={handleTap}
          shouldCancelWhenOutside={true}
          enabled={isAddingRoute}
        >
          <Animated.View style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
            <PanGestureHandler
              ref={panRef}
              onGestureEvent={panHandler}
              simultaneousHandlers={[pinchRef]}
            >
              <Animated.View style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
                <PinchGestureHandler
                  ref={pinchRef}
                  onGestureEvent={pinchHandler}
                  simultaneousHandlers={[panRef]}
                >
                  <Animated.View style={[styles.mapWrapper, combinedStyle]}>
                    <WallMapSVG width={MAP_WIDTH} height={MAP_HEIGHT} />

                    {displayRoutes.map((route, index) => (
                      <RouteCircle
                        key={route.id}
                        route={route}
                        scale={localScale}
                        mapWidth={MAP_WIDTH}
                        mapHeight={MAP_HEIGHT}
                        onPress={() => handleRoutePress(route)}
                        isEditMode={isEditMode}
                        isSelected={
                          editingRoute && editingRoute.id === route.id
                        }
                        isMovingRoute={
                          isMovingRoute &&
                          editingRoute &&
                          editingRoute.id === route.id
                        }
                        onMoveComplete={(newX, newY) => {
                          updateRoute(route.id, { x: newX, y: newY });
                          setIsMovingRoute(false);
                        }}
                      />
                    ))}
                  </Animated.View>
                </PinchGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </TapGestureHandler>
      </View>

      {/* zoom bar - רק כאשר hideZoomBar הוא false */}
      {!hideZoomBar && (
        <View style={styles.zoomBarContainer}>
          {/* הודעת מצב הוספת מסלול */}
          {isAddingRoute && (
            <View style={styles.addingModeIndicator}>
              <Text style={styles.addingModeText}>
                לחץ על המפה כדי להוסיף מסלול
              </Text>
            </View>
          )}

          {/* בר זום */}
          <Text style={styles.zoomLabel}>זום</Text>
          <Slider
            style={{ flex: 1, marginHorizontal: 10 }}
            minimumValue={1}
            maximumValue={4}
            step={0.05} // גדול יותר לשיפור יציבות
            value={localScale}
            onValueChange={(value) => {
              handleSliderChange(value);
            }}
            onSlidingStart={(value) => {
              // עדכן את הערך הראשוני
              lastSliderValueRef.current = value;
              // סמן שהSlider פעיל
              isSliderActiveRef.current = true;
            }}
            onSlidingComplete={(value) => {
              handleSliderComplete(value);
            }}
            minimumTrackTintColor="#3498db"
            maximumTrackTintColor="#ddd"
            thumbStyle={{ backgroundColor: "#3498db", width: 22, height: 22 }}
            trackStyle={{ height: 5, borderRadius: 3 }}
          />
          <Text style={styles.zoomValue}>{localScale.toFixed(2)}</Text>

          {/* כפתור עריכה - נראה רק למשתמשי אדמין */}
          {isAdmin && (
            <>
              <TouchableOpacity
                style={[
                  styles.editButton,
                  isEditMode && styles.editButtonActive,
                ]}
                onPress={() => {
                  const newEditMode = !isEditMode;
                  setIsEditMode(newEditMode);
                  setIsAddingRoute(false); // צא ממצב הוספת מסלול כאשר מכבה עריכה

                  // הודע לקומפוננטה האב על שינוי מצב עריכה
                  if (onEditModeChange) {
                    onEditModeChange(newEditMode);
                  }
                }}
              >
                <Text
                  style={[
                    styles.editButtonText,
                    isEditMode && styles.editButtonTextActive,
                  ]}
                >
                  {isEditMode ? "✓" : "✎"}
                </Text>
              </TouchableOpacity>

              {/* כפתור הוספת מסלול - נראה רק במצב עריכה */}
              {isEditMode && (
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    isAddingRoute && styles.addButtonActive,
                  ]}
                  onPress={() => {
                    setIsAddingRoute(!isAddingRoute);
                  }}
                >
                  <Text
                    style={[
                      styles.addButtonText,
                      isAddingRoute && styles.addButtonTextActive,
                    ]}
                  >
                    +
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Route Dialog */}
      <RouteDialog
        visible={showRouteDialog}
        route={selectedRouteForDialog}
        onClose={() => {
          setShowRouteDialog(false);
          setSelectedRouteForDialog(null);
        }}
      />
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      width: MAP_WIDTH,
      alignSelf: "center",
      backgroundColor: "transparent",
      overflow: "hidden", // וודא שאין overflow מהcontainer
    },
    mapBox: {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      overflow: "hidden", // חזרה ל-hidden כדי לשמור על גבולות המפה
      backgroundColor: "transparent",
      alignSelf: "center",
    },
    mapWrapper: {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      position: "absolute",
      top: 0,
      left: 0,
      overflow: "hidden", // חזרה ל-hidden כדי לשמור על גבולות המפה
      // iOS ספציפי - שיפור איכות ה-rendering
      shouldRasterizeIOS: true,
      renderToHardwareTextureAndroid: true,
    },
    zoomBarContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 3,
      backgroundColor: "transparent",
      borderTopWidth: 0,
      borderTopColor: "transparent",
      width: MAP_WIDTH,
      alignSelf: "center",
      position: "relative",
    },
    addingModeIndicator: {
      position: "absolute",
      top: -24,
      left: 12,
      right: 12,
      backgroundColor: "#3498db",
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 3,
      zIndex: 1000,
    },
    addingModeText: {
      color: "#fff",
      fontSize: 11,
      textAlign: "right",
      fontWeight: "bold",
    },
    zoomLabel: {
      fontSize: 12,
      color: "#fff",
      fontWeight: "bold",
      textAlign: "right",
    },
    zoomValue: {
      fontSize: 12,
      color: "#fff",
      marginLeft: 6,
      width: 35,
      textAlign: "right",
    },
    editButton: {
      marginLeft: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "#ecf0f1",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#bdc3c7",
    },
    editButtonActive: {
      backgroundColor: "#3498db",
      borderColor: "#2980b9",
    },
    editButtonText: {
      fontSize: 12,
      color: "#34495e",
      fontWeight: "bold",
    },
    editButtonTextActive: {
      color: "#fff",
    },
    addButton: {
      marginLeft: 6,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "#27ae60",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#229954",
    },
    addButtonActive: {
      backgroundColor: "#e74c3c",
      borderColor: "#c0392b",
    },
    addButtonText: {
      fontSize: 16,
      color: "#fff",
      fontWeight: "bold",
      lineHeight: 16,
    },
    addButtonTextActive: {
      color: "#fff",
    },
  });
