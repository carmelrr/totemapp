import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Image } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const FlexibleCropper = ({ imageUri, onSave, onCancel }) => {
  // Canvas dimensions (fit to screen with padding)
  const canvasWidth = screenWidth - 40;
  const canvasHeight = screenHeight * 0.75;

  // Corner positions (in display coordinates)
  const corners = {
    tl: { 
      x: useSharedValue(20), 
      y: useSharedValue(20) 
    },
    tr: { 
      x: useSharedValue(canvasWidth - 20), 
      y: useSharedValue(20) 
    },
    br: { 
      x: useSharedValue(canvasWidth - 20), 
      y: useSharedValue(canvasHeight - 20) 
    },
    bl: { 
      x: useSharedValue(20), 
      y: useSharedValue(canvasHeight - 20) 
    }
  };

  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    const state = {
      tl: { x: corners.tl.x.value, y: corners.tl.y.value },
      tr: { x: corners.tr.x.value, y: corners.tr.y.value },
      br: { x: corners.br.x.value, y: corners.br.y.value },
      bl: { x: corners.bl.x.value, y: corners.bl.y.value },
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, corners]);

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      corners.tl.x.value = prevState.tl.x;
      corners.tl.y.value = prevState.tl.y;
      corners.tr.x.value = prevState.tr.x;
      corners.tr.y.value = prevState.tr.y;
      corners.br.x.value = prevState.br.x;
      corners.br.y.value = prevState.br.y;
      corners.bl.x.value = prevState.bl.x;
      corners.bl.y.value = prevState.bl.y;
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, corners]);

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      corners.tl.x.value = nextState.tl.x;
      corners.tl.y.value = nextState.tl.y;
      corners.tr.x.value = nextState.tr.x;
      corners.tr.y.value = nextState.tr.y;
      corners.br.x.value = nextState.br.x;
      corners.br.y.value = nextState.br.y;
      corners.bl.x.value = nextState.bl.x;
      corners.bl.y.value = nextState.bl.y;
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, corners]);

  // Corner handle component
  const CornerHandle = ({ cornerKey, color = '#00FFC2' }) => {
    const corner = corners[cornerKey];
    
    const gestureHandler = useAnimatedGestureHandler({
      onStart: (_, context) => {
        context.startX = corner.x.value;
        context.startY = corner.y.value;
      },
      onActive: (event, context) => {
        // Constrain to canvas bounds
        corner.x.value = Math.max(0, Math.min(canvasWidth, context.startX + event.translationX));
        corner.y.value = Math.max(0, Math.min(canvasHeight, context.startY + event.translationY));
      },
      onEnd: () => {
        // Save state to history when drag ends
        runOnJS(saveToHistory)();
      },
    });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: corner.x.value - 12 }, // Half of handle width (24/2)
        { translateY: corner.y.value - 12 }  // Half of handle height (24/2)
      ],
    }));

    return (
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.handle, { backgroundColor: color }, animatedStyle]} />
      </PanGestureHandler>
    );
  };

  // Create polygon points for SVG (ensuring valid polygon)
  const getPolygonPoints = useCallback(() => {
    const tl = `${corners.tl.x.value},${corners.tl.y.value}`;
    const tr = `${corners.tr.x.value},${corners.tr.y.value}`;
    const br = `${corners.br.x.value},${corners.br.y.value}`;
    const bl = `${corners.bl.x.value},${corners.bl.y.value}`;
    return `${tl} ${tr} ${br} ${bl}`;
  }, [corners]);

  // Save cropped image (with proper normalization)
  const handleSave = async () => {
    try {
      // Calculate normalized crop coordinates (0-1 range)
      const normalizedCorners = {
        tl: { 
          x: Math.max(0, Math.min(1, corners.tl.x.value / canvasWidth)), 
          y: Math.max(0, Math.min(1, corners.tl.y.value / canvasHeight))
        },
        tr: { 
          x: Math.max(0, Math.min(1, corners.tr.x.value / canvasWidth)), 
          y: Math.max(0, Math.min(1, corners.tr.y.value / canvasHeight))
        },
        br: { 
          x: Math.max(0, Math.min(1, corners.br.x.value / canvasWidth)), 
          y: Math.max(0, Math.min(1, corners.br.y.value / canvasHeight))
        },
        bl: { 
          x: Math.max(0, Math.min(1, corners.bl.x.value / canvasWidth)), 
          y: Math.max(0, Math.min(1, corners.bl.y.value / canvasHeight))
        },
      };

      console.log('Flexible crop completed with corners:', normalizedCorners);
      
      // Return cropped image info with both original and normalized coordinates
      if (onSave) {
        onSave({
          uri: imageUri, // Return original image URI
          corners: normalizedCorners, // Normalized coordinates for processing
          originalCorners: {
            tl: { x: corners.tl.x.value, y: corners.tl.y.value },
            tr: { x: corners.tr.x.value, y: corners.tr.y.value },
            br: { x: corners.br.x.value, y: corners.br.y.value },
            bl: { x: corners.bl.x.value, y: corners.bl.y.value },
          },
          canvasDimensions: {
            width: canvasWidth,
            height: canvasHeight
          }
        });
      }
    } catch (error) {
      console.error('Error saving cropped image:', error);
      alert(`שגיאה בשמירת התמונה: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instructions}>
        🎯 גרור את הפינות הצבעוניות כדי לבחור את האזור לחיתוך
      </Text>
      
      <Text style={styles.subInstructions}>
        כל פינה יכולה לזוז בנפרד • השתמש ב-Undo/Redo לתיקונים
      </Text>

      {/* Image Container */}
      <View style={[styles.imageContainer, { width: canvasWidth, height: canvasHeight }]}>
        {/* Background Image */}
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
        
        {/* SVG Overlay for crop outline */}
        <Svg 
          style={StyleSheet.absoluteFillObject}
          width={canvasWidth} 
          height={canvasHeight}
        >
          <Polygon
            points={getPolygonPoints()}
            fill="rgba(0, 255, 194, 0.1)"
            stroke="#00FFC2"
            strokeWidth="3"
            strokeDasharray="10,5"
          />
        </Svg>

        {/* Corner Handles */}
        <CornerHandle cornerKey="tl" color="#FF6B6B" />
        <CornerHandle cornerKey="tr" color="#4ECDC4" />
        <CornerHandle cornerKey="br" color="#45B7D1" />
        <CornerHandle cornerKey="bl" color="#FFA07A" />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Undo/Redo */}
        <View style={styles.historyControls}>
          <TouchableOpacity 
            style={[styles.controlButton, historyIndex <= 0 && styles.controlButtonDisabled]}
            onPress={undo}
            disabled={historyIndex <= 0}
          >
            <Text style={styles.controlButtonText}>↩️ Undo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, historyIndex >= history.length - 1 && styles.controlButtonDisabled]}
            onPress={redo}
            disabled={historyIndex >= history.length - 1}
          >
            <Text style={styles.controlButtonText}>↪️ Redo</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>ביטול</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>✓ שמור</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
  subInstructions: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#111',
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  handle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },
  controls: {
    marginTop: 30,
    width: '100%',
    paddingHorizontal: 20,
  },
  historyControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 15,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fff',
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
    flex: 0.4,
  },
  saveButton: {
    backgroundColor: 'rgba(0, 200, 0, 0.7)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
    flex: 0.4,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default FlexibleCropper;
