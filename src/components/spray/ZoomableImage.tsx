import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Image } from "expo-image";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const ZoomableImage = ({
  source,
  style,
  onImagePress,
  onImageLayout, // New prop to pass layout back to parent
  children,
  showDimming = false,
  allowPanning = true, // New prop to control panning behavior
  globalEditingActive = false, // New prop to control children container pointer events
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Reset transformations when switching to hold placement mode
  useEffect(() => {
    if (!allowPanning) {
      scale.value = withTiming(1, { duration: 120 });
      translateX.value = withTiming(0, { duration: 120 });
      translateY.value = withTiming(0, { duration: 120 });
    }
  }, [allowPanning]);

  const pinchGestureHandler = useAnimatedGestureHandler(
    {
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
    },
    [],
    false,
  ); // Disable native driver

  const panGestureHandler = useAnimatedGestureHandler(
    {
      onStart: () => {
        runOnJS(setIsPanning)(true);
      },
      onActive: (event) => {
        if (allowPanning) {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
        }
      },
      onEnd: () => {
        runOnJS(setIsPanning)(false);
        // Reset position if scale is 1
        if (scale.value <= 1) {
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
        }
      },
    },
    [],
    false,
  ); // Disable native driver

  const animatedStyle = useAnimatedStyle(
    () => {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: scale.value },
        ],
      };
    },
    [],
    false,
  ); // Disable native driver

  const handleImagePress = (event) => {
    console.log(
      "Image pressed, isPanning:",
      isPanning,
      "allowPanning:",
      allowPanning,
    );

    // Only trigger onImagePress if we're not panning and panning is disabled (hold type selected)
    if (onImagePress && !isPanning && !allowPanning) {
      const { locationX, locationY } = event.nativeEvent;
      console.log(
        "Image press coordinates:",
        locationX,
        locationY,
        "Image layout:",
        imageLayout,
      );
      onImagePress(locationX, locationY, imageLayout.width, imageLayout.height);
    }
  };

  const handleTapGesture = ({ nativeEvent }) => {
    if (nativeEvent.state === State.END && onImagePress) {
      // נקודות יחסיות למשטח התמונה (100% מהמסגרת)
      const { x, y } = nativeEvent;
      console.log(
        "Tap gesture coordinates:",
        x,
        y,
        "Image layout:",
        imageLayout,
      );
      onImagePress(x, y, imageLayout.width, imageLayout.height);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {allowPanning ? (
        // Pan/Zoom mode - use gesture handlers
        <PanGestureHandler
          enabled={allowPanning}
          onGestureEvent={panGestureHandler}
        >
          <Animated.View style={styles.gestureContainer}>
            <PinchGestureHandler
              enabled={allowPanning}
              onGestureEvent={pinchGestureHandler}
            >
              <Animated.View style={animatedStyle}>
                <Image
                  source={source}
                  style={styles.image}
                  contentFit="contain"
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    console.log("Image layout updated:", { width, height });
                    setImageLayout({ width, height });
                    if (onImageLayout) {
                      onImageLayout({ width, height });
                    }
                  }}
                />

                {/* Dimming overlay */}
                {showDimming && (
                  <View pointerEvents="none" style={styles.dimmingOverlay} />
                )}
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
      ) : (
        // Hold placement mode - use tap handler only
        <TapGestureHandler
          enabled={!allowPanning}
          maxDelayMs={250}
          maxDeltaX={10}
          maxDeltaY={10}
          onHandlerStateChange={handleTapGesture}
        >
          <Animated.View style={styles.gestureContainer}>
            <Animated.View style={animatedStyle}>
              <Image
                source={source}
                style={styles.image}
                contentFit="contain"
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  console.log("Image layout updated:", { width, height });
                  setImageLayout({ width, height });
                  if (onImageLayout) {
                    onImageLayout({ width, height });
                  }
                }}
              />

              {/* Dimming overlay */}
              {showDimming && (
                <View pointerEvents="none" style={styles.dimmingOverlay} />
              )}
            </Animated.View>
          </Animated.View>
        </TapGestureHandler>
      )}

      {/* Children (holds, etc.) - outside of transforms */}
      <View
        style={[
          styles.overlayContainer,
          { pointerEvents: globalEditingActive ? "auto" : "box-none" },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#000",
  },
  gestureContainer: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  dimmingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    // pointerEvents is now controlled dynamically via prop
  },
});

export default ZoomableImage;
