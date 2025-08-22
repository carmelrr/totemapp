import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import Svg, { Defs, Mask, Rect, Circle } from "react-native-svg";

// Create animated versions of SVG components
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function HoldRing({
  imageWidth,
  imageHeight,
  cx,
  cy,
  r,
  color,
  dimOpacity = 0.45,
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: imageWidth,
        height: imageHeight,
        pointerEvents: "box-none", // Allow gestures to pass through except for the ring area
      }}
    >
      <Svg width={imageWidth} height={imageHeight}>
        <Defs>
          <Mask id="holeMask">
            <Rect width={imageWidth} height={imageHeight} fill="white" />
            <Circle cx={cx} cy={cy} r={r} fill="black" />
          </Mask>
        </Defs>
        {/* שכבת ההכהיה עם חור */}
        <Rect
          width={imageWidth}
          height={imageHeight}
          fill={`rgba(0,0,0,${dimOpacity})`}
          mask="url(#holeMask)"
          pointerEvents="none"
        />
        {/* טבעת */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="transparent"
          stroke={color}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}
