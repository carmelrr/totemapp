// CropModal - Interactive crop interface for overlay images
// Uses edge-based cropping for intuitive rectangle selection
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { OverlayImage } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_PADDING = 20;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 80;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - MODAL_PADDING * 2 - 60;
const AVAILABLE_WIDTH = SCREEN_WIDTH - MODAL_PADDING * 2 - 40;

interface CropModalProps {
  visible: boolean;
  overlay: OverlayImage;
  onClose: () => void;
  onCrop: (crop: { x: number; y: number; width: number; height: number }) => void;
}

export default function CropModal({ visible, overlay, onClose, onCrop }: CropModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isSvg = overlay.uri.startsWith('<svg') || overlay.uri.startsWith('<?xml');
  
  // Calculate image display size
  const imageAspectRatio = overlay.originalWidth / overlay.originalHeight;
  let displayWidth = AVAILABLE_WIDTH;
  let displayHeight = displayWidth / imageAspectRatio;
  
  if (displayHeight > AVAILABLE_HEIGHT) {
    displayHeight = AVAILABLE_HEIGHT;
    displayWidth = displayHeight * imageAspectRatio;
  }
  
  // Scale factor from display to original
  const scaleFactor = overlay.originalWidth / displayWidth;

  // Track the image container position for accurate touch handling
  const containerRef = useRef<View>(null);
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });

  // Crop edges in display coordinates (distance from each edge)
  const [edges, setEdges] = useState(() => {
    if (overlay.crop) {
      return {
        left: overlay.crop.x / scaleFactor,
        top: overlay.crop.y / scaleFactor,
        right: displayWidth - (overlay.crop.x + overlay.crop.width) / scaleFactor,
        bottom: displayHeight - (overlay.crop.y + overlay.crop.height) / scaleFactor,
      };
    }
    return { left: 0, top: 0, right: 0, bottom: 0 };
  });

  const MIN_SIZE = 50;
  const EDGE_HIT_SIZE = 40;

  // Calculate crop region from edges
  const cropRegion = useMemo(() => ({
    x: edges.left,
    y: edges.top,
    width: displayWidth - edges.left - edges.right,
    height: displayHeight - edges.top - edges.bottom,
  }), [edges, displayWidth, displayHeight]);

  // Determine which edge is being dragged
  const [activeEdge, setActiveEdge] = useState<'left' | 'right' | 'top' | 'bottom' | 'move' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, edges: { ...edges } });
  const isDragging = useRef(false);

  // Generic start handler that works with both touch and mouse
  const handlePointerStart = useCallback((pageX: number, pageY: number) => {
    // Calculate position relative to the image
    const relX = pageX - containerOffset.x;
    const relY = pageY - containerOffset.y;
    
    // Check which edge is being touched
    const leftDist = Math.abs(relX - edges.left);
    const rightDist = Math.abs(relX - (displayWidth - edges.right));
    const topDist = Math.abs(relY - edges.top);
    const bottomDist = Math.abs(relY - (displayHeight - edges.bottom));
    
    // Find the closest edge within hit area
    const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
    
    let edge: 'left' | 'right' | 'top' | 'bottom' | 'move' = 'move';
    if (minDist < EDGE_HIT_SIZE) {
      if (minDist === leftDist) edge = 'left';
      else if (minDist === rightDist) edge = 'right';
      else if (minDist === topDist) edge = 'top';
      else if (minDist === bottomDist) edge = 'bottom';
    }
    
    // If touching inside the crop region, allow moving
    if (relX > edges.left + 20 && relX < displayWidth - edges.right - 20 &&
        relY > edges.top + 20 && relY < displayHeight - edges.bottom - 20) {
      edge = 'move';
    }
    
    setActiveEdge(edge);
    setDragStart({ x: pageX, y: pageY, edges: { ...edges } });
    isDragging.current = true;
  }, [edges, containerOffset, displayWidth, displayHeight]);

  // Generic move handler
  const handlePointerMove = useCallback((pageX: number, pageY: number) => {
    if (!activeEdge || !isDragging.current) return;
    
    const dx = pageX - dragStart.x;
    const dy = pageY - dragStart.y;
    
    const newEdges = { ...dragStart.edges };
    const maxWidth = displayWidth - MIN_SIZE;
    const maxHeight = displayHeight - MIN_SIZE;
    
    switch (activeEdge) {
      case 'left':
        newEdges.left = Math.max(0, Math.min(maxWidth - newEdges.right, dragStart.edges.left + dx));
        break;
      case 'right':
        newEdges.right = Math.max(0, Math.min(maxWidth - newEdges.left, dragStart.edges.right - dx));
        break;
      case 'top':
        newEdges.top = Math.max(0, Math.min(maxHeight - newEdges.bottom, dragStart.edges.top + dy));
        break;
      case 'bottom':
        newEdges.bottom = Math.max(0, Math.min(maxHeight - newEdges.top, dragStart.edges.bottom - dy));
        break;
      case 'move':
        // Move the entire crop region
        const currentWidth = displayWidth - dragStart.edges.left - dragStart.edges.right;
        const currentHeight = displayHeight - dragStart.edges.top - dragStart.edges.bottom;
        
        let newLeft = dragStart.edges.left + dx;
        let newTop = dragStart.edges.top + dy;
        
        // Constrain to image bounds
        newLeft = Math.max(0, Math.min(displayWidth - currentWidth, newLeft));
        newTop = Math.max(0, Math.min(displayHeight - currentHeight, newTop));
        
        newEdges.left = newLeft;
        newEdges.right = displayWidth - newLeft - currentWidth;
        newEdges.top = newTop;
        newEdges.bottom = displayHeight - newTop - currentHeight;
        break;
    }
    
    setEdges(newEdges);
  }, [activeEdge, dragStart, displayWidth, displayHeight]);

  const handlePointerEnd = useCallback(() => {
    setActiveEdge(null);
    isDragging.current = false;
  }, []);

  // Web mouse event handlers
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    
    // Access window through global for web platform
    const win = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
    if (!win || !win.addEventListener) return;

    const handleMouseMove = (e: any) => {
      if (isDragging.current) {
        e.preventDefault?.();
        handlePointerMove(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      handlePointerEnd();
    };

    win.addEventListener('mousemove', handleMouseMove);
    win.addEventListener('mouseup', handleMouseUp);

    return () => {
      win.removeEventListener('mousemove', handleMouseMove);
      win.removeEventListener('mouseup', handleMouseUp);
    };
  }, [visible, handlePointerMove, handlePointerEnd]);

  // Touch event wrapper
  const onTouchStart = useCallback((e: any) => {
    const touch = e.nativeEvent.touches?.[0] || e.nativeEvent;
    handlePointerStart(touch.pageX, touch.pageY);
  }, [handlePointerStart]);

  const onTouchMove = useCallback((e: any) => {
    const touch = e.nativeEvent.touches?.[0] || e.nativeEvent;
    handlePointerMove(touch.pageX, touch.pageY);
  }, [handlePointerMove]);

  // Mouse event wrapper for web
  const onMouseDown = useCallback((e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      handlePointerStart(e.clientX, e.clientY);
    }
  }, [handlePointerStart]);

  const handleConfirm = useCallback(() => {
    const crop = {
      x: Math.round(cropRegion.x * scaleFactor),
      y: Math.round(cropRegion.y * scaleFactor),
      width: Math.round(cropRegion.width * scaleFactor),
      height: Math.round(cropRegion.height * scaleFactor),
    };
    onCrop(crop);
    onClose();
  }, [cropRegion, scaleFactor, onCrop, onClose]);

  const handleReset = useCallback(() => {
    setEdges({ left: 0, top: 0, right: 0, bottom: 0 });
  }, []);

  // Measure container position on layout
  const onContainerLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x, y) => {
      setContainerOffset({ x, y });
    });
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>חתוך תמונה</Text>
            <TouchableOpacity style={styles.headerButton} onPress={handleReset}>
              <Ionicons name="refresh" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <Text style={styles.instructions}>גרור את הקצוות לבחירת אזור החיתוך</Text>

          {/* Image with crop overlay */}
          <View 
            ref={containerRef}
            style={[styles.imageContainer, { width: displayWidth, height: displayHeight, cursor: 'crosshair' } as any]}
            onLayout={onContainerLayout}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={handlePointerEnd}
            onTouchCancel={handlePointerEnd}
            // @ts-ignore - web only
            onMouseDown={onMouseDown}
          >
            {/* Image */}
            {isSvg ? (
              <SvgXml
                xml={overlay.uri}
                width={displayWidth}
                height={displayHeight}
                style={styles.image}
              />
            ) : (
              <ExpoImage
                source={{ uri: overlay.uri }}
                style={[styles.image, { width: displayWidth, height: displayHeight }]}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}

            {/* Dark overlay outside crop region */}
            <View style={styles.overlayContainer} pointerEvents="none">
              {/* Top */}
              <View style={[styles.darkOverlay, { top: 0, left: 0, right: 0, height: cropRegion.y }]} />
              {/* Bottom */}
              <View style={[styles.darkOverlay, { bottom: 0, left: 0, right: 0, height: displayHeight - cropRegion.y - cropRegion.height }]} />
              {/* Left */}
              <View style={[styles.darkOverlay, { top: cropRegion.y, left: 0, width: cropRegion.x, height: cropRegion.height }]} />
              {/* Right */}
              <View style={[styles.darkOverlay, { top: cropRegion.y, right: 0, width: displayWidth - cropRegion.x - cropRegion.width, height: cropRegion.height }]} />
            </View>

            {/* Crop frame with edge indicators */}
            <View
              style={[
                styles.cropFrame,
                {
                  left: cropRegion.x,
                  top: cropRegion.y,
                  width: cropRegion.width,
                  height: cropRegion.height,
                },
              ]}
              pointerEvents="none"
            >
              {/* Edge indicators - visual hint for draggable edges */}
              {/* Left edge */}
              <View style={[styles.edgeIndicator, styles.edgeLeft]} />
              {/* Right edge */}
              <View style={[styles.edgeIndicator, styles.edgeRight]} />
              {/* Top edge */}
              <View style={[styles.edgeIndicator, styles.edgeTop]} />
              {/* Bottom edge */}
              <View style={[styles.edgeIndicator, styles.edgeBottom]} />
              
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              
              {/* Grid lines */}
              <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '33%' }]} />
              <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '66%' }]} />
              <View style={[styles.gridLine, styles.gridLineVertical, { left: '33%' }]} />
              <View style={[styles.gridLine, styles.gridLineVertical, { left: '66%' }]} />
            </View>
          </View>

          {/* Size info */}
          <Text style={styles.sizeInfo}>
            {Math.round(cropRegion.width * scaleFactor)} × {Math.round(cropRegion.height * scaleFactor)} פיקסלים
          </Text>

          {/* Footer with buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Ionicons name="crop" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>חתוך</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: theme.background,
    borderRadius: 16,
    padding: MODAL_PADDING,
    maxWidth: SCREEN_WIDTH - 20,
    maxHeight: SCREEN_HEIGHT - 40,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    height: HEADER_HEIGHT - 16,
    width: '100%',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  darkOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  edgeIndicator: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  edgeLeft: {
    left: -3,
    top: '30%',
    width: 6,
    height: '40%',
    borderRadius: 3,
  },
  edgeRight: {
    right: -3,
    top: '30%',
    width: 6,
    height: '40%',
    borderRadius: 3,
  },
  edgeTop: {
    top: -3,
    left: '30%',
    width: '40%',
    height: 6,
    borderRadius: 3,
  },
  edgeBottom: {
    bottom: -3,
    left: '30%',
    width: '40%',
    height: 6,
    borderRadius: 3,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  gridLineHorizontal: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineVertical: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  sizeInfo: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.card,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
