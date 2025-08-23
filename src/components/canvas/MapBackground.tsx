// components/MapBackground.js
import React from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated from "react-native-reanimated";
import WallMapSVG from "@/assets/WallMapSVG";

const window = Dimensions.get("window");
const MAP_WIDTH = window.width;
const MAP_HEIGHT = window.width * 0.65;

export default function MapBackground({ combinedStyle }) {
  return (
    <Animated.View style={[styles.mapWrapper, combinedStyle]}>
      <WallMapSVG width={MAP_WIDTH} height={MAP_HEIGHT} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
  },
});
