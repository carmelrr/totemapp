import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Defs, Mask, Rect, Circle } from "react-native-svg";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function DimOverlay({ highlightAreas = [] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="highlight-mask">
            {/* White base - what will be shown */}
            <Rect width="100%" height="100%" fill="white" />
            {/* Black circles - what will be hidden (bright spots) */}
            {highlightAreas.map((area, index) => (
              <Circle
                key={index}
                cx={area.x}
                cy={area.y}
                r={area.r + 10} // Slightly larger for better highlight effect
                fill="black"
              />
            ))}
          </Mask>
        </Defs>

        {/* Dark overlay with holes for highlights */}
        <Rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#highlight-mask)"
        />
      </Svg>

      {/* Bright highlight rings around selected holds */}
      {highlightAreas.map((area, index) => (
        <View
          key={`ring-${index}`}
          style={[
            styles.highlightRing,
            {
              left: area.x - area.r - 15,
              top: area.y - area.r - 15,
              width: (area.r + 15) * 2,
              height: (area.r + 15) * 2,
              borderRadius: area.r + 15,
            },
          ]}
          pointerEvents="none"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  highlightRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "transparent",
  },
});
