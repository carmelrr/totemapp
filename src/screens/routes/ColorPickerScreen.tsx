import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from "react-native";
import { THEME_COLORS } from "@/constants/colors";

interface ColorPickerScreenProps {
  route: {
    params?: {
      onColorSelect?: (color: string) => void;
      selectedColor?: string;
    };
  };
  navigation: any;
}

const AVAILABLE_COLORS = [
  { name: "אדום", value: "#FF0000" },
  { name: "כחול", value: "#0000FF" },
  { name: "ירוק", value: "#00FF00" },
  { name: "צהוב", value: "#FFFF00" },
  { name: "סגול", value: "#800080" },
  { name: "כתום", value: "#FFA500" },
  { name: "ורוד", value: "#FFC0CB" },
  { name: "חום", value: "#A52A2A" },
  { name: "שחור", value: "#000000" },
  { name: "לבן", value: "#FFFFFF" },
  { name: "אפור", value: "#808080" },
  { name: "טורקיז", value: "#40E0D0" },
];

const ColorPickerScreen: React.FC<ColorPickerScreenProps> = ({
  route,
  navigation,
}) => {
  const [selectedColor, setSelectedColor] = useState(
    route.params?.selectedColor || "",
  );
  const onColorSelect = route.params?.onColorSelect;

  const handleColorSelect = (color: { name: string; value: string }) => {
    setSelectedColor(color.value);
    if (onColorSelect) {
      onColorSelect(color.name);
    }
    navigation.goBack();
  };

  const renderColorItem = ({
    item,
  }: {
    item: { name: string; value: string };
  }) => (
    <TouchableOpacity
      style={[
        styles.colorItem,
        { backgroundColor: item.value },
        selectedColor === item.value && styles.selectedColorItem,
      ]}
      onPress={() => handleColorSelect(item)}
    >
      <View style={styles.colorOverlay}>
        <Text
          style={[
            styles.colorName,
            {
              color:
                item.value === "#FFFFFF" || item.value === "#FFFF00"
                  ? "#000"
                  : "#FFF",
            },
          ]}
        >
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>בחירת צבע</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>בחר צבע עבור הקו החדש:</Text>

        <FlatList
          data={AVAILABLE_COLORS}
          renderItem={renderColorItem}
          keyExtractor={(item) => item.value}
          numColumns={2}
          contentContainerStyle={styles.colorGrid}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME_COLORS.text,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: THEME_COLORS.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  instruction: {
    fontSize: 16,
    color: THEME_COLORS.text,
    marginBottom: 20,
    textAlign: "center",
  },
  colorGrid: {
    paddingBottom: 20,
  },
  colorItem: {
    flex: 1,
    margin: 8,
    height: 80,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedColorItem: {
    borderColor: THEME_COLORS.primary,
    borderWidth: 3,
  },
  colorOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  colorName: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default ColorPickerScreen;
