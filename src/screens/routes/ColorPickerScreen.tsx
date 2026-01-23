import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";

interface ColorPickerScreenProps {
  route: {
    params?: {
      onColorSelect?: (color: string) => void;
      selectedColor?: string;
    };
  };
  navigation: any;
}

const ColorPickerScreen: React.FC<ColorPickerScreenProps> = ({
  route,
  navigation,
}) => {
  const { t, isLoading: languageLoading } = useLanguage();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const AVAILABLE_COLORS = useMemo(() => [
    { name: t.colors?.red ?? 'Red', value: "#FF0000" },
    { name: t.colors?.blue ?? 'Blue', value: "#0000FF" },
    { name: t.colors?.green ?? 'Green', value: "#00FF00" },
    { name: t.colors?.yellow ?? 'Yellow', value: "#FFFF00" },
    { name: t.colors?.purple ?? 'Purple', value: "#800080" },
    { name: t.colors?.orange ?? 'Orange', value: "#FFA500" },
    { name: t.colors?.pink ?? 'Pink', value: "#FFC0CB" },
    { name: t.colors?.brown ?? 'Brown', value: "#A52A2A" },
    { name: t.colors?.black ?? 'Black', value: "#000000" },
    { name: t.colors?.white ?? 'White', value: "#FFFFFF" },
    { name: t.colors?.gray ?? 'Gray', value: "#808080" },
    { name: t.colors?.turquoise ?? 'Turquoise', value: "#40E0D0" },
  ], [t.colors]);
  
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

// Dynamic styles factory for theme support
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.text,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  instruction: {
    fontSize: 16,
    color: theme.text,
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
    borderColor: theme.primary,
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
