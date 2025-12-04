// src/screens/SprayWall/SprayWallHomeScreen.tsx
// Main screen for the Spray Wall feature

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useWalls } from "@/features/walls/hooks";
import { useAdmin } from "@/context/AdminContext";
import { Wall } from "@/features/spraywall/types";

export const SprayWallHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { walls, loading } = useWalls();
  const { isAdmin } = useAdmin();

  const handleWallPress = (wall: Wall) => {
    navigation.navigate("WallDetail", { wallId: wall.id, wallName: wall.name });
  };

  const handleAddWall = () => {
    navigation.navigate("AddWall");
  };

  const handleAddRoute = () => {
    navigation.navigate("AddRoute");
  };

  const renderWallCard = ({ item }: { item: Wall }) => (
    <TouchableOpacity
      style={styles.wallCard}
      onPress={() => handleWallPress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.wallImage}
        resizeMode="cover"
      />
      <View style={styles.wallOverlay}>
        <Text style={styles.wallName}>{item.name}</Text>
        <Text style={styles.wallDimensions}>
          {item.width}m × {item.height}m
        </Text>
        {!item.isPublic && (
          <View style={styles.privateBadge}>
            <Text style={styles.privateBadgeText}>פרטי</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E4EC6" />
        <Text style={styles.loadingText}>טוען קירות...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with actions */}
      <View style={styles.header}>
        <Text style={styles.title}>Spray Wall</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.addRouteButton} onPress={handleAddRoute}>
            <Text style={styles.addRouteButtonText}>+ מסלול</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.addWallButton} onPress={handleAddWall}>
              <Text style={styles.addWallButtonText}>+ קיר</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Single Wall view: show the first wall only (spray wall supports one active wall) */}
      {walls.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🧗‍♂️</Text>
          <Text style={styles.emptyText}>אין קירות עדיין</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddWall}>
              <Text style={styles.emptyButtonText}>הוסף קיר ראשון</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // display only the primary wall (first in list)
        <View style={styles.listContent}>
          {renderWallCard({ item: walls[0] })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#2a2a2a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  addRouteButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addRouteButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  addWallButton: {
    backgroundColor: "#8E4EC6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addWallButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  loadingText: {
    color: "#888",
    marginTop: 12,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  wallCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#2a2a2a",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  wallImage: {
    width: "100%",
    height: 200,
  },
  wallOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  wallName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  wallDimensions: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 4,
  },
  privateBadge: {
    position: "absolute",
    top: -180,
    right: 12,
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privateBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: "#888",
    fontSize: 18,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#8E4EC6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SprayWallHomeScreen;
