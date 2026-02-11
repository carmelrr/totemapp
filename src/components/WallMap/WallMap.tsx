import React, { useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Vibration, TouchableOpacity, Text } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, SharedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import { 
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useMapTransforms } from '@/hooks/useMapTransforms';
import { RouteDoc } from '@/features/routes-map/types/route';
import { DynamicWallMap } from '@/features/wall-editor/components';
import { Room, Sector } from '@/features/wall-editor/types';
import RouteCircle from './RouteCircle';
import { useTheme } from '@/features/theme/ThemeContext';

/**
 * Individual sector label button that tracks the map transform
 * Rendered OUTSIDE the GestureDetector so touches work properly
 */
interface SectorLabelButtonProps {
  sector: Sector;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  imgW: number;
  imgH: number;
  wallWidth: number;
  wallHeight: number;
  onPress?: (sector: Sector) => void;
  isActive?: boolean;
}

function SectorLabelButton({
  sector,
  scale,
  translateX,
  translateY,
  imgW,
  imgH,
  wallWidth,
  wallHeight,
  onPress,
  isActive = false,
}: SectorLabelButtonProps) {
  const labelOffset = sector.labelOffset || { x: 0, y: 0 };
  const labelOpacity = sector.labelOpacity ?? 1;
  const baseFontSize = sector.labelFontSize || 14;
  
  // Scale font size from room coords to image coords
  const fontScale = imgW / wallWidth;
  const fontSize = baseFontSize * fontScale;
  const paddingH = 10 * fontScale;
  const paddingV = 4 * fontScale;
  
  // Label position in image coordinates
  const scaleX = imgW / wallWidth;
  const scaleY = imgH / wallHeight;
  const labelImgX = (sector.bounds.x + sector.bounds.width / 2 + labelOffset.x) * scaleX;
  const labelImgY = (sector.bounds.y + sector.bounds.height / 2 + labelOffset.y) * scaleY;
  
  // Image center for transform calculations
  const imgCenterX = imgW / 2;
  const imgCenterY = imgH / 2;
  
  // Estimate button size for centering
  const estimatedWidth = sector.name.length * fontSize * 0.7 + paddingH * 2;
  const estimatedHeight = fontSize + paddingV * 2;
  
  // Animated style: position the label based on current map transform
  // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
  const animatedStyle = useAnimatedStyle(() => {
    const s = scale.value;
    const tx = translateX.value;
    const ty = translateY.value;
    
    const screenX = (labelImgX - imgCenterX) * s + imgCenterX + tx;
    const screenY = (labelImgY - imgCenterY) * s + imgCenterY + ty;
    
    return {
      left: screenX - estimatedWidth / 2,
      top: screenY - estimatedHeight / 2,
    };
  }, [labelImgX, labelImgY, imgCenterX, imgCenterY, estimatedWidth, estimatedHeight]);
  
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          onPress?.(sector);
        }}
        style={{
          backgroundColor: sector.color,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius: estimatedHeight / 2,
          opacity: isActive ? 1 : labelOpacity,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isActive ? 0.6 : 0.4,
          shadowRadius: isActive ? 6 : 4,
          elevation: isActive ? 15 : 10,
          borderWidth: isActive ? 3 : 0,
          borderColor: '#fff',
          transform: isActive ? [{ scale: 1.1 }] : [],
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize }}>
          {sector.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Animated overlay for sector labels — uses the scale shared value directly
 * to hide labels when zoomed past 1.8, preventing flicker when the bottom panel
 * is dragged (which can cause React state to lag behind the actual zoom level).
 */
interface SectorLabelsOverlayProps {
  sectors: Sector[];
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  imgW: number;
  imgH: number;
  wallWidth: number;
  wallHeight: number;
  onSectorPress?: (sector: Sector) => void;
  activeSectorId?: string | null;
}

function SectorLabelsOverlay({
  sectors,
  scale,
  translateX,
  translateY,
  imgW,
  imgH,
  wallWidth,
  wallHeight,
  onSectorPress,
  activeSectorId,
}: SectorLabelsOverlayProps) {
  // Animated opacity: fully visible when scale <= 1.6, fully hidden when scale >= 1.8
  const overlayAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scale.value,
      [1.6, 1.8],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity, pointerEvents: opacity < 0.1 ? 'none' : 'box-none' } as any;
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000 }, overlayAnimatedStyle]} pointerEvents="box-none">
      {sectors.map(sector => (
        <SectorLabelButton
          key={sector.id}
          sector={sector}
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          imgW={imgW}
          imgH={imgH}
          wallWidth={wallWidth}
          wallHeight={wallHeight}
          onPress={onSectorPress}
          isActive={activeSectorId === sector.id}
        />
      ))}
    </Animated.View>
  );
}

