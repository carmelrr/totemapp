// components/map/WallMap.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useWallTransform } from '@/hooks/useWallTransform';
import WallMapSVG from '@/assets/WallMapSVG';

interface RoutePoint {
    id: string;
    x: number;
    y: number;
    color?: string;
    [key: string]: any;
}

interface WallMapProps {
    children?: React.ReactNode;
    wallWidth: number;
    wallHeight: number;
    routes?: RoutePoint[];
    onTransformChange?: (scale: number, tx: number, ty: number) => void;
    onRoutePress?: (route: RoutePoint) => void;
    onDoubleTap?: () => void;
    onLongPress?: (coordinates: { x: number; y: number }) => void;
    onLayout?: (viewW: number, viewH: number) => void;
}

/**
 * תצוגת מפה עם Pinch/Pan (Reanimated+Gesture Handler)
 * מפה פשוטה עם זום ופאן, ללא מסלולים
 */
export default function WallMap({
    children,
    wallWidth,
    wallHeight,
    routes = [],
    onTransformChange,
    onRoutePress,
    onDoubleTap,
    onLongPress,
    onLayout,
}: WallMapProps) {
    const [containerDimensions, setContainerDimensions] = useState({
        width: 0,
        height: 0,
    });

    const [imageDimensions, setImageDimensions] = useState({
        imgW: 0,
        imgH: 0,
    });

    // חישוב מידות התמונה בהתאם לאספקט רטיו של הקיר
    const wallAspectRatio = wallHeight / wallWidth;

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;

        if (width !== containerDimensions.width || height !== containerDimensions.height) {
            setContainerDimensions({ width, height });

            // חישוב מידות התמונה בהתאם לקונטיינר
            let imgW = width;
            let imgH = width * wallAspectRatio;

            // אם הגובה חורג מהקונטיינר, התאם לפי גובה
            if (imgH > height) {
                imgH = height;
                imgW = height / wallAspectRatio;
            }

            setImageDimensions({ imgW, imgH });

            // דיווח על מידות למסך הראשי
            onLayout?.(width, height);
        }
    }, [containerDimensions, wallAspectRatio, onLayout]);

    // חישוב minScale - הגודל ההתחלתי שמתאים למסגרת
    const minScale = useMemo(() => {
        if (containerDimensions.width === 0 || imageDimensions.imgW === 0) {
            return 1;
        }
        // התאמה למסגרת - המפה תמלא את המסגרת ללא גלישה
        const scaleX = containerDimensions.width / imageDimensions.imgW;
        const scaleY = containerDimensions.height / imageDimensions.imgH;
        // בחירת הקנה מידה הקטן יותר כדי שהמפה תתאים למסגרת
        return Math.min(scaleX, scaleY) * 0.95; // 95% מהמסגרת כדי להשאיר מעט מרווח
    }, [containerDimensions, imageDimensions]);

    const transforms = useWallTransform({
        minScale,
        maxScale: 4,
        viewW: containerDimensions.width,
        viewH: containerDimensions.height,
        imgW: imageDimensions.imgW,
        imgH: imageDimensions.imgH,
        onTransformChange,
    });

    const isReady = containerDimensions.width > 0 && imageDimensions.imgW > 0;

    if (!isReady) {
        return (
            <View style={styles.container} onLayout={handleLayout}>
                <View style={styles.loadingContainer} />
            </View>
        );
    }

    return (
        <View style={styles.container} onLayout={handleLayout}>
            <GestureDetector gesture={transforms.composedGestures}>
                <Animated.View style={styles.gestureContainer}>
                    <Animated.View style={[styles.mapContainer, transforms.animatedStyle]}>
                        {/* תמונת הקיר */}
                        <WallMapSVG
                            width={imageDimensions.imgW}
                            height={imageDimensions.imgH}
                            preserveAspectRatio="xMidYMid meet"
                        />

                        {/* נקודות המסלולים */}
                        {routes.map((route) => {
                            const routeX = (route.x / wallWidth) * imageDimensions.imgW;
                            const routeY = (route.y / wallHeight) * imageDimensions.imgH;

                            return (
                                <Animated.View
                                    key={route.id}
                                    style={[
                                        styles.routePoint,
                                        {
                                            left: routeX - 15,
                                            top: routeY - 15,
                                            backgroundColor: route.color || '#ff6b6b',
                                        }
                                    ]}
                                    onTouchEnd={() => onRoutePress?.(route)}
                                />
                            );
                        })}

                        {/* תוכן נוסף */}
                        {children}
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        // המפה תמלא את כל המקום הפנוי במסגרת
        width: '100%',
        height: '100%',
    },
    gestureContainer: {
        flex: 1,
    },
    mapContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#e5e5e5',
    },
    routePoint: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
});
