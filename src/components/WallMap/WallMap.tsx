import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { runOnJS } from 'react-native-reanimated';
import { 
  PanGestureHandler, 
  PinchGestureHandler, 
  TapGestureHandler,
  LongPressGestureHandler 
} from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useMapTransforms } from '@/hooks/useMapTransforms';
import { RouteDoc } from '@/features/routes-map/types/route';
import WallMapSVG from '@/assets/WallMapSVG';
import RouteCircle from './RouteCircle';

interface WallMapProps {
  routes: RouteDoc[];
  wallWidth: number;
  wallHeight: number;
  onRoutePress?: (route: RouteDoc) => void;
  onLongPress?: (coordinates: { xImg: number; yImg: number }) => void;
  selectedRouteId?: string;
  children?: React.ReactNode;
  gesturesEnabled?: boolean;
  onGestureStateChange?: (enabled: boolean) => void;
  onTransformChange?: (transform: { scale: number; translateX: number; translateY: number }) => void;
}

/**
 * המפה האינטראקטיבית הראשית עם Pan/Zoom ומסלולים
 * משתמשת בקואורדינטות תמונה (xImg, yImg) כמקור האמת
 */
export default function WallMap({
  routes,
  wallWidth,
  wallHeight,
  onRoutePress,
  onLongPress,
  selectedRouteId,
  children,
  gesturesEnabled = true,
  onGestureStateChange,
  onTransformChange,
}: WallMapProps) {
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });
  
  const [imageDimensions, setImageDimensions] = useState({
    imgW: 0,
    imgH: 0,
  });

  const [internalGesturesEnabled, setInternalGesturesEnabled] = useState(true);

  // משלב בין הגדרה חיצונית ופנימית
  const effectiveGesturesEnabled = gesturesEnabled && internalGesturesEnabled;

  // מפעיל מחדש את המחוות כשחוזרים למסך
  useFocusEffect(
    useCallback(() => {
      setInternalGesturesEnabled(true);
      onGestureStateChange?.(true);
    }, [onGestureStateChange])
  );

  const transforms = useMapTransforms({
    screenWidth: containerDimensions.width,
    screenHeight: containerDimensions.height,
    imageWidth: imageDimensions.imgW,
    imageHeight: imageDimensions.imgH,
    onTransformChange,
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
    }
  }, [containerDimensions, wallAspectRatio]);

  // המרת קואורדינטות מסך לקואורדינטות תמונה
  const screenToImage = useCallback((screenX: number, screenY: number) => {
    // הפונקציה הזו לא צריכה לקרוא את הערכים בזמן הרנדור
    // זה ישמש בפונקציות callback בלבד
    return { xImg: 0, yImg: 0 }; // placeholder
  }, []);

  // טיפול בלחיצה ארוכה להוספת מסלול
  const handleLongPress = useCallback((event: any) => {
    if (onLongPress && effectiveGesturesEnabled) {
      const { x, y } = event.nativeEvent;
      
      // פונקציה שתקרא מתוך worklet context
      const processLongPress = (screenX: number, screenY: number) => {
        // כבה מחוות לפני הניווט
        setInternalGesturesEnabled(false);
        onGestureStateChange?.(false);
        
        // עבור עכשיו נשתמש בקואורדינטות מסך פשוטות
        // TODO: צריך לתקן את החישוב כשמשתמשים באמת בפונקציה
        onLongPress({ xImg: screenX, yImg: screenY });
      };
      
      processLongPress(x, y);
    }
  }, [onLongPress, effectiveGesturesEnabled, onGestureStateChange]);

  // מערכים מקוצרים לגסטורות (למניעת re-creation)
  const panRefs = useMemo(() => [transforms.pinchRef], [transforms.pinchRef]);
  const pinchRefs = useMemo(() => [transforms.panRef], [transforms.panRef]);

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
      <LongPressGestureHandler
        enabled={effectiveGesturesEnabled}
        onGestureEvent={handleLongPress}
        minDurationMs={800}
      >
        <Animated.View style={styles.gestureContainer} pointerEvents="box-none">
          <PanGestureHandler
            ref={transforms.panRef}
            enabled={effectiveGesturesEnabled}
            onGestureEvent={transforms.panGestureHandler}
            simultaneousHandlers={panRefs}
            waitFor={panRefs}
            minPointers={1}
            maxPointers={1}
          >
            <Animated.View style={styles.gestureContainer} pointerEvents="box-none">
              <PinchGestureHandler
                ref={transforms.pinchRef}
                enabled={effectiveGesturesEnabled}
                onGestureEvent={transforms.pinchGestureHandler}
                simultaneousHandlers={pinchRefs}
              >
                <Animated.View style={styles.gestureContainer} pointerEvents="box-none">
                  <TapGestureHandler
                    ref={transforms.doubleTapRef}
                    enabled={effectiveGesturesEnabled}
                    onGestureEvent={transforms.doubleTapGestureHandler}
                    numberOfTaps={2}
                  >
                    <Animated.View style={styles.gestureContainer} pointerEvents="box-none">
                      <Animated.View style={[styles.mapContainer, transforms.mapContainerStyle]}>
                        {/* תמונת הקיר */}
                        <WallMapSVG
                          width={imageDimensions.imgW}
                          height={imageDimensions.imgH}
                          preserveAspectRatio="xMidYMid meet"
                        />
                        
                        {/* שכבת המסלולים */}
                        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                          {routes.map((route) => (
                            <RouteCircle
                              key={route.id}
                              route={route}
                              imageWidth={imageDimensions.imgW}
                              imageHeight={imageDimensions.imgH}
                              wallWidth={wallWidth}
                              wallHeight={wallHeight}
                              scale={transforms.scale}
                              onPress={onRoutePress}
                              selected={selectedRouteId === route.id}
                            />
                          ))}
                        </View>
                        
                        {/* תוכן נוסף */}
                        {children}
                      </Animated.View>
                    </Animated.View>
                  </TapGestureHandler>
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </LongPressGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#01467D',
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
});
