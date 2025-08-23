import React from "react";
import { Alert, Pressable, View } from "react-native";
import RouteCircle from "./RouteCircle";

/**
 * רכיב שאחראי על ניהול הוספה ומחיקה של מסלולים כאשר מצב עריכה פעיל.
 * @param {Array} routes - כל המסלולים הקיימים
 * @param {function} setRoutes - פונקציה לעדכון המסלולים המקומיים
 * @param {object} newCoords - קואורדינטות חדשות שנבחרו
 * @param {function} setNewCoords - פונקציה לעדכון הקואורדינטות
 * @param {boolean} modalVisible - האם המודל פתוח
 * @param {function} setModalVisible - פונקציה לפתיחת/סגירת המודל
 * @param {function} onAddRoute - פונקציה שמוסיפה מסלול חדש
 * @param {function} onDeleteRoute - פונקציה שמוחקת מסלול לפי ID
 */
export default function EditMapManager({
  routes,
  setRoutes,
  newCoords,
  setNewCoords,
  modalVisible,
  setModalVisible,
  onAddRoute,
  onDeleteRoute,
}) {
  const isEditMode = global.__specialFeatureOn === true;
  if (!isEditMode) return null;

  const handleRoutePress = (routeId) => {
    Alert.alert("מחיקת מסלול", "האם אתה בטוח שברצונך למחוק את המסלול הזה?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          try {
            await onDeleteRoute(routeId);
          } catch (e) {
            Alert.alert("שגיאה", "לא ניתן למחוק מסלול");
          }
        },
      },
    ]);
  };

  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {routes.map((route) => (
        <Pressable
          key={route.id}
          onPress={() => handleRoutePress(route.id)}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <RouteCircle
            route={route}
            scale={1}
            translateX={0}
            translateY={0}
            mapWidth={1}
            mapHeight={1}
            isEditMode={true}
          />
        </Pressable>
      ))}
    </View>
  );
}
