import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import ZoomableImage from '@/components/spray/ZoomableImage';
import HoldRing from '@/components/spray/HoldRing';
import GlobalHoldEditor from '@/components/spray/GlobalHoldEditor';
import HoldTypeSelector from '@/components/spray/HoldTypeSelector';
import Toolbar from '@/components/spray/Toolbar';
import { useSprayEditor } from '@/features/spraywall/useSprayEditor';
import { sprayApi } from '@/features/spraywall/sprayApi';
import { validateRouteData, denormalizeHoldPosition } from '@/features/spraywall/validations';
import { auth } from '@/features/data/firebase';

const SprayEditorScreen = ({ navigation, route }) => {
  const { wallId, seasonId, season } = route.params;
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeGrade, setRouteGrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });

  const {
    holds,
    selectedHoldType,
    selectedHoldIndex,
    isEditing,
    tapes,
    numbersEnabled,
    setSelectedHoldType,
    setSelectedHoldIndex,
    setTapes,
    setNumbersEnabled,
    addHold,
    updateHold,
    removeHold,
    clearHolds,
    beginEditingHold,
    confirmCurrentHold,
    getSelectedHold,
  } = useSprayEditor();

  // SharedValues לטבעת שנבחרה - יעודכנו ישירות מ-GlobalHoldEditor
  const selectedTranslateX = useSharedValue(0);
  const selectedTranslateY = useSharedValue(0);
  const selectedRadius = useSharedValue(24);

  // פונקציה לcommit SharedValues ל-state
  const commitGestureToState = () => {
    if (!isEditing || imageLayout.width === 0) return;
    
    const hold = getSelectedHold();
    if (!hold) return;
    
    updateHold(selectedHoldIndex, {
      x: selectedTranslateX.value,
      y: selectedTranslateY.value,
      r: selectedRadius.value,
    }, imageLayout.width, imageLayout.height);
  };

  // עדכן SharedValues כשנבחרת טבעת חדשה
  useEffect(() => {
    console.log('SharedValues update effect:', { isEditing, imageWidth: imageLayout.width, selectedHoldIndex });
    if (isEditing && imageLayout.width > 0) {
      const hold = getSelectedHold();
      console.log('Initializing SharedValues for hold:', hold);
      if (hold) {
        const minSide = Math.min(imageLayout.width, imageLayout.height);
        selectedTranslateX.value = hold.x * imageLayout.width;
        selectedTranslateY.value = hold.y * imageLayout.height;
        selectedRadius.value = hold.r * minSide;
        console.log('SharedValues set to:', {
          x: selectedTranslateX.value,
          y: selectedTranslateY.value, 
          r: selectedRadius.value
        });
      }
    }
  }, [selectedHoldIndex, imageLayout.width, imageLayout.height, isEditing]);

  const handleImageLayout = (layout) => {
    console.log('Image layout received:', layout);
    setImageLayout(layout);
  };

  const handleImagePress = (x, y, imageWidth, imageHeight) => {
    // Only add hold if a hold type is selected
    if (selectedHoldType) {
      console.log('Adding hold:', { x, y, imageWidth, imageHeight, type: selectedHoldType });
      addHold(x, y, imageWidth, imageHeight);
      console.log('Hold added successfully');
    } else {
      console.log('No hold type selected, ignoring press');
    }
  };

  const handleHoldUpdate = (index, updates) => {
    updateHold(index, updates, imageLayout.width, imageLayout.height);
  };

  const handleConfirmHold = () => {
    confirmCurrentHold();
  };

  const handleDeleteHold = () => {
    if (selectedHoldIndex >= 0) {
      removeHold(selectedHoldIndex);
    }
  };

  const handleToggleTapes = () => {
    // Simple implementation - could be more sophisticated
    setTapes(prev => ({
      ...prev,
      start: prev.start > 0 ? 0 : 2,
      top: prev.top > 0 ? 0 : 2,
    }));
  };

  const handleToggleNumbers = () => {
    setNumbersEnabled(!numbersEnabled);
  };

  const handleNext = () => {
    const validation = validateRouteData({
      name: 'temp',
      grade: 'temp',
      holds,
    });

    if (!validation.valid) {
      Alert.alert('Invalid Route', validation.error);
      return;
    }

    setShowRouteModal(true);
  };

  const handleSaveRoute = async () => {
    if (!routeName.trim() || !routeGrade.trim()) {
      Alert.alert('Error', 'Please enter route name and grade');
      return;
    }

    try {
      setSaving(true);

      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save a route');
        return;
      }

      const routeData = {
        name: routeName.trim(),
        grade: routeGrade.trim(),
        setterId: user.uid,
        setterName: user.displayName || user.email,
        holds,
        tapes,
        numbersEnabled,
      };

      await sprayApi.createRoute(wallId, seasonId, routeData);

      Alert.alert(
        'Success',
        'Route saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving route:', error);
      Alert.alert('Error', 'Failed to save route. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderHolds = () => {
    console.log('Rendering holds:', holds, 'imageLayout:', imageLayout);
    
    if (!imageLayout.width || !imageLayout.height) {
      console.log('No image layout yet, skipping hold rendering');
      return null;
    }
    
    return (
      <>
        {holds.map((hold, index) => {
          return (
            <HoldRing
              key={hold.id}
              hold={hold}
              imageWidth={imageLayout.width}
              imageHeight={imageLayout.height}
              isSelected={index === selectedHoldIndex}
              globalEditingActive={isEditing}
              onUpdate={(updates) => handleHoldUpdate(index, updates)}
              onSelect={() => beginEditingHold(index)}
              showTapes={tapes.start > 0 || tapes.top > 0}
              showNumber={numbersEnabled}
              holdNumber={index + 1}
              // העבר SharedValues רק לטבעת שנבחרה וכשיש עריכה פעילה
              externalTranslateX={isEditing && index === selectedHoldIndex ? selectedTranslateX : undefined}
              externalTranslateY={isEditing && index === selectedHoldIndex ? selectedTranslateY : undefined}
              externalRadius={isEditing && index === selectedHoldIndex ? selectedRadius : undefined}
            />
          );
        })}
        
        {/* Global Hold Editor - active when editing */}
        {isEditing && imageLayout.width > 0 && imageLayout.height > 0 && (
          <GlobalHoldEditor
            selectedHold={getSelectedHold()}
            imageWidth={imageLayout.width}
            imageHeight={imageLayout.height}
            translateXShared={selectedTranslateX}
            translateYShared={selectedTranslateY}
            radiusShared={selectedRadius}
            commitToState={commitGestureToState}
          />
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Route</Text>
        <TouchableOpacity onPress={handleNext}>
          <Text style={styles.nextText}>Next</Text>
        </TouchableOpacity>
      </View>

        <HoldTypeSelector
          selectedType={selectedHoldType}
          onTypeSelect={setSelectedHoldType}
        />

        {/* Mode indicator */}
        <View style={styles.modeIndicator}>
          <Text style={styles.modeText}>
            {isEditing 
              ? `Editing hold ${selectedHoldIndex + 1} - Drag/pinch anywhere to move/resize` 
              : selectedHoldType 
                ? `Tap to place ${selectedHoldType.toLowerCase()} holds` 
                : 'Pan & zoom mode - Select hold type to add holds'
            }
          </Text>
        </View>

        <View style={styles.imageContainer}>
          <ZoomableImage
            source={{ uri: season.imageURL }}
            onImagePress={handleImagePress}
            onImageLayout={handleImageLayout}
            showDimming={true}
            allowPanning={!selectedHoldType && !isEditing} // Disable panning when hold type is selected OR when editing a hold
            globalEditingActive={isEditing} // Allow GlobalHoldEditor to capture touches
            style={styles.zoomableImage}
          >
            {renderHolds()}
          </ZoomableImage>
        </View>

        <Toolbar
          onConfirm={handleConfirmHold}
          onDelete={handleDeleteHold}
          onToggleTapes={handleToggleTapes}
          onToggleNumbers={handleToggleNumbers}
          tapesEnabled={tapes.start > 0 || tapes.top > 0}
          numbersEnabled={numbersEnabled}
          canConfirm={selectedHoldIndex >= 0}
          canDelete={selectedHoldIndex >= 0}
        />

        {/* Route Details Modal */}
        <Modal
          visible={showRouteModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRouteModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Route Details</Text>
              <TouchableOpacity 
                onPress={handleSaveRoute}
                disabled={saving}
              >
                <Text style={[styles.modalSave, saving && styles.disabled]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Route Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={routeName}
                  onChangeText={setRouteName}
                  placeholder="Enter route name"
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Grade *</Text>
                <TextInput
                  style={styles.textInput}
                  value={routeGrade}
                  onChangeText={setRouteGrade}
                  placeholder="e.g., V4, 6B+"
                />
              </View>

              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>Route Summary</Text>
                <Text style={styles.summaryText}>
                  • {holds.length} holds total
                </Text>
                <Text style={styles.summaryText}>
                  • {holds.filter(h => h.type === 'START').length} start holds
                </Text>
                <Text style={styles.summaryText}>
                  • {holds.filter(h => h.type === 'TOP').length} top holds
                </Text>
                <Text style={styles.summaryText}>
                  • {holds.filter(h => h.type === 'MID').length} mid holds
                </Text>
                <Text style={styles.summaryText}>
                  • {holds.filter(h => h.type === 'FOOT').length} foot holds
                </Text>
                {numbersEnabled && (
                  <Text style={styles.summaryText}>• Numbers enabled</Text>
                )}
                {(tapes.start > 0 || tapes.top > 0) && (
                  <Text style={styles.summaryText}>• Tape markings enabled</Text>
                )}
              </View>
            </View>
          </SafeAreaView>
        </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  cancelText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  nextText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  zoomableImage: {
    width: '95%',
    aspectRatio: 4/3, // Force 4:3 aspect ratio
    maxHeight: '80%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancel: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSave: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  summaryContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modeIndicator: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  modeText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default SprayEditorScreen;
