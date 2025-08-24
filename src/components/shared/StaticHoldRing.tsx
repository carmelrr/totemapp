import React from "react";
import { View } from "react-native";
import Svg, { Defs, Mask, Rect, Circle } from "react-native-svg";

export interface StaticHoldRingProps {
    imageWidth: number;
    imageHeight: number;
    cx: number;
    cy: number;
    r: number;
    color: string;
    dimOpacity?: number;
}

/**
 * Simple static hold ring component for routes visualization
 * Creates a ring with dimming effect - used for highlighting specific areas
 */
export default function StaticHoldRing({
    imageWidth,
    imageHeight,
    cx,
    cy,
    r,
    color,
    dimOpacity = 0.45,
}: StaticHoldRingProps) {
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
                {/* Dimming layer with hole */}
                <Rect
                    width={imageWidth}
                    height={imageHeight}
                    fill={`rgba(0,0,0,${dimOpacity})`}
                    mask="url(#holeMask)"
                    pointerEvents="none"
                />
                {/* Ring */}
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
