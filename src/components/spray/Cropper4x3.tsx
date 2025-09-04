import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  Image as RNImage,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  clamp,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const Cropper4x3 = ({ imageUri, onCropComplete, style }) => {
  // Container dimensions (4:3 aspect ratio crop frame)
  const cropFrameWidth = screenWidth - 40; // 20px margin on each side
  const cropFrameHeight = (cropFrameWidth * 3) / 4; // 4:3 aspect ratio

  // Image state
  const [orig, setOrig] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [baseImageSize, setBaseImageSize] = useState({ width: 0, height: 0 });

  // Animated values for zoom and pan
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  // Gesture states
  const startScale = useSharedValue(1);
  const startOffsetX = useSharedValue(0);
  const startOffsetY = useSharedValue(0);

  const minScale = 1;
  const maxScale = 4;

  // Measure original image size internally
  useEffect(() => {
    if (!imageUri) return;
    console.log("[cropper] Starting size measurement for:", imageUri);
    setReady(false);
    setBaseImageSize({ width: 0, height: 0 });

    RNImage.getSize(
      imageUri,
      (w, h) => {
        console.log("[cropper] getSize success:", w, "x", h);
        if (w > 0 && h > 0) {
          setOrig({ width: w, height: h });
          setReady(true);
        } else {
          console.warn("[cropper] getSize returned invalid dimensions:", w, h);
          setOrig({ width: 1600, height: 1200 });
          setReady(true);
        }
      },
      (error) => {
        console.warn("[cropper] getSize failed:", error);
        // Fallback if measurement fails
        setOrig({ width: 1600, height: 1200 });
        setReady(true);
      },
    );
  }, [imageUri]);

  // Compute base image size (cover) once we know orig size
  useEffect(() => {
    if (!ready || !orig.width || !orig.height) return;
    console.log("[cropper] Computing base size for orig:", orig);
    const s = Math.max(
      cropFrameWidth / orig.width,
      cropFrameHeight / orig.height,
    );
    const newBase = { width: orig.width * s, height: orig.height * s };
    console.log("[cropper] Base size calculated:", newBase);
    setBaseImageSize(newBase);
    // Reset transformations
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    console.log("[cropper] Ready for interaction");
  }, [ready, orig, cropFrameWidth, cropFrameHeight]);

  // Calculate pan boundaries based on current scale
  const getPanBounds = (currentScale) => {
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    // Ensure image covers the frame: when scaled image is larger than frame, allow panning within the overflow
    const overflowX = Math.max(0, (scaledWidth - cropFrameWidth) / 2);
    const overflowY = Math.max(0, (scaledHeight - cropFrameHeight) / 2);
    return { maxX: overflowX, maxY: overflowY };
  };

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startOffsetX.value = offsetX.value;
      startOffsetY.value = offsetY.value;
    })
    .onChange((event) => {
      const { maxX, maxY } = getPanBounds(scale.value);

      offsetX.value = clamp(
        startOffsetX.value + event.translationX,
        -maxX,
        maxX,
      );
      offsetY.value = clamp(
        startOffsetY.value + event.translationY,
        -maxY,
        maxY,
      );
    });

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      startScale.value = scale.value;
      startOffsetX.value = offsetX.value;
      startOffsetY.value = offsetY.value;
    })
    .onChange((e) => {
      const newScale = clamp(startScale.value * e.scale, minScale, maxScale);
      // Focal compensation so zoom stays under fingers
      const frameCx = cropFrameWidth / 2;
      const frameCy = cropFrameHeight / 2;
      const dx = e.focalX - frameCx;
      const dy = e.focalY - frameCy;
      const k = newScale / scale.value - 1;
      const proposedX = startOffsetX.value - dx * k;
      const proposedY = startOffsetY.value - dy * k;

      const { maxX, maxY } = getPanBounds(newScale);
      scale.value = newScale;
      offsetX.value = clamp(proposedX, -maxX, maxX);
      offsetY.value = clamp(proposedY, -maxY, maxY);
    })
    .onEnd(() => {
      // Smooth spring animation when pinch ends
      scale.value = withSpring(scale.value);
      offsetX.value = withSpring(offsetX.value);
      offsetY.value = withSpring(offsetY.value);
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Animated style for the image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offsetX.value },
        { translateY: offsetY.value },
        { scale: scale.value },
      ] as any,
    };
  });

  // Handle crop operation
  const handleCrop = async () => {
    try {
      console.log("=== Starting crop operation ===");
      console.log("[crop] imageUri:", imageUri);
      console.log("[crop] orig:", orig);
      console.log("[crop] base:", baseImageSize);
      console.log("[crop] ready:", ready);
      console.log(
        "[crop] S, offset:",
        scale.value,
        offsetX.value,
        offsetY.value,
      );

      if (!imageUri) {
        console.error("[crop] No imageUri provided");
        Alert.alert("Error", "No image to crop");
        return;
      }

      if (!ready) {
        console.error("[crop] Image not ready");
        Alert.alert("Error", "Image still loading, please wait");
        return;
      }

      if (
        !orig.width ||
        !orig.height ||
        !baseImageSize.width ||
        !baseImageSize.height
      ) {
        console.error(
          "[crop] Invalid dimensions - orig:",
          orig,
          "base:",
          baseImageSize,
        );
        Alert.alert("Error", "Image dimensions invalid");
        return;
      }

      // Displayed size
      const baseW = baseImageSize.width;
      const baseH = baseImageSize.height;
      const S = scale.value;
      const dispW = baseW * S;
      const dispH = baseH * S;
      console.log("[crop] disp:", dispW, dispH);

      if (dispW <= 0 || dispH <= 0) {
        console.error("[crop] Invalid displayed dimensions:", dispW, dispH);
        Alert.alert("Error", "Invalid image display size");
        return;
      }

      const leftHidden = (dispW - cropFrameWidth) / 2 - offsetX.value;
      const topHidden = (dispH - cropFrameHeight) / 2 - offsetY.value;
      console.log("[crop] hidden margins:", leftHidden, topHidden);

      const pxPerScreenX = orig.width / dispW;
      const pxPerScreenY = orig.height / dispH;
      console.log("[crop] pixel ratios:", pxPerScreenX, pxPerScreenY);

      let originX = Math.round(leftHidden * pxPerScreenX);
      let originY = Math.round(topHidden * pxPerScreenY);
      let widthPx = Math.round(cropFrameWidth * pxPerScreenX);
      let heightPx = Math.round(cropFrameHeight * pxPerScreenY);

      console.log("[crop] before clamp:", {
        originX,
        originY,
        widthPx,
        heightPx,
      });

      originX = Math.max(0, Math.min(orig.width - 1, originX));
      originY = Math.max(0, Math.min(orig.height - 1, originY));
      widthPx = Math.max(1, Math.min(orig.width - originX, widthPx));
      heightPx = Math.max(1, Math.min(orig.height - originY, heightPx));

      console.log("[crop] after clamp:", {
        originX,
        originY,
        widthPx,
        heightPx,
      });

      if (widthPx <= 0 || heightPx <= 0) {
        console.error(
          "[crop] Invalid crop dimensions after clamp:",
          widthPx,
          heightPx,
        );
        Alert.alert("Error", "Invalid crop area calculated");
        return;
      }

      // Memory guard: downscale huge images before cropping
      const longSide = Math.max(orig.width, orig.height);
      let srcUri = imageUri;
      console.log("[crop] original long side:", longSide);

      if (longSide > 6000) {
        console.log("[crop] Image too large, downscaling first...");
        const k = 4000 / longSide; // cap long side to ~4K
        const newW = Math.round(orig.width * k);
        const newH = Math.round(orig.height * k);
        console.log("[crop] resizing to:", newW, "x", newH);

        const resized = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: newW, height: newH } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
        );

        console.log("[crop] resize successful:", resized.uri);
        srcUri = resized.uri;
        const r = newW / orig.width;
        originX = Math.round(originX * r);
        originY = Math.round(originY * r);
        widthPx = Math.round(widthPx * r);
        heightPx = Math.round(heightPx * r);
        console.log("[crop] adjusted crop for resize:", {
          originX,
          originY,
          widthPx,
          heightPx,
        });
      }

      console.log("[crop] Starting final crop with:", {
        uri: srcUri,
        crop: { originX, originY, width: widthPx, height: heightPx },
      });

      const result = await ImageManipulator.manipulateAsync(
        srcUri,
        [{ crop: { originX, originY, width: widthPx, height: heightPx } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      console.log("[crop] SUCCESS! Result:", result.uri);
      if (onCropComplete) {
        onCropComplete(result.uri, {
          originX,
          originY,
          width: widthPx,
          height: heightPx,
        });
      }
    } catch (error) {
      console.error("[crop] CRASH/ERROR:", error);
      console.error("[crop] Error name:", error.name);
      console.error("[crop] Error message:", error.message);
      console.error("[crop] Error stack:", error.stack);
      Alert.alert("Crop Error", `Failed to crop image: ${error.message}`);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Fixed 4:3 crop frame */}
      <View
        style={[
          styles.cropFrame,
          { width: cropFrameWidth, height: cropFrameHeight },
        ]}
      >
        {/* Image with gesture handling */}
        <GestureDetector gesture={composedGesture}>
          <View
            style={[
              styles.imageContainer,
              { width: cropFrameWidth, height: cropFrameHeight },
            ]}
          >
            {baseImageSize.width > 0 && (
              <Animated.View style={imageAnimatedStyle}>
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: baseImageSize.width,
                    height: baseImageSize.height,
                  }}
                  contentFit="cover"
                  contentPosition="center"
                />
              </Animated.View>
            )}
            {!ready && (
              <RNImage
                source={{ uri: imageUri }}
                style={styles.hiddenProbe}
                onLoad={(e) => {
                  console.log("[cropper] Hidden probe onLoad triggered");
                  const w = e?.nativeEvent?.source?.width;
                  const h = e?.nativeEvent?.source?.height;
                  console.log("[cropper] Probe measured:", w, h);
                  if (w && h && w > 0 && h > 0 && !ready) {
                    console.log("[cropper] Using probe measurements");
                    setOrig({ width: w, height: h });
                    setReady(true);
                  }
                }}
                onError={(e) => {
                  console.error(
                    "[cropper] Hidden probe load error:",
                    e.nativeEvent,
                  );
                }}
              />
            )}
          </View>
        </GestureDetector>

        {/* Crop frame overlay */}
        <View style={styles.cropOverlay}>
          <View style={styles.cropBorder} />
          <Text style={styles.cropText}>
            4:3 Crop Area{"\n"}Pinch to zoom • Drag to pan
          </Text>

          {/* Corner handles */}
          <View style={[styles.handle, styles.topLeft]} />
          <View style={[styles.handle, styles.topRight]} />
          <View style={[styles.handle, styles.bottomLeft]} />
          <View style={[styles.handle, styles.bottomRight]} />
        </View>
      </View>

      {/* Dark overlay outside crop frame */}
      <View style={styles.outerOverlay} pointerEvents="none" />

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.cropButton} onPress={handleCrop}>
          <Text style={styles.cropButtonText}>Crop Image</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  cropFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#000",
  },
  imageContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    // Size will be set dynamically based on baseImageSize
  },
  cropOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  cropBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: "#fff",
    borderStyle: "dashed",
  },
  cropText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  handle: {
    position: "absolute",
    width: 16,
    height: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  topLeft: {
    top: -8,
    left: -8,
  },
  topRight: {
    top: -8,
    right: -8,
  },
  bottomLeft: {
    bottom: -8,
    left: -8,
  },
  bottomRight: {
    bottom: -8,
    right: -8,
  },
  outerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: -1,
  },
  hiddenProbe: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
  },
  controls: {
    marginTop: 20,
    width: "100%",
    paddingHorizontal: 20,
  },
  cropButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cropButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Cropper4x3;