interface WallMapProps {
  routes: RouteDoc[];
  wallWidth: number;
  wallHeight: number;
  onRoutePress?: (route: RouteDoc) => void;
  onRouteLongPress?: (route: RouteDoc) => void;
  onLongPress?: (coordinates: { xImg: number; yImg: number }) => void;
  onMapTap?: (coordinates: { xImg: number; yImg: number }) => void; // For placing routes
  selectedRouteId?: string;
  children?: React.ReactNode;
  gesturesEnabled?: boolean;
  onGestureStateChange?: (enabled: boolean) => void;
  onTransformChange?: (transform: { scale: number; translateX: number; translateY: number }) => void;
  /** Room data for rendering the dynamic wall map */
  room?: Room;
  /** Show sector labels as interactive overlay buttons (default false) */
  showSectorLabels?: boolean;
  /** Called when a sector label button is pressed */
  onSectorPress?: (sector: Sector) => void;
  /** Currently active (selected) sector ID for highlighting */
  activeSectorId?: string | null;
  /** Bottom inset for centering (e.g., panel height) */
  centeringBottomInset?: number;
}

// Ref type for external control
export interface WallMapRef {
  setZoom: (scale: number) => void;
  getZoom: () => number;
  getMinScale: () => number;
  getMaxScale: () => number;
  /** Zoom and pan to fit a rectangle (in room coordinates) in view */
  zoomToSector: (bounds: { x: number; y: number; width: number; height: number }) => void;
}

/**
 * המפה האינטראקטיבית הראשית עם Pan/Zoom ומסלולים
 * משתמשת בקואורדינטות תמונה (xImg, yImg) כמקור האמת
 */
