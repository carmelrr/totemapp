import React, { useState, useEffect, memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    runOnJS,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const HOLD_COLORS = {
    START: "#FF4444",
    TOP: "#FF4444",
    MID: "#4444FF",
    FOOT: "#FFFF44",
};

export interface SprayHoldRingProps {
    hold: {
        x: number;
        y: number;
        r: number;
        type?: 'START' | 'TOP' | 'MID' | 'FOOT';
    };
    imageWidth: number;
    imageHeight: number;
    isSelected?: boolean;
    onUpdate?: (hold: { x: number; y: number; r: number }) => void;
    onSelect?: () => void;
    showTapes?: boolean;
    showNumber?: boolean;
    holdNumber?: number;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    globalEditingActive?: boolean;
    externalTranslateX?: Animated.SharedValue<number>;
    externalTranslateY?: Animated.SharedValue<number>;
    externalRadius?: Animated.SharedValue<number>;
}

/**
 * Interactive hold ring component for spray wall editing
 */
const SprayHoldRing = ({
    hold,
    imageWidth,
    imageHeight,
    isSelected = false,
    onUpdate,
    onSelect,
    showTapes = false,
    showNumber = false,
    holdNumber = 1,
    onResizeStart,
    onResizeEnd,
    globalEditingActive = false,
    externalTranslateX,
    externalTranslateY,
    externalRadius,
}: SprayHoldRingProps) => {
    const absoluteX = hold.x * imageWidth;
    const absoluteY = hold.y * imageHeight;
    const absoluteRadius = hold.r * Math.min(imageWidth, imageHeight);

    const translateX = useSharedValue(absoluteX);
    const translateY = useSharedValue(absoluteY);
    const radius = useSharedValue(absoluteRadius);
    const currentRadiusShared = useSharedValue(absoluteRadius);

    useEffect(() => {
        translateX.value = absoluteX;
        translateY.value = absoluteY;
        radius.value = absoluteRadius;
        currentRadiusShared.value = absoluteRadius;
    }, [absoluteX, absoluteY, absoluteRadius]);

    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const baseRadius = useSharedValue(absoluteRadius);
    const isResizing = useSharedValue(false);

    const clampCenterToBounds = (r: number) => {
        "worklet";
        const minX = r;
        const maxX = imageWidth - r;
        const minY = r;
        const maxY = imageHeight - r;
        if (translateX.value < minX) translateX.value = minX;
        if (translateX.value > maxX) translateX.value = maxX;
        if (translateY.value < minY) translateY.value = minY;
        if (translateY.value > maxY) translateY.value = maxY;
    };

    const panGesture = Gesture.Pan()
        .enabled(!globalEditingActive)
        .onStart(() => {
            startX.value = translateX.value;
            startY.value = translateY.value;
            if (onSelect) runOnJS(onSelect)();
        })
        .onUpdate((event) => {
            if (isResizing.value) return;
            const nx = startX.value + event.translationX;
            const ny = startY.value + event.translationY;

            const minX = radius.value;
            const maxX = imageWidth - radius.value;
            const minY = radius.value;
            const maxY = imageHeight - radius.value;

            translateX.value = Math.max(minX, Math.min(maxX, nx));
            translateY.value = Math.max(minY, Math.min(maxY, ny));
        })
        .onEnd(() => {
            if (onUpdate) {
                runOnJS(onUpdate)({
                    x: translateX.value / imageWidth,
                    y: translateY.value / imageHeight,
                    r: radius.value / Math.min(imageWidth, imageHeight),
                });
            }
        });

    const pinchGesture = Gesture.Pinch()
        .enabled(!globalEditingActive)
        .onStart(() => {
            isResizing.value = true;
            baseRadius.value = radius.value;
            if (onResizeStart) runOnJS(onResizeStart)();
        })
        .onUpdate((event) => {
            const MIN_R = 12;
            const MAX_R = Math.min(imageWidth, imageHeight) / 3;
            const nextR = Math.max(
                MIN_R,
                Math.min(MAX_R, baseRadius.value * event.scale),
            );

            radius.value = nextR;
            currentRadiusShared.value = nextR;
            clampCenterToBounds(nextR);
        })
        .onEnd(() => {
            isResizing.value = false;
            if (onResizeEnd) runOnJS(onResizeEnd)();
            if (onUpdate) {
                runOnJS(onUpdate)({
                    x: translateX.value / imageWidth,
                    y: translateY.value / imageHeight,
                    r: radius.value / Math.min(imageWidth, imageHeight),
                });
            }
        });

    const composedGestures = Gesture.Simultaneous(panGesture, pinchGesture);

    const positionStyle = useAnimatedStyle(() => {
        const currentTranslateX = externalTranslateX ? externalTranslateX.value : translateX.value;
        const currentTranslateY = externalTranslateY ? externalTranslateY.value : translateY.value;
        const currentRadius = externalRadius ? externalRadius.value : currentRadiusShared.value;

        return {
            left: currentTranslateX - currentRadius,
            top: currentTranslateY - currentRadius,
        };
    });

    const color = hold.type ? HOLD_COLORS[hold.type] : "#FF4444";
    const displayRadius = currentRadiusShared.value || absoluteRadius;

    return (
        <GestureDetector gesture={composedGestures}>
            <Animated.View
                style={[
                    {
                        position: "absolute",
                        width: displayRadius * 2,
                        height: displayRadius * 2,
                        pointerEvents: globalEditingActive ? "none" : "box-only",
                    },
                    positionStyle,
                ]}
            >
                <Svg width={displayRadius * 2} height={displayRadius * 2}>
                    <Circle
                        cx={displayRadius}
                        cy={displayRadius}
                        r={displayRadius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isSelected ? 4 : 3}
                        opacity={isSelected ? 1 : 0.8}
                    />
                </Svg>
                {showNumber && (
                    <View style={styles.numberContainer}>
                        <Text style={[styles.numberText, { color }]}>
                            {holdNumber}
                        </Text>
                    </View>
                )}
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    numberContainer: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: [{ translateX: -6 }, { translateY: -8 }],
    },
    numberText: {
        fontSize: 12,
        fontWeight: "bold",
        textAlign: "center",
    },
});

export default memo(SprayHoldRing);
