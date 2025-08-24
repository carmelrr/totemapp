// components/ui/FloatingPanel.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { THEME_COLORS } from "@/constants/colors";

interface FloatingPanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
  position?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  children,
  style,
  position = "top-right",
}) => {
  const positionStyle = getPositionStyle(position);

  return (
    <View style={[styles.panel, positionStyle, style]} pointerEvents="box-none">
      {children}
    </View>
  );
};

function getPositionStyle(position: string): ViewStyle {
  switch (position) {
    case "top-left":
      return { top: 60, left: 16 };
    case "top-right":
      return { top: 60, right: 16 };
    case "bottom-left":
      return { bottom: 100, left: 16 };
    case "bottom-right":
      return { bottom: 100, right: 16 };
    case "center":
      return {
        top: "50%",
        left: "50%",
        transform: [{ translateX: -50 }, { translateY: -50 }],
      };
    default:
      return { top: 60, right: 16 };
  }
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: THEME_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
});
