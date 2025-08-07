import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated,
  PanResponder,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { addSprayRoute } from '../services/sprayWallService';
import { getCurrentSprayWall } from '../services/sprayWallService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Hold types with their visual representation
const HOLD_TYPES = {
  OFF: { color: 'transparent', icon: '', label: 'לא פעיל' },
  START: { color: '#00ff00', icon: 'S', label: 'התחלה' },
  FINISH: { color: '#ff0000', icon: 'T', label: 'סיום' },
  MIDDLE: { color: '#0099ff', icon: '', label: 'ביניים' },
};

const RetroFlashAddRoute = ({ wallImage, onClose, onRouteAdded }) => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [selectedHolds, setSelectedHolds] = useState(new Map()); // Map of "x,y" -> holdType
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeGrade, setRouteGrade] = useState(1); // V1-V16
  const [routeNotes, setRouteNotes] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Animation values
  const toolbarSlideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Grid configuration
  const GRID_COLS = 20;
  const GRID_ROWS = 30;
  const HOLD_SIZE = 30;
  
  // Image dimensions
  const imageWidth = screenWidth;
  const imageHeight = screenHeight * 0.8;
  
  React.useEffect(() => {
    // Animate toolbar in
    Animated.timing(toolbarSlideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Fade in grid
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);
  
  const getHoldKey = (col, row) => `${col},${row}`;
  
  const getHoldPosition = (col, row) => {
    const x = (col / GRID_COLS) * imageWidth;
    const y = (row / GRID_ROWS) * imageHeight;
    return { x, y };
  };
  
  const getGridFromTouch = (x, y) => {
    const col = Math.round((x / imageWidth) * GRID_COLS);
    const row = Math.round((y / imageHeight) * GRID_ROWS);
    return { col: Math.max(0, Math.min(GRID_COLS, col)), row: Math.max(0, Math.min(GRID_ROWS, row)) };
  };
  
  const cycleHoldType = (holdKey) => {
    const newHolds = new Map(selectedHolds);
    const currentType = selectedHolds.get(holdKey) || 'OFF';
    
    // Cycle: OFF -> START -> FINISH -> MIDDLE -> OFF
    const typeOrder = ['OFF', 'START', 'FINISH', 'MIDDLE'];
    const currentIndex = typeOrder.indexOf(currentType);
    const nextType = typeOrder[(currentIndex + 1) % typeOrder.length];
    
    if (nextType === 'OFF') {
      newHolds.delete(holdKey);
    } else {
      newHolds.set(holdKey, nextType);
    }
    
    // Save state for undo
    setUndoStack(prev => [...prev, new Map(selectedHolds)]);
    setRedoStack([]);
    setSelectedHolds(newHolds);
  };
  
  const handleImageTouch = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const { col, row } = getGridFromTouch(locationX, locationY);
    const holdKey = getHoldKey(col, row);
    
    cycleHoldType(holdKey);
  };
  
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setRedoStack(prev => [selectedHolds, ...prev]);
      setSelectedHolds(previousState);
      setUndoStack(prev => prev.slice(0, -1));
    }
  };
  
  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[0];
      setUndoStack(prev => [...prev, selectedHolds]);
      setSelectedHolds(nextState);
      setRedoStack(prev => prev.slice(1));
    }
  };
  
  const handleReset = () => {
    setUndoStack(prev => [...prev, selectedHolds]);
    setRedoStack([]);
    setSelectedHolds(new Map());
  };
  
  const handleDone = () => {
    // Validate route has start and finish
    const hasStart = Array.from(selectedHolds.values()).includes('START');
    const hasFinish = Array.from(selectedHolds.values()).includes('FINISH');
    
    if (!hasStart || !hasFinish) {
      Alert.alert('שגיאה', 'המסלול חייב לכלול לפחות נקודת התחלה ונקודת סיום');
      return;
    }
    
    setShowRouteForm(true);
  };
  
  const handleSaveRoute = async () => {
    if (!routeName.trim()) {
      Alert.alert('שגיאה', 'יש למלא שם למסלול');
      return;
    }
    
    try {
      // Convert holds to route format
      const holds = Array.from(selectedHolds.entries()).map(([key, type]) => {
        const [col, row] = key.split(',').map(Number);
        const { x, y } = getHoldPosition(col, row);
        
        return {
          x: x / imageWidth, // Normalize to 0-1
          y: y / imageHeight, // Normalize to 0-1
          type,
          color: HOLD_TYPES[type].color,
        };
      });
      
      // Get current spray wall
      const currentWall = await getCurrentSprayWall();
      if (!currentWall) {
        throw new Error('לא נמצא קיר ספריי פעיל');
      }
      
      const routeData = {
        name: routeName.trim(),
        grade: `V${routeGrade}`,
        notes: routeNotes.trim(),
        holds,
        sprayWallId: currentWall.id,
      };
      
      await addSprayRoute(routeData);
      
      Alert.alert('הצלחה!', 'המסלול נוסף בהצלחה', [
        {
          text: 'אישור',
          onPress: () => {
            if (onRouteAdded) onRouteAdded();
            onClose();
          }
        }
      ]);
    } catch (error) {
      Alert.alert('שגיאה', `שגיאה בשמירת המסלול: ${error.message}`);
    }
  };
  
  const renderHoldGrid = () => {
    const holds = [];
    
    for (let row = 0; row <= GRID_ROWS; row++) {
      for (let col = 0; col <= GRID_COLS; col++) {
        const holdKey = getHoldKey(col, row);
        const holdType = selectedHolds.get(holdKey) || 'OFF';
        const { x, y } = getHoldPosition(col, row);
        
        if (holdType !== 'OFF') {
          const holdConfig = HOLD_TYPES[holdType];
          holds.push(
            <View
              key={holdKey}
              style={[
                styles.hold,
                {
                  left: x - HOLD_SIZE / 2,
                  top: y - HOLD_SIZE / 2,
                  backgroundColor: holdConfig.color,
                  transform: [{ scale: zoomLevel }],
                }
              ]}
            >
              {holdConfig.icon && (
                <Text style={styles.holdIcon}>{holdConfig.icon}</Text>
              )}
            </View>
          );
        }
      }
    }
    
    return holds;
  };
  
  const gradeLabels = Array.from({ length: 16 }, (_, i) => `V${i + 1}`);
  
  return (
    <View style={styles.container}>
      {/* Background Image */}
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={handleImageTouch}
        activeOpacity={1}
      >
        <Image
          source={{ uri: wallImage }}
          style={styles.wallImage}
          resizeMode="cover"
        />
        
        {/* Hold Grid Overlay */}
        <Animated.View style={[styles.holdOverlay, { opacity: fadeAnim }]}>
          {renderHoldGrid()}
        </Animated.View>
      </TouchableOpacity>
      
      {/* Toolbar */}
      <Animated.View 
        style={[
          styles.toolbar,
          { transform: [{ translateY: toolbarSlideAnim }] }
        ]}
      >
        <TouchableOpacity 
          style={[styles.toolButton, !undoStack.length && styles.toolButtonDisabled]}
          onPress={handleUndo}
          disabled={!undoStack.length}
        >
          <Text style={styles.toolButtonText}>↶</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolButton, !redoStack.length && styles.toolButtonDisabled]}
          onPress={handleRedo}
          disabled={!redoStack.length}
        >
          <Text style={styles.toolButtonText}>↷</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolButton} onPress={handleReset}>
          <Text style={styles.toolButtonText}>🗑</Text>
        </TouchableOpacity>
        
        <View style={styles.zoomContainer}>
          <Text style={styles.zoomLabel}>זום</Text>
          <View style={styles.zoomSlider}>
            {[0.5, 1, 1.5, 2].map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.zoomButton,
                  zoomLevel === level && styles.zoomButtonActive
                ]}
                onPress={() => setZoomLevel(level)}
              >
                <Text style={styles.zoomButtonText}>{level}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>✓ סיום</Text>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
      
      {/* Route Form Modal */}
      <Modal
        visible={showRouteForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRouteForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>פרטי המסלול</Text>
            
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>שם המסלול</Text>
              <TextInput
                style={styles.textInput}
                value={routeName}
                onChangeText={setRouteName}
                placeholder="הזן שם למסלול..."
              />
            </View>
            
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>דירוג (V{routeGrade})</Text>
              <View style={styles.gradeSlider}>
                {gradeLabels.map((label, index) => (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.gradeButton,
                      routeGrade === index + 1 && styles.gradeButtonActive
                    ]}
                    onPress={() => setRouteGrade(index + 1)}
                  >
                    <Text style={[
                      styles.gradeButtonText,
                      routeGrade === index + 1 && styles.gradeButtonTextActive
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>הערות</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={routeNotes}
                onChangeText={setRouteNotes}
                placeholder="הערות על המסלול..."
                multiline
                numberOfLines={3}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRouteForm(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveRoute}
              >
                <Text style={styles.saveButtonText}>💾 שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(HOLD_TYPES).map(([type, config]) => {
          if (type === 'OFF') return null;
          return (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendHold, { backgroundColor: config.color }]}>
                {config.icon && (
                  <Text style={styles.legendIcon}>{config.icon}</Text>
                )}
              </View>
              <Text style={styles.legendLabel}>{config.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  wallImage: {
    width: '100%',
    height: '100%',
  },
  holdOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hold: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  holdIcon: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toolbar: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  toolButton: {
    backgroundColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 40,
    alignItems: 'center',
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  toolButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomContainer: {
    alignItems: 'center',
  },
  zoomLabel: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 5,
  },
  zoomSlider: {
    flexDirection: 'row',
    gap: 5,
  },
  zoomButton: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  zoomButtonActive: {
    backgroundColor: '#007AFF',
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 10,
  },
  doneButton: {
    backgroundColor: '#00ff00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  legend: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  legendHold: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendIcon: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  legendLabel: {
    color: '#fff',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#000',
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  gradeSlider: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  gradeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  gradeButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  gradeButtonTextActive: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#00ff00',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RetroFlashAddRoute;
