import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Alert,
  Dimensions,
  SafeAreaView,
  PanGestureHandler,
  TapGestureHandler,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import DimOverlay from '../components/DimOverlay';
import HoldMarker from '../components/HoldMarker';
import HoldsLegend from '../components/HoldsLegend';
import HoldRing from '../components/HoldRing';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function EnhancedAddRouteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { user } = useUser();
  const { sprayWallId, sprayWallImage } = route.params;

  const [selectedHolds, setSelectedHolds] = useState(new Set());
  const [highlightAreas, setHighlightAreas] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [allHolds, setAllHolds] = useState([]); // All holds (manually added)
  const [selectedHoldType, setSelectedHoldType] = useState('intermediate'); // Current hold type to place
  const [loading, setLoading] = useState(false); // No loading needed now
  const [ring, setRing] = useState({ cx: null, cy: null, r: null });

  const ringTypeColors = {
    start: '#4CAF50',
    intermediate: '#2196F3',
    crimp: '#FFEB3B',
    top: '#F44336'
  };

  const tapRef = useRef();
  const styles = createStyles(theme);

  useEffect(() => {
    initializeImageDimensions();
  }, [sprayWallImage]);

  const initializeImageDimensions = () => {
    // Calculate image dimensions for 4:3 aspect ratio
    const aspectRatio = 4 / 3;
    let displayWidth = screenWidth * 0.95;
    let displayHeight = displayWidth / aspectRatio;
    
    if (displayHeight > screenHeight * 0.6) {
      displayHeight = screenHeight * 0.6;
      displayWidth = displayHeight * aspectRatio;
    }

    setImageDimensions({
      width: displayWidth,
      height: displayHeight,
    });
    
    setImageLoaded(true);
  };

  // Add hold by tapping on the image - now places a ring
  const handleImageTap = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    if (!ring.cx) {
      setRing({
        cx: locationX,
        cy: locationY,
        r: imageDimensions.width * 0.06
      });
    }
  };

  // Gesture handling for ring manipulation
  const ringCX = useSharedValue(0);
  const ringCY = useSharedValue(0);
  const ringR = useSharedValue(0);
  const [tempRing, setTempRing] = useState({ cx: 0, cy: 0, r: 0 });

  useEffect(() => {
    if (ring.cx != null) {
      ringCX.value = ring.cx;
      ringCY.value = ring.cy;
      ringR.value = ring.r;
      setTempRing({ cx: ring.cx, cy: ring.cy, r: ring.r });
    }
  }, [ring]);

  const pan = Gesture.Pan()
    .onStart(() => {
      console.log('Pan started');
      // Store initial position for relative calculations
      ringCX.value = ring.cx;
      ringCY.value = ring.cy;
    })
    .onUpdate(e => {
      console.log('Pan update:', e.translationX, e.translationY);
      const newCX = Math.min(Math.max(ringCX.value + e.translationX, tempRing.r), imageDimensions.width - tempRing.r);
      const newCY = Math.min(Math.max(ringCY.value + e.translationY, tempRing.r), imageDimensions.height - tempRing.r);
      setTempRing(prev => ({ ...prev, cx: newCX, cy: newCY }));
    })
    .onEnd(() => {
      console.log('Pan ended');
      setRing(prev => ({ ...prev, cx: tempRing.cx, cy: tempRing.cy }));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      console.log('Pinch started');
      ringR.value = ring.r;
    })
    .onUpdate(e => {
      console.log('Pinch update:', e.scale);
      const newR = Math.max(12, Math.min(imageDimensions.width/2, ringR.value * e.scale));
      setTempRing(prev => ({ ...prev, r: newR }));
    })
    .onEnd(() => {
      console.log('Pinch ended');
      setRing(prev => ({ ...prev, r: tempRing.r }));
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  // Confirm ring and add to holds
  const confirmRing = () => {
    if (!ring.cx) return;
    const newHold = {
      id: `hold_${Date.now()}`,
      x: ring.cx / imageDimensions.width,
      y: ring.cy / imageDimensions.height,
      r: ring.r / Math.min(imageDimensions.width, imageDimensions.height),
      type: selectedHoldType
    };
    setAllHolds(prev => [...prev, newHold]);
    setSelectedHolds(prev => new Set([...prev, newHold.id]));
    setRing({ cx: null, cy: null, r: null });
  };

  // Handle hold type selection from legend
  const handleHoldTypeSelect = (type) => {
    // Prevent changing hold type when ring is active
    if (ring.cx) return;
    setSelectedHoldType(type);
  };

  // Update highlight areas for visual feedback
  const updateHighlightAreas = (holdId, isSelected, absoluteX = null, absoluteY = null) => {
    const hold = allHolds.find(h => h.id === holdId);
    if (!hold && absoluteX === null) return;

    const x = absoluteX !== null ? absoluteX : hold.x * imageDimensions.width;
    const y = absoluteY !== null ? absoluteY : hold.y * imageDimensions.height;

    setHighlightAreas(prev => {
      const filtered = prev.filter(area => area.holdId !== holdId);
      
      if (isSelected) {
        return [...filtered, { x, y, r: 35, holdId }];
      }
      
      return filtered;
    });
  };

  const onHoldPress = (holdId) => {
    console.log('Hold pressed:', holdId);
    
    setSelectedHolds(prev => {
      const newSet = new Set(prev);
      const wasSelected = newSet.has(holdId);
      
      if (wasSelected) {
        newSet.delete(holdId);
      } else {
        newSet.add(holdId);
      }
      
      // Update highlight areas
      updateHighlightAreas(holdId, !wasSelected);
      
      return newSet;
    });
  };

  // Delete hold function
  const deleteHold = (holdId) => {
    setAllHolds(prev => prev.filter(hold => hold.id !== holdId));
    
    // Remove from selected holds if it was selected
    setSelectedHolds(prev => {
      const newSet = new Set(prev);
      newSet.delete(holdId);
      return newSet;
    });
    
    // Remove highlight
    setHighlightAreas(prev => prev.filter(area => area.holdId !== holdId));
  };

  const handleSave = async () => {
    if (selectedHolds.size < 2) {
      Alert.alert('שגיאה', 'יש לבחור לפחות 2 אחיזות למסלול');
      return;
    }

    const startHolds = Array.from(selectedHolds).filter(holdId => {
      const hold = allHolds.find(h => h.id === holdId);
      return hold && hold.type === 'start';
    });

    const topHolds = Array.from(selectedHolds).filter(holdId => {
      const hold = allHolds.find(h => h.id === holdId);
      return hold && hold.type === 'top';
    });

    if (startHolds.length === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות אחיזת התחלה אחת (ירוק)');
      return;
    }

    if (topHolds.length === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות אחיזת סיום אחת (אדום)');
      return;
    }

    setIsSaving(true);

    try {
      // Prepare route data
      const selectedHoldsData = Array.from(selectedHolds).map(holdId => {
        const hold = allHolds.find(h => h.id === holdId);
        return {
          id: hold.id,
          x: hold.x, // Already in relative coordinates (0-1)
          y: hold.y, // Already in relative coordinates (0-1)
          type: hold.type,
        };
      });

      const routeData = {
        name: `מסלול ${Date.now()}`,
        sprayWallId,
        holds: selectedHoldsData,
        grade: 'V3', // This would be set by user in a future step
        style: 'Boulder',
        description: '',
        createdBy: user.uid,
        creatorName: user.displayName || 'משתמש',
        creatorAvatar: user.photoURL,
        imageUrl: sprayWallImage,
        imageDimensions,
      };

      // Save route to database
      const newRoute = await createSprayRoute(routeData);
      
      Alert.alert(
        'הצלחה!',
        'המסלול נשמר בהצלחה',
        [
          { 
            text: 'OK', 
            onPress: () => navigation.goBack() 
          }
        ]
      );

    } catch (error) {
      console.error('Error saving route:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את המסלול');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (selectedHolds.size > 0) {
      Alert.alert(
        'ביטול',
        'האם אתה בטוח שברצונך לבטל? כל הבחירות יאבדו.',
        [
          { text: 'ביטול', style: 'cancel' },
          { 
            text: 'כן, בטל', 
            style: 'destructive',
            onPress: () => navigation.goBack() 
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  if (!imageLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>טוען...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleCancel}
        >
          <Text style={styles.headerButtonText}>ביטול</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>הוסף מסלול</Text>
        
        <TouchableOpacity
          style={[styles.headerButton, styles.saveButton]}
          onPress={handleSave}
          disabled={isSaving || !!ring.cx} // Ensure boolean value
        >
          <Text style={[styles.headerButtonText, styles.saveButtonText]}>
            {isSaving ? 'שומר...' : 'שמור'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hold Type Selection */}
      <View style={styles.holdTypeSelector}>
        <Text style={styles.holdTypeSelectorTitle}>בחר סוג אחיזה להוספה:</Text>
        <View style={styles.holdTypeButtons}>
          {[
            { type: 'start', label: 'התחלה', color: '#4CAF50' },
            { type: 'intermediate', label: 'ביניים', color: '#2196F3' },
            { type: 'crimp', label: 'אחיזות רגליים', color: '#FFEB3B' },
            { type: 'top', label: 'סיום', color: '#F44336' },
          ].map(holdType => (
            <TouchableOpacity
              key={holdType.type}
              style={[
                styles.holdTypeButton,
                { borderColor: holdType.color },
                selectedHoldType === holdType.type && { backgroundColor: holdType.color },
                ring.cx && { opacity: 0.5 } // Dim when ring is active
              ]}
              onPress={() => handleHoldTypeSelect(holdType.type)}
              disabled={!!ring.cx} // Ensure boolean value
            >
              <Text style={[
                styles.holdTypeButtonText,
                selectedHoldType === holdType.type && { color: '#fff' }
              ]}>
                {holdType.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          {ring.cx ? 
            '🎯 גרור את העיגול ושנה גודל עם פינץ\' • לחץ ✔️ לאישור' :
            '🎯 לחץ על התמונה להוספת אחיזה • לחץ על אחיזה לבחירה • לחץ ארוך למחיקה'
          }
        </Text>
      </View>

      {/* Confirm Ring Button - appears when ring is active */}
      {ring.cx != null && (
        <View style={styles.confirmRingContainer}>
          <TouchableOpacity
            style={styles.cancelRingButton}
            onPress={() => setRing({ cx: null, cy: null, r: null })}
          >
            <Text style={styles.cancelRingButtonText}>✖ ביטול</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmRingButton}
            onPress={confirmRing}
          >
            <Text style={styles.confirmRingButtonText}>✔️ אשר אחיזה</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Image Area */}
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={handleImageTap}
        activeOpacity={1}
      >
        <ImageBackground
          source={{ uri: sprayWallImage }}
          style={[styles.imageBackground, {
            width: imageDimensions.width,
            height: imageDimensions.height,
          }]}
          resizeMode="cover"
        >
          {/* Dim overlay with bright spots around selected holds */}
          <DimOverlay highlightAreas={highlightAreas} />

          {/* Ring overlay for new hold placement */}
          {ring.cx != null && (
            <GestureDetector gesture={composed}>
              <View collapsable={false}>
                <HoldRing
                  imageWidth={imageDimensions.width}
                  imageHeight={imageDimensions.height}
                  cx={tempRing.cx}
                  cy={tempRing.cy}
                  r={tempRing.r}
                  color={ringTypeColors[selectedHoldType]}
                />
              </View>
            </GestureDetector>
          )}

          {/* Hold markers */}
          {allHolds.map(hold => (
            <HoldMarker
              key={hold.id}
              x={hold.x * imageDimensions.width}
              y={hold.y * imageDimensions.height}
              type={hold.type}
              selected={selectedHolds.has(hold.id)}
              onPress={() => onHoldPress(hold.id)}
              onLongPress={() => deleteHold(hold.id)}
              size={30}
            />
          ))}
        </ImageBackground>
      </TouchableOpacity>

      {/* Stats */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          נבחרו: {selectedHolds.size} אחיזות
        </Text>
        <Text style={styles.statsSubText}>
          התחלה: {Array.from(selectedHolds).filter(id => allHolds.find(h => h.id === id)?.type === 'start').length} • 
          סיום: {Array.from(selectedHolds).filter(id => allHolds.find(h => h.id === id)?.type === 'top').length}
        </Text>
      </View>

      {/* Holds Legend */}
      <HoldsLegend />
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingBottom: 34, // Add bottom padding for safe area on phones with home indicator
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.border,
    minWidth: 80,
  },
  saveButton: {
    backgroundColor: theme.primary,
  },
  headerButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
    textAlign: 'center',
  },
  holdTypeSelector: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  holdTypeSelectorTitle: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  holdTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  holdTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  holdTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.card,
  },
  instructionText: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    paddingVertical: 20,
  },
  imageBackground: {
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  stats: {
    backgroundColor: theme.surface,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    marginBottom: 20, // Add margin to push content away from home button area
  },
  statsText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '600',
  },
  statsSubText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  confirmRingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  cancelRingButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  confirmRingButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cancelRingButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confirmRingButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
