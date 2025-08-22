import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/features/theme/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AdminWallSetupScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const [selectedImage, setSelectedImage] = useState(null);
  const [holds, setHolds] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isUploading, setIsUploading] = useState(false);

  // Animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);

  const styles = createStyles(theme);

  const selectImage = async () => {
    // TODO: Implement image picker
    // For now, use a test image
    const testImageUrl = "https://res.cloudinary.com/dfpkhezq6/image/upload/v1754052283/walls/test_wall.jpg";
    setSelectedImage(testImageUrl);
  };

  const onImageLoad = (event) => {
    const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
    
    // Calculate display dimensions maintaining aspect ratio
    const aspectRatio = imgWidth / imgHeight;
    let displayWidth = screenWidth * 0.9;
    let displayHeight = displayWidth / aspectRatio;
    
    if (displayHeight > screenHeight * 0.5) {
      displayHeight = screenHeight * 0.5;
      displayWidth = displayHeight * aspectRatio;
    }

    console.log('Admin setup - Image loaded:', { imgWidth, imgHeight, displayWidth, displayHeight });

    setImageDimensions({
      width: displayWidth,
      height: displayHeight,
      originalWidth: imgWidth,
      originalHeight: imgHeight,
    });
    
    imageWidth.value = displayWidth;
    imageHeight.value = displayHeight;
    setImageLoaded(true);
  };

  // Simple tap gesture for marking holds
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      'worklet';
      console.log('Admin tap at:', event.x, event.y);
      
      if (imageWidth.value > 0 && imageHeight.value > 0) {
        runOnJS(addPresetHold)(event.x, event.y);
      }
    });

  const addPresetHold = (screenX, screenY) => {
    console.log('Admin adding preset hold at screen coords:', screenX, screenY);
    
    // Convert screen coordinates to relative coordinates (0-1)
    const relativeX = screenX / imageDimensions.width;
    const relativeY = screenY / imageDimensions.height;
    
    console.log('Relative coordinates:', relativeX, relativeY);
    
    // Check if within image bounds
    if (relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1) {
      const holdId = `preset_hold_${Date.now()}`;
      const newHold = {
        id: holdId,
        x: relativeX,
        y: relativeY,
        type: 'available', // Available for selection
        number: holds.length + 1, // Sequential numbering
      };
      
      console.log('Adding preset hold:', newHold);
      setHolds(prevHolds => [...prevHolds, newHold]);
    } else {
      console.log('Tap outside image bounds');
    }
  };

  const removeHold = (holdId) => {
    setHolds(prevHolds => prevHolds.filter(h => h.id !== holdId));
  };

  const saveWallSetup = async () => {
    if (holds.length < 10) {
      Alert.alert('שגיאה', 'יש לסמן לפחות 10 אחיזות על הקיר');
      return;
    }

    setIsUploading(true);
    
    try {
      const wallData = {
        name: `Wall ${Date.now()}`,
        imageUrl: selectedImage,
        presetHolds: holds,
        imageDimensions,
        createdAt: new Date(),
        isActive: true,
      };

      console.log('Saving wall data:', wallData);
      
      // TODO: Save to Firestore - wall functionality for regular routes
      
      Alert.alert(
        'הצלחה!', 
        `הקיר נשמר בהצלחה עם ${holds.length} אחיזות מוכנות`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
      
    } catch (error) {
      console.error('Error saving wall:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את הקיר');
    } finally {
      setIsUploading(false);
    }
  };

  const renderPresetHold = (hold) => {
    const holdStyle = {
      position: 'absolute',
      left: hold.x * imageDimensions.width - 20,
      top: hold.y * imageDimensions.height - 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76,175,80,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    };

    return (
      <TouchableOpacity 
        key={hold.id} 
        style={holdStyle}
        onPress={() => removeHold(hold.id)}
      >
        <Text style={styles.holdNumber}>{hold.number}</Text>
      </TouchableOpacity>
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>הגדרת קיר לאדמין</Text>
        <TouchableOpacity
          style={[styles.saveButton, (!selectedImage || holds.length < 10) && styles.saveButtonDisabled]}
          onPress={saveWallSetup}
          disabled={!selectedImage || holds.length < 10 || isUploading}
        >
          <Text style={styles.saveButtonText}>
            {isUploading ? 'שומר...' : 'שמור'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            👆 לחץ לבחירת תמונה • 🎯 לחץ על התמונה לסימון אחיזות • ❌ לחץ על אחיזה למחיקה
          </Text>
        </View>

        {/* Image Selection */}
        {!selectedImage && (
          <TouchableOpacity style={styles.imageSelector} onPress={selectImage}>
            <Text style={styles.imageSelectorText}>📷</Text>
            <Text style={styles.imageSelectorLabel}>בחר תמונת קיר</Text>
          </TouchableOpacity>
        )}

        {/* Image Container */}
        {selectedImage && (
          <View style={styles.imageContainer}>
            {imageLoaded && (
              <View style={styles.imageWrapper}>
                <GestureDetector gesture={tapGesture}>
                  <Animated.View style={[styles.imageHolder, animatedStyle]}>
                    <Image
                      source={{ uri: selectedImage }}
                      style={[styles.image, {
                        width: imageDimensions.width,
                        height: imageDimensions.height,
                      }]}
                      onLoad={onImageLoad}
                      resizeMode="contain"
                    />
                    {holds.map(renderPresetHold)}
                  </Animated.View>
                </GestureDetector>
              </View>
            )}

            {!imageLoaded && selectedImage && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>טוען תמונה...</Text>
                <Image
                  source={{ uri: selectedImage }}
                  style={{ width: 0, height: 0 }}
                  onLoad={onImageLoad}
                />
              </View>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            אחיזות מסומנות: {holds.length} (מינימום: 10)
          </Text>
          {holds.length >= 10 && (
            <Text style={styles.statsSuccess}>✅ מספיק אחיזות לשמירה</Text>
          )}
          {selectedImage && holds.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setHolds([])}
            >
              <Text style={styles.clearButtonText}>🗑️ נקה הכל</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
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
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.border,
  },
  backButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  saveButtonDisabled: {
    backgroundColor: theme.border,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.card,
    margin: 10,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  imageSelector: {
    margin: 20,
    padding: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: theme.surface,
  },
  imageSelectorText: {
    fontSize: 48,
    marginBottom: 10,
  },
  imageSelectorLabel: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '600',
  },
  imageContainer: {
    margin: 20,
    alignItems: 'center',
  },
  imageWrapper: {
    position: 'relative',
  },
  imageHolder: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  holdNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  stats: {
    backgroundColor: theme.surface,
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 8,
  },
  statsSuccess: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 12,
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f44336',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
