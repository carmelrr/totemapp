import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSequence, 
  withTiming
} from 'react-native-reanimated';

export default function HoldMarker({
  x, 
  y, 
  type = 'intermediate', // 'start' | 'intermediate' | 'crimp' | 'top'
  selected = false,
  onPress,
  onLongPress,
  size = 30,
}) {
  const { theme } = useTheme();
  const animatedScale = useSharedValue(1);

  const colorMap = {
    start: '#4CAF50',
    intermediate: '#2196F3', 
    crimp: '#FFEB3B', // Changed to yellow
    top: '#F44336',
  };

  const styles = createStyles(theme);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatedScale.value }],
  }));

  const handlePress = () => {
    // Animate the hold when pressed
    animatedScale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withTiming(1.0, { duration: 100 }),
    );
    
    if (onPress) {
      onPress();
    }
  };

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
    }
  };

  const holdColor = colorMap[type] || colorMap.intermediate;
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        style={styles.touchable}
      >
        <View
          style={[
            styles.holdCircle,
            {
              borderColor: holdColor,
              backgroundColor: selected ? holdColor : 'transparent',
              borderRadius: size / 2,
            }
          ]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  touchable: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  holdCircle: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
});
