import React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    runOnJS,
    useAnimatedProps,
} from "react-native-reanimated";
import Svg, { Defs, Mask, Rect, Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface HoldRingProps {
    // Basic visual props
    imageWidth: number;
    imageHeight: number;
    cx?: number; // For static positioning
    cy?: number; // For static positioning
    r?: number; // For static radius
    color: string;
    dimOpacity?: number;

    // Interactive props (for spray mode)
    hold?: {
        x: number;
        y: number;
        r: number;
        type?: 'START' | 'TOP' | 'MID' | 'FOOT';
    };
    isSelected?: boolean;
    onUpdate?: (hold: { x: number; y: number; r: number }) => void;
    onSelect?: () => void;
    showTapes?: boolean;
    showNumber?: boolean;
    holdNumber?: number;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;

    // Gesture control
    interactive?: boolean; // If true, enables gestures
    globalEditingActive?: boolean;

    // External shared values (for advanced use)
    externalTranslateX?: Animated.SharedValue<number>;
    externalTranslateY?: Animated.SharedValue<number>;
    externalRadius?: Animated.SharedValue<number>;
}

const HOLD_COLORS = {
    START: "#FF4444",
    TOP: "#FF4444",
    MID: "#4444FF",
    FOOT: "#FFFF44",
};

/**
 * Unified HoldRing component that can work in both static (routes) and interactive (spray) modes
 */
export default function HoldRing({
    imageWidth,
    imageHeight,
    cx,
    cy,
    r,
    color,
    dimOpacity = 0.45,
    hold,
    isSelected = false,
    onUpdate,
    onSelect,
    showTapes = false,
    showNumber = false,
    holdNumber = 1,
    onResizeStart,
    onResizeEnd,
    interactive = false,
    globalEditingActive = false,
    externalTranslateX,
    externalTranslateY,
    externalRadius,
}: HoldRingProps) {

    // Determine if we're in static or interactive mode
    const isInteractive = interactive && hold;

    // Calculate position and radius
    let finalCx: number;
    let finalCy: number;
    let finalR: number;
    let finalColor: string;

    if (isInteractive && hold) {
        // Interactive mode - use hold object
        finalCx = hold.x * imageWidth;
        finalCy = hold.y * imageHeight;
        finalR = hold.r * Math.min(imageWidth, imageHeight);
        finalColor = hold.type ? HOLD_COLORS[hold.type] : color;
    } else {
        // Static mode - use direct props
        finalCx = cx || 0;
        finalCy = cy || 0;
        finalR = r || 15;
        finalColor = color;
    }

    // Interactive mode setup
    const translateX = useSharedValue(finalCx);
    const translateY = useSharedValue(finalCy);
    const radius = useSharedValue(finalR);
    const currentRadiusShared = useSharedValue(finalR);

    React.useEffect(() => {
        if (isInteractive) {
            translateX.value = finalCx;
            translateY.value = finalCy;
            radius.value = finalR;
            currentRadiusShared.value = finalR;
        }
    }, [finalCx, finalCy, finalR, isInteractive]);

    // Gesture setup for interactive mode
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const baseRadius = useSharedValue(finalR);
    const isResizing = useSharedValue(false);

    const clampCenterToBounds = (radiusValue: number) => {
        "worklet";
        const minX = radiusValue;
        const maxX = imageWidth - radiusValue;
        const minY = radiusValue;
        const maxY = imageHeight - radiusValue;
        if (translateX.value < minX) translateX.value = minX;
        if (translateX.value > maxX) translateX.value = maxX;
        if (translateY.value < minY) translateY.value = minY;
        if (translateY.value > maxY) translateY.value = maxY;
    };

    const panGesture = Gesture.Pan()
        .enabled(isInteractive && !globalEditingActive)
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
        .enabled(isInteractive && !globalEditingActive)
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
        if (!isInteractive) {
            return {}; // Static positioning
        }

        return {
            transform: [
                {
                    translateX:
                        (externalTranslateX ? externalTranslateX.value : translateX.value) -
                        (externalRadius ? externalRadius.value : currentRadiusShared.value),
                } as const,
                {
                    translateY:
                        (externalTranslateY ? externalTranslateY.value : translateY.value) -
                        (externalRadius ? externalRadius.value : currentRadiusShared.value),
                } as const,
            ],
        };
    });

    const animatedProps = useAnimatedProps(() => {
        if (!isInteractive) {
            return {
                cx: finalCx,
                cy: finalCy,
                r: finalR,
            };
        }

        return {
            cx: externalTranslateX ? externalTranslateX.value : translateX.value,
            cy: externalTranslateY ? externalTranslateY.value : translateY.value,
            r: externalRadius ? externalRadius.value : currentRadiusShared.value,
        };
    });

    if (isInteractive) {
        // Interactive mode - render with gestures
        return (
            <GestureDetector gesture={composedGestures}>
                <Animated.View
                    style={[
                        {
                            position: "absolute",
                            width: finalR * 2,
                            height: finalR * 2,
                            pointerEvents: globalEditingActive ? "none" : "box-only",
                        },
                        positionStyle,
                    ]}
                >
                    <Svg width={finalR * 2} height={finalR * 2}>
                        <AnimatedCircle
                            animatedProps={animatedProps}
                            fill="transparent"
                            stroke={finalColor}
                            strokeWidth={isSelected ? 4 : 3}
                            opacity={isSelected ? 1 : 0.8}
                        />
                        {showNumber && (
                            <text
                                x={finalR}
                                y={finalR + 4}
                                fontSize="12"
                                fill={finalColor}
                                textAnchor="middle"
                            >
                                {holdNumber}
                            </text>
                        )}
                    </Svg>
                </Animated.View>
            </GestureDetector>
        );
    } else {
        // Static mode - simple display
        return (
            <View
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: imageWidth,
                    height: imageHeight,
                    pointerEvents: "box-none",
                }}
            >
                <Svg width={imageWidth} height={imageHeight}>
                    <Defs>
                        <Mask id="holeMask">
                            <Rect width={imageWidth} height={imageHeight} fill="white" />
                            <Circle cx={finalCx} cy={finalCy} r={finalR} fill="black" />
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
                        cx={finalCx}
                        cy={finalCy}
                        r={finalR}
                        fill="transparent"
                        stroke={finalColor}
                        strokeWidth={3}
                    />
                </Svg>
            </View>
        );
    }
}
