// src/components/spray/HoldMarker.tsx
// Component that represents a single hold marker on the wall image

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";

interface HoldMarkerProps {
  x: number;
  y: number;
  color?: string;
  size?: number;
  onPress?: () => void;
  selected?: boolean;
}

export const HoldMarker: React.FC<HoldMarkerProps> = ({
  x,
  y,
  color = "#FF4444",
  size = 24,
  onPress,
  selected = false,
}) => {
  const markerStyle = {
    position: "absolute" as const,
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    borderWidth: selected ? 3 : 2,
    borderColor: selected ? "#FFFFFF" : "rgba(255,255,255,0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={markerStyle}
        onPress={onPress}
        activeOpacity={0.7}
      />
    );
  }

  return <View style={markerStyle} />;
};

export default HoldMarker;
