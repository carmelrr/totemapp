// src/screens/SprayWall/WallDetailScreen.tsx
// Main Spray Wall screen showing the wall with its routes

import React, { useState, useMemo } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useWalls } from "@/features/walls/hooks";
import { useRoutesForWall } from "@/features/spraywall/hooks";
import { WallImageWithHolds } from "@/components/spray/WallImageWithHolds";
import { SprayRoute } from "@/features/spraywall/types";
import { useAdmin } from "@/context/AdminContext";
import { useRolesContext } from "@/features/roles";
import { useLanguage } from "@/features/language";
import { useTheme } from "@/features/theme/ThemeContext";
import * as ImagePicker from "expo-image-picker";
import { updateWallImage } from "@/features/walls/wallsService";

export const WallDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAdmin, adminModeEnabled } = useAdmin();
  const { canEditRoutes, isRouteSetter } = useRolesContext();
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => createStyles(theme), [theme]);
  
  // Edit mode is enabled when admin mode is on OR route setter has toggled it
  const [routeSetterEditMode, setRouteSetterEditMode] = useState(false);
  const editModeEnabled = adminModeEnabled || (isRouteSetter && routeSetterEditMode);
  const canAccessEditMode = isAdmin || canEditRoutes;

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

  // Admin function to change wall image
  const handleChangeWallImage = async () => {
    if (!isAdmin) return;

    Alert.alert(
      t.spray.changeWallImage,
      t.spray.changeWallWarning,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.common.continue || "Continue",
          style: "destructive",
          onPress: pickNewImage,
        },
      ]
    );
  };

  const pickNewImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUpdatingWall(true);
        await updateWallImage(wallId, result.assets[0].uri, true);
        Alert.alert(t.common.success, t.spray.wallImageUpdated);
        setSelectedRoute(null);
      }
    } catch (error) {
      console.error("Error updating wall image:", error);
      Alert.alert(t.common.error, t.spray.failedToUpdateWall);
    } finally {
      setUpdatingWall(false);
    }
  };

  const renderRouteItem = ({ item }: { item: SprayRoute }) => {
    const isSelected = selectedRoute?.id === item.id;
    const displayGrade = item.calculatedGrade || item.grade;
    const averageRating = item.averageStarRating || 0;
    
    // Render stars for rating display (like routes map)
    const renderStars = (rating: number) => {
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        stars.push(
          <Text 
            key={i} 
            style={[
              dynamicStyles.starIcon, 
              i <= rating && dynamicStyles.starFilled
            ]}
          >
            ★
          </Text>
        );
      }
      return stars;
    };
    
    return (
      <TouchableOpacity
        style={[dynamicStyles.routeItem, isSelected && dynamicStyles.routeItemSelected]}
        onPress={() => handleRoutePress(item)}
        onLongPress={() => handleRouteLongPress(item)}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.routeInfo}>
          <Text style={[dynamicStyles.routeName, isSelected && dynamicStyles.routeNameSelected]}>
            {item.name}
          </Text>
          <View style={dynamicStyles.routeMeta}>
            <Text style={dynamicStyles.routeGrade}>{displayGrade}</Text>
            {averageRating > 0 && (
              <View style={dynamicStyles.ratingBadge}>
                <View style={dynamicStyles.starsRow}>
                  {renderStars(Math.round(averageRating))}
                </View>
                <Text style={dynamicStyles.ratingText}>({averageRating.toFixed(1)})</Text>
              </View>
            )}
            {(item.topsCount || 0) > 0 && (
              <Text style={dynamicStyles.topsCount}>🏆 {item.topsCount}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (wallsLoading) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color="#8E4EC6" />
        <Text style={dynamicStyles.loadingText}>{t.spray.loading}</Text>
      </SafeAreaView>
    );
  }

  // No wall exists yet - show empty state with option to add wall (admin only)
  if (!wall) {
    return (
      <SafeAreaView style={dynamicStyles.emptyContainer} edges={["top"]}>
        <Text style={dynamicStyles.emptyIcon}>🧗‍♂️</Text>
        <Text style={dynamicStyles.emptyText}>{t.spray.noWallYet}</Text>
        {isAdmin && adminModeEnabled && (
          <TouchableOpacity 
            style={dynamicStyles.addWallButton} 
            onPress={() => navigation.navigate("AddWall")}
          >
            <Text style={dynamicStyles.addWallButtonText}>{t.spray.addWall}</Text>
          </TouchableOpacity>
        )}
        {(!isAdmin || !adminModeEnabled) && (
          <Text style={dynamicStyles.emptySubtext}>{t.spray.onlyAdminCanAddWall}</Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={["top"]}>
      {/* Wall Image with Selected Route's Holds */}
      <View style={dynamicStyles.imageContainer}>
        <WallImageWithHolds
          imageUrl={wall.imageUrl}
          holds={selectedRoute?.holds || []}
          routeColor={selectedRoute?.color || "#FF4444"}
          editable={false}
        />
        {selectedRoute && (
          <View style={dynamicStyles.selectedRouteOverlay}>
            <Text style={dynamicStyles.selectedRouteText}>
              {selectedRoute.name} • {selectedRoute.calculatedGrade || selectedRoute.grade}
            </Text>
            <TouchableOpacity 
              style={dynamicStyles.openRouteButton}
              onPress={() => handleRoutePress(selectedRoute)}
            >
              <Text style={dynamicStyles.openRouteButtonText}>{t.spray.openDetails}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Edit mode toggle - available for admins and route setters */}
        {canAccessEditMode && editModeEnabled && (
          <TouchableOpacity 
            style={[dynamicStyles.editModeButton, editMode && dynamicStyles.editModeButtonActive]}
            onPress={() => setEditMode(!editMode)}
          >
            <Text style={dynamicStyles.editModeButtonText}>{editMode ? t.spray.editing : '✏️'}</Text>
          </TouchableOpacity>
        )}
        
        {/* Admin button to change wall image - only for full admins in edit mode */}
        {isAdmin && adminModeEnabled && editMode && (
          <TouchableOpacity 
            style={dynamicStyles.changeWallButton}
            onPress={handleChangeWallImage}
            disabled={updatingWall}
          >
            {updatingWall ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={dynamicStyles.changeWallButtonText}>🔄 {t.spray.changeWallImage}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Routes List */}
      <View style={dynamicStyles.routesSection}>
        <View style={dynamicStyles.routesHeader}>
          <Text style={dynamicStyles.routesTitle}>{t.routes.title} ({routes.length})</Text>
          <TouchableOpacity style={dynamicStyles.addButton} onPress={handleAddRoute}>
            <Text style={dynamicStyles.addButtonText}>+ {t.spray.createRoute}</Text>
          </TouchableOpacity>
        </View>

        {routesLoading ? (
          <View style={dynamicStyles.routesLoading}>
            <ActivityIndicator size="small" color="#8E4EC6" />
          </View>
        ) : routes.length === 0 ? (
          <View style={dynamicStyles.emptyRoutes}>
            <Text style={dynamicStyles.emptyRoutesText}>{t.routes.noRoutes}</Text>
            <TouchableOpacity onPress={handleAddRoute}>
              <Text style={dynamicStyles.emptyRoutesLink}>{t.spray.createRoute} →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={routes}
            keyExtractor={(item) => item.id || item.name}
            renderItem={renderRouteItem}
            contentContainerStyle={dynamicStyles.routesList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background,
  },
  imageContainer: {
    flex: 1,
    minHeight: 200,
    maxHeight: '50%', // Responsive height
    position: "relative",
  },
  selectedRouteOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: theme.isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.6)",
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
    backgroundColor: theme.surface,
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
    borderBottomColor: theme.border,
  },
  routesTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  addButton: {
    backgroundColor: theme.success,
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
    backgroundColor: theme.isDark ? "#3a3a3a" : "#f0f0f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  routeItemSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.isDark ? "#4a3a5a" : "#e8e0f0",
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
    color: theme.text,
    fontSize: 16,
    fontWeight: "500",
  },
  routeNameSelected: {
    color: theme.primary,
  },
  routeGrade: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  holdCount: {
    color: theme.textSecondary,
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
  starsRow: {
    flexDirection: "row",
  },
  starIcon: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  starFilled: {
    color: theme.starColor,
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingText: {
    color: theme.starColor,
    fontSize: 12,
    marginLeft: 2,
  },
  topsCount: {
    color: theme.success,
    fontSize: 12,
  },
  openRouteButton: {
    marginTop: 8,
    backgroundColor: theme.primary,
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
    color: theme.textSecondary,
    fontSize: 16,
  },
  emptyRoutesLink: {
    color: theme.primary,
    fontSize: 14,
    marginTop: 8,
  },
  // Empty state styles (no wall)
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background,
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  addWallButton: {
    backgroundColor: theme.primary,
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
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
});

export default WallDetailScreen;
