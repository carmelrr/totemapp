import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ZoomableImage = ({ 
  source, 
  style, 
  onImagePress,
  children,
  showDimming = false 
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });

  const pinchGestureHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      scale.value = Math.max(0.5, Math.min(3, event.scale));
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  const panGestureHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onEnd: () => {
      // Reset position if scale is 1
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const handleImagePress = (event) => {
    if (onImagePress && scale.value <= 1.1) {
      const { locationX, locationY } = event.nativeEvent;
      onImagePress(locationX, locationY, imageLayout.width, imageLayout.height);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <PanGestureHandler onGestureEvent={panGestureHandler}>
        <Animated.View style={styles.gestureContainer}>
          <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
            <Animated.View style={animatedStyle}>
              <Image
                source={source}
                style={styles.image}
                contentFit="cover"
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setImageLayout({ width, height });
                }}
                onTouchEnd={handleImagePress}
              />
              
              {/* Dimming overlay */}
              {showDimming && (
                <View style={styles.dimmingOverlay} />
              )}
              
              {/* Children (holds, etc.) */}
              {children}
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  gestureContainer: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dimmingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});

export default ZoomableImage;
