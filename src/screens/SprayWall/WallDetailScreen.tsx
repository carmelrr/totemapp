// src/screens/SprayWall/WallDetailScreen.tsx
// Main Spray Wall screen showing the wall with its routes

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useWalls } from "@/features/walls/hooks";
import { useRoutesForWall } from "@/features/spraywall/hooks";
import { WallImageWithHolds } from "@/components/spray/WallImageWithHolds";
import { SprayRoute } from "@/features/spraywall/types";
import { useAdmin } from "@/context/AdminContext";
import * as ImagePicker from "expo-image-picker";
import { updateWallImage } from "@/features/walls/wallsService";
import { deleteAllRoutesForWall } from "@/features/spraywall/routesService";

export const WallDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAdmin, adminModeEnabled } = useAdmin();

  // Get walls and use the first one (Spray Wall has only one wall)
  const { walls, loading: wallsLoading } = useWalls();
  const wall = walls.length > 0 ? walls[0] : null;
  const wallId = wall?.id;

  const { routes, loading: routesLoading } = useRoutesForWall(wallId || "");

  const [selectedRoute, setSelectedRoute] = useState<SprayRoute | null>(null);
  const [updatingWall, setUpdatingWall] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const handleAddRoute = () => {
    if (!wallId) return;
    navigation.navigate("AddRoute", { wallId });
  };

  // Navigate to route details screen
  const handleRoutePress = (routeItem: SprayRoute) => {
    navigation.navigate("SprayRouteDetail", { 
      sprayRoute: routeItem, 
      wallId 
    });
  };

  // Toggle route preview on long press
  const handleRouteLongPress = (routeItem: SprayRoute) => {
    if (selectedRoute?.id === routeItem.id) {
      setSelectedRoute(null);
    } else {
      setSelectedRoute(routeItem);
    }
  };

  // Admin function to reset all routes (without changing wall image)
  const handleResetAllRoutes = () => {
    if (!isAdmin || !wallId) return;

    Alert.alert(
      "איפוס כל המסלולים",
      `⚠️ שים לב: פעולה זו תמחק את כל ${routes.length} המסלולים מהספריי וואל!\n\nהתמונה תישאר.\n\nהאם להמשיך?`,
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק הכל",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingWall(true);
              await deleteAllRoutesForWall(wallId);
              setSelectedRoute(null);
              Alert.alert("הצלחה", "כל המסלולים נמחקו בהצלחה");
            } catch (error) {
              console.error("Error deleting all routes:", error);
              Alert.alert("שגיאה", "לא הצלחנו למחוק את המסלולים");
            } finally {
              setUpdatingWall(false);
            }
          },
        },
      ]
    );
  };

  // Admin function to change wall image
  const handleChangeWallImage = async () => {
    if (!isAdmin) return;

    Alert.alert(
      "שינוי תמונת קיר",
      "⚠️ שים לב: שינוי תמונת הקיר ימחק את כל המסלולים הקיימים!\n\nהאם להמשיך?",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "המשך",
          style: "destructive",
          onPress: pickNewImage,
        },
      ]
    );
  };

  const pickNewImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUpdatingWall(true);
        await updateWallImage(wallId, result.assets[0].uri, true);
        Alert.alert("הצלחה", "תמונת הקיר עודכנה וכל המסלולים נמחקו");
        setSelectedRoute(null);
      }
    } catch (error) {
      console.error("Error updating wall image:", error);
      Alert.alert("שגיאה", "לא הצלחנו לעדכן את תמונת הקיר");
    } finally {
      setUpdatingWall(false);
    }
  };

  const renderRouteItem = ({ item }: { item: SprayRoute }) => {
    const isSelected = selectedRoute?.id === item.id;
    const displayGrade = item.calculatedGrade || item.grade;
    const averageRating = item.averageStarRating || 0;
    
    return (
      <TouchableOpacity
        style={[styles.routeItem, isSelected && styles.routeItemSelected]}
        onPress={() => handleRoutePress(item)}
        onLongPress={() => handleRouteLongPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.routeInfo}>
          <Text style={[styles.routeName, isSelected && styles.routeNameSelected]}>
            {item.name}
          </Text>
          <View style={styles.routeMeta}>
            <Text style={styles.routeGrade}>{displayGrade}</Text>
            {averageRating > 0 && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingStar}>⭐</Text>
                <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
              </View>
            )}
            {(item.topsCount || 0) > 0 && (
              <Text style={styles.topsCount}>🏆 {item.topsCount}</Text>
            )}
          </View>
        </View>
        <Text style={styles.holdCount}>{item.holds?.length || 0} אחיזות</Text>
      </TouchableOpacity>
    );
  };

  if (wallsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E4EC6" />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  // No wall exists yet - show empty state with option to add wall (admin only)
  if (!wall) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🧗‍♂️</Text>
        <Text style={styles.emptyText}>אין קיר עדיין</Text>
        {isAdmin && adminModeEnabled && (
          <TouchableOpacity 
            style={styles.addWallButton} 
            onPress={() => navigation.navigate("AddWall")}
          >
            <Text style={styles.addWallButtonText}>+ הוסף קיר</Text>
          </TouchableOpacity>
        )}
        {(!isAdmin || !adminModeEnabled) && (
          <Text style={styles.emptySubtext}>רק מנהל במצב עריכה יכול להוסיף קיר</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Wall Image with Selected Route's Holds */}
      <View style={styles.imageContainer}>
        <WallImageWithHolds
          imageUrl={wall.imageUrl}
          holds={selectedRoute?.holds || []}
          routeColor={selectedRoute?.color || "#FF4444"}
          editable={false}
        />
        {selectedRoute && (
          <View style={styles.selectedRouteOverlay}>
            <Text style={styles.selectedRouteText}>
              {selectedRoute.name} • {selectedRoute.calculatedGrade || selectedRoute.grade}
            </Text>
            <TouchableOpacity 
              style={styles.openRouteButton}
              onPress={() => handleRoutePress(selectedRoute)}
            >
              <Text style={styles.openRouteButtonText}>פתח פרטים →</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Admin edit mode toggle */}
        {isAdmin && adminModeEnabled && (
          <TouchableOpacity 
            style={[styles.editModeButton, editMode && styles.editModeButtonActive]}
            onPress={() => setEditMode(!editMode)}
          >
            <Text style={styles.editModeButtonText}>{editMode ? '✓ עריכה' : '✏️'}</Text>
          </TouchableOpacity>
        )}
        
        {/* Admin button to change wall image - only in edit mode */}
        {isAdmin && adminModeEnabled && editMode && (
          <TouchableOpacity 
            style={styles.changeWallButton}
            onPress={handleChangeWallImage}
            disabled={updatingWall}
          >
            {updatingWall ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.changeWallButtonText}>🔄 שנה תמונה</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Admin actions bar - only in edit mode */}
      {isAdmin && adminModeEnabled && editMode && routes.length > 0 && (
        <View style={styles.adminActionsBar}>
          <TouchableOpacity 
            style={styles.resetRoutesButton}
            onPress={handleResetAllRoutes}
            disabled={updatingWall}
          >
            <Text style={styles.resetRoutesButtonText}>🗑️ מחק את כל המסלולים ({routes.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Routes List */}
      <View style={styles.routesSection}>
        <View style={styles.routesHeader}>
          <Text style={styles.routesTitle}>מסלולים ({routes.length})</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddRoute}>
            <Text style={styles.addButtonText}>+ הוסף מסלול</Text>
          </TouchableOpacity>
        </View>

        {routesLoading ? (
          <View style={styles.routesLoading}>
            <ActivityIndicator size="small" color="#8E4EC6" />
          </View>
        ) : routes.length === 0 ? (
          <View style={styles.emptyRoutes}>
            <Text style={styles.emptyRoutesText}>אין מסלולים עדיין</Text>
            <TouchableOpacity onPress={handleAddRoute}>
              <Text style={styles.emptyRoutesLink}>הוסף מסלול ראשון →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={routes}
            keyExtractor={(item) => item.id || item.name}
            renderItem={renderRouteItem}
            contentContainerStyle={styles.routesList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  imageContainer: {
    height: 300,
    position: "relative",
  },
  selectedRouteOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedRouteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  routesSection: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 16,
  },
  routesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  routesTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  addButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  routesList: {
    padding: 16,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  routeItemSelected: {
    borderColor: "#8E4EC6",
    backgroundColor: "#4a3a5a",
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  routeNameSelected: {
    color: "#8E4EC6",
  },
  routeGrade: {
    color: "#8E4EC6",
    fontSize: 14,
    fontWeight: "600",
  },
  holdCount: {
    color: "#666",
    fontSize: 12,
  },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 12,
    marginLeft: 2,
  },
  topsCount: {
    color: "#4CAF50",
    fontSize: 12,
  },
  openRouteButton: {
    marginTop: 8,
    backgroundColor: "#8E4EC6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  openRouteButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  changeWallButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeWallButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  editModeButton: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(100,100,100,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editModeButtonActive: {
    backgroundColor: "rgba(142,78,198,0.9)",
  },
  editModeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  routesLoading: {
    padding: 40,
    alignItems: "center",
  },
  emptyRoutes: {
    padding: 40,
    alignItems: "center",
  },
  emptyRoutesText: {
    color: "#888",
    fontSize: 16,
  },
  emptyRoutesLink: {
    color: "#8E4EC6",
    fontSize: 14,
    marginTop: 8,
  },
  // Empty state styles (no wall)
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#888",
    fontSize: 14,
    marginTop: 8,
  },
  addWallButton: {
    backgroundColor: "#8E4EC6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  addWallButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
    marginTop: 12,
  },
  // Admin actions bar
  adminActionsBar: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
  },
  resetRoutesButton: {
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ff6b6b",
  },
  resetRoutesButtonText: {
    color: "#ff6b6b",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default WallDetailScreen;