const WallMap = React.memo(forwardRef<WallMapRef, WallMapProps>(function WallMap({
  routes,
  wallWidth,
  wallHeight,
  onRoutePress,
  onRouteLongPress,
  onLongPress,
  onMapTap,
  selectedRouteId,
  children,
  gesturesEnabled = true,
  onGestureStateChange,
  onTransformChange,
  room,
  showSectorLabels = false,
  onSectorPress,
  activeSectorId = null,
  centeringBottomInset = 0,
}, ref) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
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
    initialVerticalPosition: 'center',
    centeringBottomInset,
  });

  // Expose zoom control methods via ref
  useImperativeHandle(ref, () => ({
    setZoom: (newScale: number) => {
      if (transforms?.setZoomToCenter) {
        transforms.setZoomToCenter(newScale);
      }
    },
    getZoom: () => transforms?.scale?.value ?? 1,
    getMinScale: () => transforms?.minScale ?? 1,
    getMaxScale: () => transforms?.maxScale ?? 8,
    zoomToSector: (bounds: { x: number; y: number; width: number; height: number }) => {
      if (!transforms?.zoomToRect || imageDimensions.imgW === 0) {
        return;
      }
      // Convert room coordinates to image coordinates
      // SVG viewBox maps room coords -> image pixels
      const scaleX = imageDimensions.imgW / wallWidth;
      const scaleY = imageDimensions.imgH / wallHeight;
      const imgRect = {
        x: bounds.x * scaleX,
        y: bounds.y * scaleY,
        width: bounds.width * scaleX,
        height: bounds.height * scaleY,
      };
      transforms.zoomToRect(imgRect, 0.15, { verticalAlign: 'top' });
    },
  }), [transforms, imageDimensions, wallWidth, wallHeight]);

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

      // Only update if dimensions actually changed to avoid unnecessary re-renders
      // (e.g., container height changed but image still fits by width)
      setImageDimensions(prev => {
        if (prev.imgW === imgW && prev.imgH === imgH) return prev;
        return { imgW, imgH };
      });
    }
  }, [containerDimensions, wallAspectRatio]);

  // Recompute image dimensions when wallAspectRatio changes (e.g., room loads after mount)
  React.useEffect(() => {
    if (containerDimensions.width > 0 && containerDimensions.height > 0) {
      let imgW = containerDimensions.width;
      let imgH = containerDimensions.width * wallAspectRatio;
      if (imgH > containerDimensions.height) {
        imgH = containerDimensions.height;
        imgW = containerDimensions.height / wallAspectRatio;
      }
      // Only update if dimensions actually changed to avoid triggering
      // useMapTransforms dimension-change effect unnecessarily
      setImageDimensions(prev => {
        if (prev.imgW === imgW && prev.imgH === imgH) return prev;
        return { imgW, imgH };
      });
    }
  }, [wallAspectRatio, containerDimensions.width, containerDimensions.height]);

  // המרת קואורדינטות מסך לקואורדינטות תמונה
  const screenToImage = useCallback((screenX: number, screenY: number) => {
    if (!transforms) {
      return { xImg: screenX, yImg: screenY };
    }
    
    // Convert screen coordinates to image coordinates
    // Need to account for current transform state
    const scale = transforms.scale.value;
    const translateX = transforms.translateX.value;
    const translateY = transforms.translateY.value;
    
    // Image center for transform calculations
    const imgCenterX = imageDimensions.imgW / 2;
    const imgCenterY = imageDimensions.imgH / 2;
    
    // Calculate image coordinates considering the current pan and zoom
    // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
    // To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
    const xImg = (screenX - imgCenterX - translateX) / scale + imgCenterX;
    const yImg = (screenY - imgCenterY - translateY) / scale + imgCenterY;
    
    return { xImg, yImg };
  }, [transforms, imageDimensions]);

  // Callback wrapper that can be called via runOnJS
  const handleMapTapCallback = useCallback((screenX: number, screenY: number) => {
    if (!onMapTap) return;
    
    try {
      // Validate input coordinates
      if (typeof screenX !== 'number' || typeof screenY !== 'number' || 
          isNaN(screenX) || isNaN(screenY)) {
        return;
      }
      
      // Read current transform values from shared values
      const currentScale = transforms?.scale?.value ?? 0;
      const currentTranslateX = transforms?.translateX?.value ?? 0;
      const currentTranslateY = transforms?.translateY?.value ?? 0;
      
      // Validate transform values
      if (isNaN(currentScale) || isNaN(currentTranslateX) || isNaN(currentTranslateY) || currentScale === 0) {
        return;
      }
      
      // Image center for transform calculations
      const imgCenterX = imageDimensions.imgW / 2;
      const imgCenterY = imageDimensions.imgH / 2;
      
      // Calculate image coordinates considering the current pan and zoom
      // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
      // To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
      const imageX = (screenX - imgCenterX - currentTranslateX) / currentScale + imgCenterX;
      const imageY = (screenY - imgCenterY - currentTranslateY) / currentScale + imgCenterY;
      
      // Validate calculated coordinates
      if (isNaN(imageX) || isNaN(imageY)) {
        return;
      }
      
      onMapTap({ xImg: imageX, yImg: imageY });
    } catch (error) {
      // Silently handle errors in tap gesture
    }
  }, [onMapTap, transforms, imageDimensions]);

  // Tap gesture for placing routes (used in move mode)
  // We recreate this gesture when onMapTap changes
  const mapTapGesture = useMemo(() => {
    return Gesture.Tap()
      .enabled(!!onMapTap)
      .maxDuration(300) // Shorter duration for more responsive taps
      .maxDistance(10) // Smaller distance for more precise taps
      .onEnd((event) => {
        'worklet';
        try {
          runOnJS(handleMapTapCallback)(event.x, event.y);
        } catch (error) {
          // Silently handle worklet errors
        }
      });
  }, [onMapTap, handleMapTapCallback]);

  // Long press gesture using new Gesture API
  // Only for adding new routes on empty space (longer duration than RouteCircle)
  const longPressGesture = useMemo(() =>
    Gesture.LongPress()
      .minDuration(1000) // 1 second - longer than RouteCircle's 400ms
      .enabled(effectiveGesturesEnabled && !!onLongPress) // Only if onLongPress callback exists
      // שימוש ב-onStart במקום onEnd כדי להפעיל מיד כשהלחיצה הארוכה מזוהה
      .onStart((event) => {
        'worklet';
        if (onLongPress) {
          const processLongPress = (screenX: number, screenY: number) => {
            // הפעלת רטט קצר לפידבק
            Vibration.vibrate(50);
            // כבה מחוות לפני הניווט
            setInternalGesturesEnabled(false);
            onGestureStateChange?.(false);
            onLongPress({ xImg: screenX, yImg: screenY });
          };
          runOnJS(processLongPress)(event.x, event.y);
        }
      }),
    [effectiveGesturesEnabled, onLongPress, onGestureStateChange]
  );

  // Compose gestures - if onMapTap exists, use tap gesture with higher priority
  // Note: We only use pan/pinch/zoom gestures here
  // RouteCircle gestures are handled by their own GestureDetector with hitSlop
  const composedGesture = useMemo(() => {
    // If in move mode (onMapTap exists), disable pan/pinch and only allow tap
    if (onMapTap) {
      return Gesture.Exclusive(
        mapTapGesture,
        Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
      );
    }
    
    // Don't include longPressGesture in Race if it's disabled (no onLongPress callback)
    // This allows RouteCircle's long press to work
    if (!onLongPress) {
      return Gesture.Race(
        transforms.doubleTapGesture,
        Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
      );
    }
    
    return Gesture.Race(
      longPressGesture,
      Gesture.Race(
        transforms.doubleTapGesture,
        Gesture.Simultaneous(transforms.panGesture, transforms.pinchGesture)
      )
    );
  }, [onMapTap, onLongPress, mapTapGesture, longPressGesture, transforms.doubleTapGesture, transforms.panGesture, transforms.pinchGesture]);

  const isReady = containerDimensions.width > 0 && imageDimensions.imgW > 0;

  // Use room's background color for the container
  const bgColor = room?.backgroundColor || '#1a1a2e';
  const containerStyle = useMemo(() => [
    styles.container,
    { backgroundColor: bgColor }
  ], [bgColor]);

  if (!isReady) {
    return (
      <View style={containerStyle} onLayout={handleLayout}>
        <View style={[styles.loadingContainer, { backgroundColor: bgColor }]} />
      </View>
    );
  }

  return (
    <View style={containerStyle} onLayout={handleLayout}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.gestureContainer} collapsable={false}>
          <Animated.View
            style={[
              styles.mapContainer,
              { width: imageDimensions.imgW, height: imageDimensions.imgH },
              transforms.mapContainerStyle,
            ]}
            collapsable={false}
          >
            {/* Wall image - dynamic map from wall editor */}
            {room ? (
              <DynamicWallMap
                room={room}
                width={imageDimensions.imgW}
                height={imageDimensions.imgH}
                preserveAspectRatio="xMidYMid meet"
                showSectorLabels={false}
              />
            ) : null}
            
            {/* תוכן נוסף */}
            {children}
          </Animated.View>
          
          {/* שכבת המסלולים - מחוץ לקונטיינר המוגדל כדי למנוע טשטוש ב-iOS */}
          {/* העיגולים ממוקמים בקואורדינטות מסך ונשארים חדים בכל רמת זום */}
          <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents={onMapTap ? 'none' : 'box-none'}>
            {routes.map((route) => (
              <RouteCircle
                key={route.id}
                route={route}
                imageWidth={imageDimensions.imgW}
                imageHeight={imageDimensions.imgH}
                wallWidth={wallWidth}
                wallHeight={wallHeight}
                scale={transforms.scale}
                translateX={transforms.translateX}
                translateY={transforms.translateY}
                onPress={onRoutePress}
                onLongPress={onRouteLongPress}
                selected={selectedRouteId === route.id}
                gesturesDisabled={!!onMapTap} // Disable route gestures when in move mode
              />
            ))}
          </View>
        </Animated.View>
      </GestureDetector>
      
      {/* Sector labels overlay - OUTSIDE GestureDetector so touches work, uses animated positioning */}
      {showSectorLabels && room?.sectors && room.sectors.length > 0 && (
        <SectorLabelsOverlay
          sectors={room.sectors}
          scale={transforms.scale}
          translateX={transforms.translateX}
          translateY={transforms.translateY}
          imgW={imageDimensions.imgW}
          imgH={imageDimensions.imgH}
          wallWidth={wallWidth}
          wallHeight={wallHeight}
          onSectorPress={onSectorPress}
          activeSectorId={activeSectorId}
        />
      )}
    </View>
  );
}));

export default WallMap;

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor is set dynamically from room.backgroundColor
    width: '100%',
    height: '100%',
    overflow: 'hidden', // Prevent map from visually going outside bounds
  },
  gestureContainer: {
    flex: 1,
    overflow: 'hidden', // Double ensure clipping
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    direction: 'ltr',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.mapBackground,
  },
});
