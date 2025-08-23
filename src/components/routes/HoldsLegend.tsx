import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";

export default function HoldsLegend() {
  const { theme } = useTheme();

  const items = [
    { label: "התחלה", color: "#4CAF50", icon: "S" },
    { label: "ביניים", color: "#2196F3", icon: "I" },
    { label: "אחיזות רגליים", color: "#FFEB3B", icon: "F" }, // Changed to yellow and renamed
    { label: "סיום", color: "#F44336", icon: "T" },
  ];

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.colorCircle, { backgroundColor: item.color }]}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <Text style={styles.labelText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: {
      alignItems: "center",
      flex: 1,
    },
    colorCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
      borderWidth: 2,
      borderColor: "#ffffff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
    },
    iconText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "bold",
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowOffset: { width: 0.5, height: 0.5 },
      textShadowRadius: 1,
    },
    labelText: {
      fontSize: 11,
      color: theme.text,
      fontWeight: "600",
      textAlign: "center",
    },
  });
