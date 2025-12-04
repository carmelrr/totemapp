// src/components/spray/ColorPicker.tsx
// Simple color picker for route colors

import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";

const ROUTE_COLORS = [
  { name: "אדום", value: "#FF4444" },
  { name: "כחול", value: "#4488FF" },
  { name: "ירוק", value: "#44DD44" },
  { name: "צהוב", value: "#FFDD44" },
  { name: "כתום", value: "#FF8844" },
  { name: "סגול", value: "#8844FF" },
  { name: "ורוד", value: "#FF44AA" },
  { name: "לבן", value: "#FFFFFF" },
  { name: "שחור", value: "#333333" },
];

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onSelectColor,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>צבע המסלול:</Text>
      <View style={styles.colorsRow}>
        {ROUTE_COLORS.map((color) => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.colorButton,
              { backgroundColor: color.value },
              selectedColor === color.value && styles.colorButtonSelected,
            ]}
            onPress={() => onSelectColor(color.value)}
            activeOpacity={0.7}
          >
            {selectedColor === color.value && (
              <Text style={[
                styles.checkmark,
                { color: color.value === "#FFFFFF" || color.value === "#FFDD44" ? "#000" : "#fff" }
              ]}>
                ✓
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#2a2a2a",
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  colorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  colorButtonSelected: {
    borderColor: "#fff",
    borderWidth: 3,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ColorPicker;
