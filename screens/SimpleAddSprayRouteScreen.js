import React, { useState, useEffect } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import { sprayWallService } from '../services/sprayWallService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function SimpleAddSprayRouteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { sprayWallId, sprayWallImage } = route.params;

  const [selectedHolds, setSelectedHolds] = useState([]);
  const [presetHolds, setPresetHolds] = useState([]);
  const [footRule, setFootRule] = useState('feet_follow_hands');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  const styles = createStyles(theme);

  useEffect(() => {
    loadPresetHolds();
  }, [sprayWallId]);

  const loadPresetHolds = async () => {
    try {
      console.log('Loading preset holds for wall:', sprayWallId);
      
      // TODO: Load from Firestore
      // const wallData = await sprayWallService.getSprayWall(sprayWallId);
      // setPresetHolds(wallData.presetHolds || []);
      
      // For now, mock some preset holds
      const mockPresetHolds = [
        { id: '1', x: 0.2, y: 0.3, number: 1 },
        { id: '2', x: 0.4, y: 0.25, number: 2 },
        { id: '3', x: 0.6, y: 0.4, number: 3 },
        { id: '4', x: 0.8, y: 0.35, number: 4 },
        { id: '5', x: 0.3, y: 0.6, number: 5 },
        { id: '6', x: 0.7, y: 0.65, number: 6 },
        { id: '7', x: 0.5, y: 0.8, number: 7 },
        { id: '8', x: 0.1, y: 0.7, number: 8 },
        { id: '9', x: 0.9, y: 0.6, number: 9 },
        { id: '10', x: 0.5, y: 0.5, number: 10 },
      ];
      
      setPresetHolds(mockPresetHolds);
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading preset holds:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את אחיזות הקיר');
      setLoading(false);
    }
  };

  const onImageLoad = (event) => {
    const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
    
    // Calculate display dimensions maintaining aspect ratio
    const aspectRatio = imgWidth / imgHeight;
    let displayWidth = screenWidth;
    let displayHeight = screenWidth / aspectRatio;
    
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

  const toggleHold = (hold) => {
    console.log('Toggling hold:', hold.number);
    
    const existingIndex = selectedHolds.findIndex(h => h.id === hold.id);
    
    if (existingIndex >= 0) {
      // Hold is selected - cycle through types or remove
      const currentHold = selectedHolds[existingIndex];
      
      if (currentHold.type === 'hand') {
        // Convert to foot
        const updatedHolds = [...selectedHolds];
        updatedHolds[existingIndex] = { ...currentHold, type: 'foot' };
        setSelectedHolds(updatedHolds);
        console.log(`Hold ${hold.number} converted to foot`);
      } else {
        // Remove hold
        const updatedHolds = selectedHolds.filter(h => h.id !== hold.id);
        setSelectedHolds(updatedHolds);
        console.log(`Hold ${hold.number} removed`);
      }
    } else {
      // Add as hand hold
      const newHold = {
        ...hold,
        type: 'hand',
        selectedAt: Date.now(),
      };
      setSelectedHolds(prev => [...prev, newHold]);
      console.log(`Hold ${hold.number} added as hand`);
    }
  };

  const getHoldStyle = (hold) => {
    const selectedHold = selectedHolds.find(h => h.id === hold.id);
    const isSelected = !!selectedHold;
    
    return {
      position: 'absolute',
      left: hold.x * imageDimensions.width - 20,
      top: hold.y * imageDimensions.height - 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: isSelected 
        ? (selectedHold.type === 'hand' ? '#ffffff' : '#2196F3')
        : '#4CAF50',
      backgroundColor: isSelected
        ? (selectedHold.type === 'hand' ? 'rgba(255,255,255,0.7)' : 'rgba(33,150,243,0.7)')
        : 'rgba(76,175,80,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
      opacity: isSelected ? 1 : 0.6,
    };
  };

  const renderHold = (hold) => (
    <TouchableOpacity 
      key={hold.id}
      style={getHoldStyle(hold)}
      onPress={() => toggleHold(hold)}
      activeOpacity={0.7}
    >
      <Text style={styles.holdNumber}>{hold.number}</Text>
    </TouchableOpacity>
  );

  const handleNext = () => {
    if (selectedHolds.length < 2) {
      Alert.alert('שגיאה', 'יש לבחור לפחות 2 אחיזות');
      return;
    }

    console.log('Selected holds for route:', selectedHolds);

    navigation.navigate('SprayRouteBuilderScreen', {
      sprayWallId,
      sprayWallImage,
      holds: selectedHolds,
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>טוען אחיזות הקיר...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          🎯 לחץ על מספר = יד (לבן) • 👆 שוב = רגל (כחול) • 👆 שוב = מחיקה
        </Text>
      </View>

      {/* Image Container */}
      <View style={styles.imageContainer}>
        {imageLoaded && (
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: sprayWallImage }}
              style={[styles.image, {
                width: imageDimensions.width,
                height: imageDimensions.height,
              }]}
              onLoad={onImageLoad}
              resizeMode="contain"
            />
            {presetHolds.map(renderHold)}
          </View>
        )}

        {!imageLoaded && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>טוען תמונה...</Text>
            <Image
              source={{ uri: sprayWallImage }}
              style={{ width: 0, height: 0 }}
              onLoad={onImageLoad}
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
          נבחרו: {selectedHolds.filter(h => h.type === 'hand').length} ידיים, {selectedHolds.filter(h => h.type === 'foot').length} רגליים
        </Text>
        <Text style={styles.statsSubText}>
          זמינות: {presetHolds.length} אחיזות במערכת
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
  holdNumber: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  statsSubText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
});
