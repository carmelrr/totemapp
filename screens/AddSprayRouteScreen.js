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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { getAvailableHolds, findNearestHold } from '../services/holdDetectionService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AddSprayRouteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { sprayWallId, sprayWallImage } = route.params;

  const [holds, setHolds] = useState([]);
  const [availableHolds, setAvailableHolds] = useState([]); // אחיזות זמינות מהגריד האוטומטי
  const [footRule, setFootRule] = useState('feet_follow_hands'); // 'feet_follow_hands' | 'open_feet' | 'no_feet'
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  
  // Shared values for image dimensions
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);

  const styles = createStyles(theme);

  // טעינת האחיזות הזמינות מהגריד האוטומטי
  const loadAvailableHolds = async () => {
    try {
      const holds = await getAvailableHolds(sprayWallId);
      setAvailableHolds(holds);
    } catch (error) {
      // Silent fail
    }
  };

  const onImageLoad = (event) => {
    const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
    
    // Calculate display dimensions maintaining aspect ratio
    const aspectRatio = imgWidth / imgHeight;
    let displayWidth = screenWidth;
    let displayHeight = screenWidth / aspectRatio;
    
    if (displayHeight > screenHeight * 0.7) {
      displayHeight = screenHeight * 0.7;
      displayWidth = displayHeight * aspectRatio;
    }

    setImageDimensions({
      width: displayWidth,
      height: displayHeight,
      originalWidth: imgWidth,
      originalHeight: imgHeight,
    });
    
    // Update shared values for use in worklets
    imageWidth.value = displayWidth;
    imageHeight.value = displayHeight;
    
    // טעינת האחיזות הזמינות מהגריד האוטומטי
    loadAvailableHolds();
    
    setImageLoaded(true);
  };

  const onImageError = (error) => {
    console.error('Error loading image:', error);
    Alert.alert('שגיאה', 'לא ניתן לטעון את תמונת הקיר');
  };

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      console.log('Pinch onStart, scale start:', scale.value);
    })
    .onUpdate((event) => {
      'worklet';
      console.log('Pinch onUpdate, event.scale:', event.scale, 'computed scale:', Math.max(1, Math.min(event.scale, 4)));
      scale.value = Math.max(1, Math.min(event.scale, 4));
    })
    .onEnd(() => {
      'worklet';
      console.log('Pinch onEnd, final scale:', scale.value);
      if (scale.value < 1) {
        console.log('Resetting scale to 1');
        scale.value = withSpring(1);
      }
    });

  // Pan gesture - only active when not pinching
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      console.log('Pan onStart, translateX, translateY:', translateX.value, translateY.value);
    })
    .onUpdate((event) => {
      'worklet';
      console.log('Pan onUpdate, event.translationX, translationY:', event.translationX, event.translationY);
      
      if (imageWidth.value > 0 && imageHeight.value > 0) {
        console.log('Pan applying limits with scale:', scale.value);
        const maxTranslateX = (imageWidth.value * (scale.value - 1)) / 2;
        const maxTranslateY = (imageHeight.value * (scale.value - 1)) / 2;

        translateX.value = Math.max(
          -maxTranslateX,
          Math.min(maxTranslateX, event.translationX)
        );
        translateY.value = Math.max(
          -maxTranslateY,
          Math.min(maxTranslateY, event.translationY)
        );
        console.log('Pan updated translateX, translateY:', translateX.value, translateY.value);
      }
    });

  // Tap gesture for single taps
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      'worklet';
      console.log('Tap onEnd, x, y:', event.x, event.y);
      console.log('Tap onEnd, imageWidth/Height values:', imageWidth.value, imageHeight.value);
      
      if (imageWidth.value > 0 && imageHeight.value > 0) {
        console.log('Tap handler calling addHoldAtScreenPosition');
        runOnJS(addHoldAtScreenPosition)(
          event.x, 
          event.y, 
          translateX.value, 
          translateY.value, 
          scale.value,
          imageWidth.value,
          imageHeight.value
        );
      } else {
        console.log('Tap handler abort - image dimensions not ready');
      }
    });

  // Compose all gestures
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const addHoldAtScreenPosition = (screenX, screenY, currentTranslateX, currentTranslateY, currentScale, imgWidth, imgHeight) => {
    console.log('=== SMART HOLD SELECTION START ===');
    console.log('Tap position:', {screenX, screenY});
    console.log('Transform:', {currentTranslateX, currentTranslateY, currentScale});
    console.log('Image size:', {imgWidth, imgHeight});
    console.log('Available holds:', availableHolds.length);
    
    if (!imgWidth || !imgHeight || imgWidth <= 0 || imgHeight <= 0) {
      console.log('ABORT: Invalid image dimensions');
      return;
    }
    
    if (!screenX || !screenY) {
      console.log('ABORT: Invalid screen coordinates');
      return;
    }

    // המרה לקואורדינטות יחסיות
    const imageX = screenX / currentScale - currentTranslateX / currentScale;
    const imageY = screenY / currentScale - currentTranslateY / currentScale;
    
    const relativeX = imageX / imgWidth;
    const relativeY = imageY / imgHeight;
    
    console.log('Computed tap position:', {imageX, imageY, relativeX, relativeY});
    
    // בדיקת גבולות
    if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) {
      console.log('Tap out of bounds - ignoring');
      return;
    }
    
    // חיפוש האחיזה הקרובה ביותר מהגריד האוטומטי
    const nearestHold = findNearestHold(relativeX, relativeY, availableHolds, 0.08); // רדיוס חיפוש של 8%
    
    if (nearestHold) {
      console.log('Found nearest hold:', nearestHold);
      console.log('Distance calculated by system');
      // שימוש במיקום המדויק של האחיזה מהגריד
      addHold(nearestHold.x, nearestHold.y, nearestHold);
    } else {
      console.log('No nearby hold found - ignoring tap');
      console.log('Consider tapping closer to visible holds');
    }
    
    console.log('=== SMART HOLD SELECTION END ===');
  };

  const addHold = (relativeX, relativeY, autoHold = null) => {
    console.log('=== SMART addHold START ===');
    console.log('Input:', {relativeX, relativeY, autoHold});
    console.log('Current holds count:', holds.length);
    
    const holdId = autoHold ? autoHold.id : `manual_hold_${Date.now()}`;
    console.log('Using holdId:', holdId);
    
    // חיפוש אחיזה קיימת (בין האחיזות שכבר נבחרו)
    let existingHold = null;
    for (let i = 0; i < holds.length; i++) {
      const hold = holds[i];
      const distance = Math.sqrt(
        Math.pow(hold.x - relativeX, 2) + Math.pow(hold.y - relativeY, 2)
      );
      if (distance < 0.05) { // רדיוס קטן יותר לאחיזות שכבר נבחרו
        existingHold = hold;
        break;
      }
    }
    
    console.log('Existing selected hold found:', existingHold);
    
    if (existingHold) {
      console.log('Processing existing hold - cycling type...');
      if (existingHold.type === 'hand') {
        console.log('Converting hand to foot');
        setHolds(prevHolds => 
          prevHolds.map(h => h.id === existingHold.id ? {...h, type: 'foot'} : h)
        );
      } else {
        console.log('Removing foot hold');
        setHolds(prevHolds => 
          prevHolds.filter(h => h.id !== existingHold.id)
        );
      }
    } else {
      console.log('Adding new hold from auto-detection...');
      const newHold = {
        id: holdId,
        x: relativeX,
        y: relativeY,
        type: 'hand',
        confidence: autoHold ? autoHold.confidence : 1.0,
        source: autoHold ? 'auto' : 'manual'
      };
      console.log('New hold object:', newHold);
      setHolds(prevHolds => [...prevHolds, newHold]);
    }
    
    console.log('=== SMART addHold END ===');
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

  const renderHold = (hold) => {
    const holdStyle = {
      position: 'absolute',
      left: hold.x * imageDimensions.width - 15,
      top: hold.y * imageDimensions.height - 15,
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 3,
      borderColor: hold.type === 'hand' ? '#ffffff' : '#2196F3',
      backgroundColor: hold.type === 'hand' ? 'rgba(255,255,255,0.3)' : 'rgba(33,150,243,0.3)',
      zIndex: 10,
    };

    return <View key={hold.id} style={holdStyle} />;
  };

  const handleNext = () => {
    if (holds.length < 2) {
      Alert.alert('שגיאה', 'יש לבחור לפחות 2 אחיזות');
      return;
    }

    navigation.navigate('SprayRouteBuilderScreen', {
      sprayWallId,
      sprayWallImage,
      holds,
      footRule,
      imageDimensions,
    });
  };

  const getFootRuleText = (rule) => {
    switch (rule) {
      case 'feet_follow_hands': return 'רגליים עוקבות אחרי ידיים';
      case 'open_feet': return 'רגליים פתוחות';
      case 'no_feet': return 'בלי רגליים';
      default: return rule;
    }
  };

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
        <Text style={styles.title}>בחר אחיזות</Text>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>הבא →</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          🤏 פינץ' לזום • 👆 לחיצה = יד (לבן) • 👆 שוב על אותה נקודה = רגל (כחול) • 👆 שוב = מחיקה
        </Text>
      </View>

      {/* Image Container */}
      <View style={styles.imageContainer}>
        {imageLoaded && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                <Image
                  source={{ uri: sprayWallImage }}
                  style={[styles.image, {
                    width: imageDimensions.width,
                    height: imageDimensions.height,
                  }]}
                  onLoad={onImageLoad}
                  onError={onImageError}
                  resizeMode="contain"
                />
                {holds.map(renderHold)}
              </Animated.View>
            </GestureDetector>
          </View>
        )}

        {!imageLoaded && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>טוען תמונה...</Text>
            <Image
              source={{ uri: sprayWallImage }}
              style={{ width: 0, height: 0 }}
              onLoad={onImageLoad}
              onError={onImageError}
            />
          </View>
        )}
      </View>

      {/* Foot Rules */}
      <View style={styles.footRules}>
        <Text style={styles.footRulesTitle}>חוקי רגליים:</Text>
        <View style={styles.footRuleButtons}>
          {['feet_follow_hands', 'open_feet', 'no_feet'].map((rule) => (
            <TouchableOpacity
              key={rule}
              style={[
                styles.footRuleButton,
                footRule === rule && styles.footRuleButtonActive
              ]}
              onPress={() => setFootRule(rule)}
            >
              <Text style={[
                styles.footRuleButtonText,
                footRule === rule && styles.footRuleButtonTextActive
              ]}>
                {rule === footRule ? '🔘' : '⚪'} {getFootRuleText(rule)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          נבחרו: {holds.filter(h => h.type === 'hand').length} ידיים, {holds.filter(h => h.type === 'foot').length} רגליים
        </Text>
      </View>
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
  nextButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.card,
  },
  instructionText: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#f0f0f0',
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
  footRules: {
    backgroundColor: theme.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  footRulesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  footRuleButtons: {
    gap: 8,
  },
  footRuleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  footRuleButtonActive: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  footRuleButtonText: {
    fontSize: 14,
    color: theme.text,
    textAlign: 'center',
  },
  footRuleButtonTextActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  stats: {
    backgroundColor: theme.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});
