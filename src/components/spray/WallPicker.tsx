// src/components/spray/WallPicker.tsx
// Component for selecting a wall from the list

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { Wall } from "@/features/spraywall/types";

interface WallPickerProps {
  walls: Wall[];
  selectedWallId: string | null;
  onSelectWall: (wall: Wall) => void;
  loading?: boolean;
}

export const WallPicker: React.FC<WallPickerProps> = ({
  walls,
  selectedWallId,
  onSelectWall,
  loading = false,
}) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#8E4EC6" />
        <Text style={styles.loadingText}>טוען קירות...</Text>
      </View>
    );
  }

  if (walls.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>אין קירות זמינים</Text>
      </View>
    );
  }

  const renderWallItem = ({ item }: { item: Wall }) => {
    const isSelected = item.id === selectedWallId;

    return (
      <TouchableOpacity
        style={[styles.wallItem, isSelected && styles.wallItemSelected]}
        onPress={() => onSelectWall(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.wallThumbnail}
          resizeMode="cover"
        />
        <View style={styles.wallInfo}>
          <Text style={[styles.wallName, isSelected && styles.wallNameSelected]}>
            {item.name}
          </Text>
          <Text style={styles.wallDimensions}>
            {item.width}m × {item.height}m
          </Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>בחר קיר:</Text>
      <FlatList
        data={walls}
        keyExtractor={(item) => item.id || item.name}
        renderItem={renderWallItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#2a2a2a",
    paddingVertical: 12,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 12,
  },
  wallItem: {
    marginHorizontal: 4,
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    overflow: "hidden",
    width: 140,
    borderWidth: 2,
    borderColor: "transparent",
  },
  wallItemSelected: {
    borderColor: "#8E4EC6",
  },
  wallThumbnail: {
    width: "100%",
    height: 80,
  },
  wallInfo: {
    padding: 8,
  },
  wallName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  wallNameSelected: {
    color: "#8E4EC6",
  },
  wallDimensions: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#8E4EC6",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    color: "#888",
    marginTop: 8,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#888",
    fontSize: 14,
  },
});

export default WallPicker;
