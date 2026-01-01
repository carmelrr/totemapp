// src/screens/CommunityRoutes/AddCommunityRouteScreen.tsx
// Screen for creating a new community route on a real wall photo

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/features/theme/ThemeContext';
import { WallImageWithHolds } from '@/components/spray/WallImageWithHolds';
import { HoldTypePicker } from '@/components/spray/HoldTypePicker';
import { GradePicker } from '@/components/spray/GradePicker';
import { useCreateCommunityRoute, Hold, HoldType, HOLD_TYPES } from '@/features/community-routes';

// Generate unique ID
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

type Step = 'image' | 'holds' | 'details';

export const AddCommunityRouteScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { create, saving } = useCreateCommunityRoute();

  // Current step
  const [step, setStep] = useState<Step>('image');

  // Image state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);

  // Holds state
  const [selectedHoldType, setSelectedHoldType] = useState<HoldType>('middle');
  const [lockedHolds, setLockedHolds] = useState<Hold[]>([]);
  const [activeHold, setActiveHold] = useState<Hold | null>(null);
  const activeHoldRef = useRef<Hold | null>(null);
  activeHoldRef.current = activeHold;

  // Route details
  const [routeName, setRouteName] = useState('');
  const [routeGrade, setRouteGrade] = useState('V3');
  const [gymName, setGymName] = useState('');
  const [description, setDescription] = useState('');

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageWidth(asset.width || 1000);
        setImageHeight(asset.height || 1000);
        setStep('holds');
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לפתוח את הגלריה');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('שגיאה', 'נדרשת הרשאה למצלמה');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageWidth(asset.width || 1000);
        setImageHeight(asset.height || 1000);
        setStep('holds');
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לפתוח את המצלמה');
    }
  };

  // Create new hold when tapping on image
  const handleCreateHold = useCallback((normalizedX: number, normalizedY: number) => {
    const holdTypeInfo = HOLD_TYPES[selectedHoldType];
    const newHold: Hold = {
      id: generateId(),
      x: normalizedX,
      y: normalizedY,
      radius: 0.05,
      type: selectedHoldType,
      color: holdTypeInfo.color,
    };
    setActiveHold(newHold);
  }, [selectedHoldType]);

  // Update active hold during drag/resize
  const handleUpdateActiveHold = useCallback((updated: Hold) => {
    setActiveHold(updated);
  }, []);

  // Confirm (lock) the active hold
  const handleConfirmActiveHold = useCallback(() => {
    const currentHold = activeHoldRef.current;
    if (!currentHold) return;
    setLockedHolds((prev) => [...prev, currentHold]);
    setActiveHold(null);
  }, []);

  // Cancel active hold
  const handleCancelActiveHold = useCallback(() => {
    setActiveHold(null);
  }, []);

  // Select existing hold for editing
  const handleSelectExistingHold = useCallback((hold: Hold) => {
    setLockedHolds((prev) => prev.filter((h) => h.id !== hold.id));
    setActiveHold(hold);
  }, []);

  // Clear all holds
  const handleClearHolds = useCallback(() => {
    Alert.alert('מחיקת כל האחיזות', 'האם למחוק את כל האחיזות?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => {
          setLockedHolds([]);
          setActiveHold(null);
        },
      },
    ]);
  }, []);

  // Go to details step
  const handleContinueToDetails = () => {
    if (lockedHolds.length === 0) {
      Alert.alert('שגיאה', 'יש לסמן לפחות אחיזה אחת');
      return;
    }
    setStep('details');
  };

  // Save route
  const handleSave = async () => {
    if (!routeName.trim()) {
      Alert.alert('שגיאה', 'יש להזין שם למסלול');
      return;
    }

    if (!imageUri) {
      Alert.alert('שגיאה', 'יש לבחור תמונה');
      return;
    }

    try {
      await create(
        imageUri,
        imageWidth,
        imageHeight,
        routeName.trim(),
        routeGrade,
        lockedHolds,
        {
          gymName: gymName.trim() || undefined,
          description: description.trim() || undefined,
        }
      );

      Alert.alert('הצלחה!', 'המסלול נוצר בהצלחה ויהיה זמין ל-30 ימים', [
        {
          text: 'אישור',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('שגיאה', error.message || 'לא הצלחנו לשמור את המסלול');
    }
  };

  // Render step 1: Image selection
  const renderImageStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: theme.text }]}>בחר תמונה</Text>
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          צלם או בחר תמונה של הקיר שעליו תרצה ליצור מסלול
        </Text>
      </View>

      <View style={styles.imageOptions}>
        <TouchableOpacity
          style={[styles.imageOptionButton, { backgroundColor: theme.primary }]}
          onPress={takePhoto}
        >
          <Ionicons name="camera" size={48} color="#fff" />
          <Text style={styles.imageOptionText}>צלם תמונה</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.imageOptionButton, { backgroundColor: theme.surface }]}
          onPress={pickImage}
        >
          <Ionicons name="images" size={48} color={theme.primary} />
          <Text style={[styles.imageOptionText, { color: theme.text }]}>
            בחר מהגלריה
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render step 2: Hold marking
  const renderHoldsStep = () => (
    <View style={styles.holdsContainer}>
      {/* Image with holds */}
      {imageUri && (
        <View style={styles.imageSection}>
          <WallImageWithHolds
            imageUrl={imageUri}
            holds={lockedHolds}
            activeHold={activeHold}
            routeColor={HOLD_TYPES[selectedHoldType].color}
            onCreateHold={handleCreateHold}
            onUpdateActiveHold={handleUpdateActiveHold}
            onSelectHold={handleSelectExistingHold}
            editable={true}
          />

          {/* Active hold actions */}
          {activeHold && (
            <View style={styles.activeHoldActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelActiveHold}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.confirmButton]}
                onPress={handleConfirmActiveHold}
              >
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Hold type picker */}
      <View style={styles.holdTypeSection}>
        <HoldTypePicker
          selectedType={selectedHoldType}
          onSelectType={setSelectedHoldType}
        />
      </View>

      {/* Bottom actions */}
      <View style={[styles.bottomActions, { backgroundColor: theme.surface }]}>
        <View style={styles.holdsCount}>
          <Text style={[styles.holdsCountText, { color: theme.text }]}>
            {lockedHolds.length} אחיזות
          </Text>
          {lockedHolds.length > 0 && (
            <TouchableOpacity onPress={handleClearHolds}>
              <Text style={styles.clearText}>נקה הכל</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: theme.primary },
            lockedHolds.length === 0 && styles.disabledButton,
          ]}
          onPress={handleContinueToDetails}
          disabled={lockedHolds.length === 0}
        >
          <Text style={styles.continueButtonText}>המשך</Text>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render step 3: Route details
  const renderDetailsStep = () => (
    <KeyboardAvoidingView
      style={styles.detailsContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.detailsContent}>
        {/* Preview image */}
        {imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>
                {lockedHolds.length} אחיזות
              </Text>
            </View>
          </View>
        )}

        {/* Route name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            שם המסלול *
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: theme.surface, color: theme.text },
            ]}
            value={routeName}
            onChangeText={setRouteName}
            placeholder="לדוגמה: הקרימפ הקטלני"
            placeholderTextColor={theme.textSecondary}
            textAlign="right"
          />
        </View>

        {/* Grade */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>דירוג</Text>
          <GradePicker
            selectedGrade={routeGrade}
            onSelectGrade={setRouteGrade}
          />
        </View>

        {/* Gym name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            שם המכון (אופציונלי)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: theme.surface, color: theme.text },
            ]}
            value={gymName}
            onChangeText={setGymName}
            placeholder="לדוגמה: קליימביט"
            placeholderTextColor={theme.textSecondary}
            textAlign="right"
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            תיאור (אופציונלי)
          </Text>
          <TextInput
            style={[
              styles.textAreaInput,
              { backgroundColor: theme.surface, color: theme.text },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="טיפים, תיאור המסלול..."
            placeholderTextColor={theme.textSecondary}
            textAlign="right"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Expiration notice */}
        <View style={[styles.expirationNotice, { backgroundColor: theme.surface }]}>
          <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
          <Text style={[styles.expirationNoticeText, { color: theme.textSecondary }]}>
            המסלול יהיה זמין ל-30 ימים ולאחר מכן יימחק אוטומטית
          </Text>
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={[styles.saveButtonContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving || !routeName.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>צור מסלול</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // Header with back button
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.headerGradient }]}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => {
          if (step === 'details') {
            setStep('holds');
          } else if (step === 'holds') {
            setStep('image');
            setImageUri(null);
            setLockedHolds([]);
          } else {
            navigation.goBack();
          }
        }}
      >
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {step === 'image' && 'בחר תמונה'}
        {step === 'holds' && 'סמן אחיזות'}
        {step === 'details' && 'פרטי המסלול'}
      </Text>
      <View style={styles.headerButton} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {renderHeader()}
      {step === 'image' && renderImageStep()}
      {step === 'holds' && renderHoldsStep()}
      {step === 'details' && renderDetailsStep()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  stepHeader: {
    marginBottom: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  imageOptions: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  imageOptionButton: {
    width: 140,
    height: 140,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageOptionText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  holdsContainer: {
    flex: 1,
  },
  imageSection: {
    flex: 1,
    position: 'relative',
  },
  activeHoldActions: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  holdTypeSection: {
    paddingVertical: 12,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  holdsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  holdsCountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 14,
    color: '#FF6B6B',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  detailsContainer: {
    flex: 1,
  },
  detailsContent: {
    padding: 20,
    paddingBottom: 100,
  },
  previewContainer: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  textAreaInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  expirationNotice: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 12,
  },
  expirationNoticeText: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 20,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddCommunityRouteScreen;
