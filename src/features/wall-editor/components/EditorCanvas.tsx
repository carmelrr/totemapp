// EditorCanvas - Main canvas component combining grid, walls, and mats

import React, { useState, useCallback, useMemo, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Vibration, Image, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { 
  GestureDetector, 
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '@/features/theme/ThemeContext';
import { Room, Point, EditorMode, Selection, OverlayImage, Sector } from '../types';
import EditorGrid from './EditorGrid';
import WallRenderer from './WallRenderer';
import MatRenderer from './MatRenderer';
import EntranceArrowRenderer from './EntranceArrowRenderer';
import SectorRenderer from './SectorRenderer';
import TextLabelRenderer from './TextLabelRenderer';
import { useEditorStore } from '../store/useEditorStore';

// Helper to decode base64 SVG data URL
const decodeSvgDataUrl = (uri: string): string | null => {
  if (!uri.startsWith('data:image/svg+xml;base64,')) {
    return null;
  }
  try {
    const base64 = uri.replace('data:image/svg+xml;base64,', '');
    // Decode base64 using a cross-platform approach
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    let i = 0;
    while (i < base64.length) {
      const enc1 = chars.indexOf(base64.charAt(i++));
      const enc2 = chars.indexOf(base64.charAt(i++));
      const enc3 = chars.indexOf(base64.charAt(i++));
      const enc4 = chars.indexOf(base64.charAt(i++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      str += String.fromCharCode(chr1);
      if (enc3 !== 64) str += String.fromCharCode(chr2);
      if (enc4 !== 64) str += String.fromCharCode(chr3);
    }
    return str;
  } catch (e) {
    console.error('Error decoding SVG:', e);
    return null;
  }
};

interface EditorCanvasProps {
  /** The room to render */
  room: Room;
  /** Current editor mode */
  mode: EditorMode;
  /** Current selection */
  selection: Selection;
  /** Callback when canvas is tapped */
  onCanvasTap?: (point: Point) => void;
  /** Callback when a wall point is selected */
  onWallPointSelect?: (wallId: string, pointIndex: number) => void;
  /** Callback when a wall is selected */
  onWallSelect?: (wallId: string) => void;
  /** Callback when transform changes */
  onTransformChange?: (scale: number, translateX: number, translateY: number) => void;
}

/** Handle exposed by EditorCanvas ref */
export interface EditorCanvasHandle {
  /** Zoom to a specific rect in room coordinates */
  zoomToRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** Reset zoom to fit room */
  resetZoom: () => void;
}

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

function EditorCanvasComponent(
  {
    room,
    mode,
    selection,
    onCanvasTap,
    onWallPointSelect,
    onWallSelect,
    onTransformChange,
  }: EditorCanvasProps,
  ref: React.ForwardedRef<EditorCanvasHandle>
) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  // Store access for building state
  const buildingWall = useEditorStore(state => state.buildingWall);
  const buildingMat = useEditorStore(state => state.buildingMat);
  const overlay = useEditorStore(state => state.overlay);
  const updateOverlay = useEditorStore(state => state.updateOverlay);
  
  // Container dimensions
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Regular state for scale (for passing to child components without Reanimated warnings)
  const [currentScale, setCurrentScale] = useState(1);
  
  // Transform shared values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useRef(1);
  const savedTranslateX = useRef(0);
  const savedTranslateY = useRef(0);
  
  // Calculate room fit scale
  const roomFitScale = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return 1;
    const scaleX = containerSize.width / room.width;
    const scaleY = containerSize.height / room.height;
    return Math.min(scaleX, scaleY) * 0.9; // 90% to leave some padding
  }, [containerSize, room.width, room.height]);
  
  // Effective canvas dimensions
  const canvasWidth = room.width * roomFitScale;
  const canvasHeight = room.height * roomFitScale;
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    zoomToRect: (rect: { x: number; y: number; width: number; height: number }) => {
      if (containerSize.width === 0 || containerSize.height === 0) return;
      
      // Calculate scale to fit the rect with padding
      const rectScaleX = containerSize.width / (rect.width * roomFitScale);
      const rectScaleY = containerSize.height / (rect.height * roomFitScale);
      const targetScale = Math.min(rectScaleX, rectScaleY) * 0.8; // 80% to leave padding
      const clampedScale = Math.max(0.5, Math.min(3, targetScale));
      
      // Calculate center of the rect in canvas coordinates
      const rectCenterX = (rect.x + rect.width / 2) * roomFitScale;
      const rectCenterY = (rect.y + rect.height / 2) * roomFitScale;
      
      // Calculate translation to center the rect
      // Canvas is centered in container, so translate is relative to that center
      const canvasCenterX = canvasWidth / 2;
      const canvasCenterY = canvasHeight / 2;
      const targetTranslateX = (canvasCenterX - rectCenterX) * clampedScale;
      const targetTranslateY = (canvasCenterY - rectCenterY) * clampedScale;
      
      // Animate to target
      scale.value = withSpring(clampedScale, SPRING_CONFIG);
      translateX.value = withSpring(targetTranslateX, SPRING_CONFIG);
      translateY.value = withSpring(targetTranslateY, SPRING_CONFIG);
      
      // Update saved values
      savedScale.current = clampedScale;
      savedTranslateX.current = targetTranslateX;
      savedTranslateY.current = targetTranslateY;
      setCurrentScale(clampedScale);
    },
    resetZoom: () => {
      scale.value = withSpring(1, SPRING_CONFIG);
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedScale.current = 1;
      savedTranslateX.current = 0;
      savedTranslateY.current = 0;
      setCurrentScale(1);
    },
  }), [containerSize, roomFitScale, canvasWidth, canvasHeight, scale, translateX, translateY]);
  
  // Handle layout
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);
  
  // Convert screen coordinates to room coordinates using provided transform values
  const screenToRoomWithTransform = useCallback((
    screenX: number, screenY: number,
    currentScale: number, currentTranslateX: number, currentTranslateY: number
  ): Point => {
    // Center offset
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    
    // Invert transform: screenPos -> roomPos
    const roomX = ((screenX - centerX - currentTranslateX) / currentScale + canvasCenterX) / roomFitScale;
    const roomY = ((screenY - centerY - currentTranslateY) / currentScale + canvasCenterY) / roomFitScale;
    
    return { x: roomX, y: roomY };
  }, [containerSize, canvasWidth, canvasHeight, roomFitScale]);
  
  // Handle tap - receives transform values captured at tap time for accuracy
  const handleTapWithTransform = useCallback((
    screenX: number, screenY: number,
    capturedScale: number, capturedTranslateX: number, capturedTranslateY: number
  ) => {
    const roomPoint = screenToRoomWithTransform(screenX, screenY, capturedScale, capturedTranslateX, capturedTranslateY);
    
    // Clamp to room bounds
    const clampedPoint = {
      x: Math.max(0, Math.min(room.width, roomPoint.x)),
      y: Math.max(0, Math.min(room.height, roomPoint.y)),
    };
    
    onCanvasTap?.(clampedPoint);
  }, [screenToRoomWithTransform, room.width, room.height, onCanvasTap]);
  
  // Vibrate wrapper for worklet
  const triggerVibration = useCallback(() => {
    Vibration.vibrate(10);
  }, []);
  
  // Tap gesture
  const tapGesture = useMemo(() => 
    Gesture.Tap()
      .enabled(mode !== 'pan')
      .onEnd((event) => {
        'worklet';
        // Capture transform values at exact tap moment for accurate placement
        const s = scale.value;
        const tx = translateX.value;
        const ty = translateY.value;
        runOnJS(triggerVibration)();
        runOnJS(handleTapWithTransform)(event.x, event.y, s, tx, ty);
      }),
    [mode, handleTapWithTransform, triggerVibration, scale, translateX, translateY]
  );
  
  // Pan gesture for moving the canvas - works on the entire container
  const panGesture = useMemo(() =>
    Gesture.Pan()
      .minPointers(1)
      .maxPointers(2)
      .onStart(() => {
        'worklet';
        savedTranslateX.current = translateX.value;
        savedTranslateY.current = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        const newTranslateX = savedTranslateX.current + event.translationX;
        const newTranslateY = savedTranslateY.current + event.translationY;
        
        // Calculate bounds - allow full panning when zoomed in
        // The canvas should be able to pan so any part of it can be centered
        const scaledWidth = canvasWidth * scale.value;
        const scaledHeight = canvasHeight * scale.value;
        
        // When zoomed in (scale > 1), allow panning up to edges of content
        // When zoomed out, keep content mostly visible
        const halfContainerW = containerSize.width / 2;
        const halfContainerH = containerSize.height / 2;
        const halfScaledW = scaledWidth / 2;
        const halfScaledH = scaledHeight / 2;
        
        // Max translate = content can pan until its left edge reaches screen center
        // Min translate = content can pan until its right edge reaches screen center
        const maxTranslateX = halfScaledW;
        const minTranslateX = -halfScaledW;
        const maxTranslateY = halfScaledH;
        const minTranslateY = -halfScaledH;
        
        // Clamp to bounds
        translateX.value = Math.max(minTranslateX, Math.min(maxTranslateX, newTranslateX));
        translateY.value = Math.max(minTranslateY, Math.min(maxTranslateY, newTranslateY));
      })
      .onEnd(() => {
        'worklet';
        if (onTransformChange) {
          runOnJS(onTransformChange)(scale.value, translateX.value, translateY.value);
        }
        runOnJS(setCurrentScale)(scale.value);
      }),
    [mode, onTransformChange, canvasWidth, canvasHeight, containerSize]
  );
  
  // Pinch gesture for zooming
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart(() => {
        'worklet';
        savedScale.current = scale.value;
      })
      .onUpdate((event) => {
        'worklet';
        const newScale = savedScale.current * event.scale;
        scale.value = Math.max(0.25, Math.min(4, newScale));
      })
      .onEnd(() => {
        'worklet';
        if (onTransformChange) {
          runOnJS(onTransformChange)(scale.value, translateX.value, translateY.value);
        }
        runOnJS(setCurrentScale)(scale.value);
      }),
    [onTransformChange]
  );
  
  // Mouse wheel zoom for web/desktop
  const containerRef = useRef<View>(null);
  
  const handleWheel = useCallback((event: any) => {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1; // Zoom out/in
    const newScale = Math.max(0.25, Math.min(4, scale.value * delta));
    
    // Zoom towards mouse position
    if (containerSize.width > 0 && containerSize.height > 0) {
      const mouseX = event.offsetX;
      const mouseY = event.offsetY;
      
      // Calculate new translation to zoom towards mouse
      const scaleDiff = newScale / scale.value;
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;
      
      const newTranslateX = centerX - (centerX - translateX.value) * scaleDiff - (mouseX - centerX) * (scaleDiff - 1);
      const newTranslateY = centerY - (centerY - translateY.value) * scaleDiff - (mouseY - centerY) * (scaleDiff - 1);
      
      scale.value = newScale;
      translateX.value = newTranslateX;
      translateY.value = newTranslateY;
      
      savedScale.current = newScale;
      savedTranslateX.current = newTranslateX;
      savedTranslateY.current = newTranslateY;
    } else {
      scale.value = newScale;
      savedScale.current = newScale;
    }
    
    setCurrentScale(newScale);
    onTransformChange?.(scale.value, translateX.value, translateY.value);
  }, [containerSize, scale, translateX, translateY, onTransformChange]);
  
  // Attach wheel event listener on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const element = (containerRef.current as any)?._nativeTag || 
                    (containerRef.current as any);
    
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener('wheel', handleWheel, { passive: false });
      return () => element.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);
  
  // Combine gestures based on mode
  // Pan/pinch always work, tap only in non-pan modes
  const composedGesture = useMemo(() => {
    const navigationGestures = Gesture.Simultaneous(panGesture, pinchGesture);
    
    if (mode === 'pan') {
      // Only navigation in pan mode
      return navigationGestures;
    }
    
    // In other modes: tap takes priority, then navigation gestures
    // Tap for point placement, pan/pinch for navigation
    return Gesture.Race(tapGesture, navigationGestures);
  }, [mode, tapGesture, panGesture, pinchGesture]);
  
  // Animated style for canvas transform
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ] as const,
  }));
  
  return (
    <GestureDetector gesture={composedGesture}>
      <View ref={containerRef} style={styles.container} onLayout={handleLayout}>
        {containerSize.width > 0 && containerSize.height > 0 && (
          <Animated.View 
            style={[
              styles.canvasWrapper,
              {
                width: canvasWidth,
                height: canvasHeight,
                marginStart: (containerSize.width - canvasWidth) / 2,
                marginTop: (containerSize.height - canvasHeight) / 2,
              },
              animatedCanvasStyle,
            ]}
          >
            {/* Background */}
            <View 
              style={[
                styles.canvasBackground, 
                { backgroundColor: room.backgroundColor }
              ]} 
            />
            
            {/* Overlay reference image layer - behind grid */}
            {overlay && (() => {
              const svgXml = decodeSvgDataUrl(overlay.uri);
              
              // Use cropped dimensions if crop exists, otherwise original
              const cropWidth = overlay.crop?.width ?? overlay.originalWidth;
              const cropHeight = overlay.crop?.height ?? overlay.originalHeight;
              const overlayWidth = cropWidth * overlay.scale * roomFitScale;
              const overlayHeight = cropHeight * overlay.scale * roomFitScale;
              
              // Calculate brightness
              const brightness = overlay.brightness ?? 1;
              
              // For web, use CSS filter. For native, we'll use an overlay
              const webBrightnessStyle = Platform.OS === 'web' 
                ? { filter: `brightness(${brightness})` } as any
                : {};
              
              // Build transform array with rotation and flip
              const transforms: any[] = [
                { rotate: `${overlay.rotation}deg` },
              ];
              if (overlay.flipX) {
                transforms.push({ scaleX: -1 });
              }
              if (overlay.flipY) {
                transforms.push({ scaleY: -1 });
              }
              
              // Brightness overlay for native (when brightness > 1)
              const renderBrightnessOverlay = () => {
                if (Platform.OS === 'web' || brightness <= 1) return null;
                // Add a white overlay with opacity proportional to brightness above 1
                // brightness 2 = 100% extra = 50% white overlay
                const overlayOpacity = Math.min(0.7, (brightness - 1) * 0.5);
                return (
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: 'white',
                      opacity: overlayOpacity,
                    }}
                    pointerEvents="none"
                  />
                );
              };
              
              if (svgXml) {
                // SVG data URL - use SvgXml with viewBox for crop
                // Parse original viewBox or create one
                let modifiedSvg = svgXml;
                if (overlay.crop) {
                  // Add or replace viewBox to crop the SVG
                  const { x, y, width, height } = overlay.crop;
                  const viewBoxValue = `${x} ${y} ${width} ${height}`;
                  
                  if (modifiedSvg.includes('viewBox=')) {
                    // Replace existing viewBox
                    modifiedSvg = modifiedSvg.replace(/viewBox="[^"]*"/, `viewBox="${viewBoxValue}"`);
                  } else {
                    // Add viewBox after opening svg tag
                    modifiedSvg = modifiedSvg.replace(/<svg/, `<svg viewBox="${viewBoxValue}"`);
                  }
                }
                
                return (
                  <View
                    style={[
                      styles.overlayImage,
                      {
                        left: overlay.x * roomFitScale,
                        top: overlay.y * roomFitScale,
                        width: overlayWidth,
                        height: overlayHeight,
                        opacity: overlay.opacity,
                        transform: transforms,
                      },
                      webBrightnessStyle,
                    ]}
                  >
                    <SvgXml
                      xml={modifiedSvg}
                      width="100%"
                      height="100%"
                    />
                    {renderBrightnessOverlay()}
                  </View>
                );
              }
              
              // Regular image URL - use overflow hidden container with positioned image
              if (overlay.crop) {
                const { x, y, width, height } = overlay.crop;
                const scaleFactorX = overlayWidth / width;
                const scaleFactorY = overlayHeight / height;
                const fullImageWidth = overlay.originalWidth * scaleFactorX;
                const fullImageHeight = overlay.originalHeight * scaleFactorY;
                
                return (
                  <View
                    style={[
                      styles.overlayImage,
                      {
                        left: overlay.x * roomFitScale,
                        top: overlay.y * roomFitScale,
                        width: overlayWidth,
                        height: overlayHeight,
                        opacity: overlay.opacity,
                        transform: transforms,
                        overflow: 'hidden',
                      },
                      webBrightnessStyle,
                    ]}
                  >
                    <Image
                      source={{ uri: overlay.uri }}
                      style={{
                        position: 'absolute',
                        left: -x * scaleFactorX,
                        top: -y * scaleFactorY,
                        width: fullImageWidth,
                        height: fullImageHeight,
                      }}
                      resizeMode="cover"
                    />
                    {renderBrightnessOverlay()}
                  </View>
                );
              }
              
              // No crop - render normally
              return (
                <View
                  style={[
                    styles.overlayImage,
                    {
                      left: overlay.x * roomFitScale,
                      top: overlay.y * roomFitScale,
                      width: overlayWidth,
                      height: overlayHeight,
                      opacity: overlay.opacity,
                      transform: transforms,
                    },
                    webBrightnessStyle,
                  ]}
                >
                  <Image
                    source={{ uri: overlay.uri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                  />
                  {renderBrightnessOverlay()}
                </View>
              );
            })()}
            
            {/* Grid layer */}
            {room.showGrid && (
              <EditorGrid
                roomWidth={room.width}
                roomHeight={room.height}
                containerWidth={canvasWidth}
                containerHeight={canvasHeight}
                config={{
                  cellSize: room.gridSize,
                  showMajorLines: true,
                  majorLineEvery: 5,
                  majorLineColor: room.gridColor,
                  minorLineColor: room.gridColor,
                  showLabels: false,
                }}
                scale={currentScale}
              />
            )}
            
            {/* Mats layer (below walls) */}
            <MatRenderer
              mats={room.mats || []}
              buildingMat={buildingMat}
              selection={selection}
              scale={currentScale}
              roomWidth={room.width}
              roomHeight={room.height}
              containerWidth={canvasWidth}
              containerHeight={canvasHeight}
            />
            
            {/* Walls layer */}
            <WallRenderer
              walls={room.walls}
              buildingWall={buildingWall}
              selection={selection}
              scale={currentScale}
              onPointPress={onWallPointSelect}
              onWallPress={onWallSelect}
              roomWidth={room.width}
              roomHeight={room.height}
              containerWidth={canvasWidth}
              containerHeight={canvasHeight}
            />
            
            {/* Sectors layer */}
            {room.sectors && room.sectors.length > 0 && (
              <SectorRenderer
                sectors={room.sectors}
                roomFitScale={roomFitScale}
                isEditing={mode === 'select'}
              />
            )}
            
            {/* Text labels layer */}
            {room.textLabels && room.textLabels.length > 0 && (
              <TextLabelRenderer
                textLabels={room.textLabels}
                roomFitScale={roomFitScale}
                isEditing={mode === 'select' || mode === 'text'}
              />
            )}

            {/* Entrance arrow layer */}
            {room.entranceArrow && room.entranceArrow.visible && (
              <EntranceArrowRenderer
                arrow={room.entranceArrow}
                scale={scale.value}
                roomFitScale={roomFitScale}
              />
            )}
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(EditorCanvasComponent);

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0a0a15',
      overflow: 'hidden',
    },
    canvasWrapper: {
      position: 'absolute',
      direction: 'ltr',
    },
    canvasBackground: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 4,
    },
    overlayImage: {
      position: 'absolute',
      zIndex: 1,
    },
  });

export default EditorCanvas;