import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  Image as RNImage,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  clamp,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

const { width: screenWidth } = Dimensions.get("window");

const RobustCropper4x3 = ({
  imageUri,
  onCropComplete,
  style,
  enableDebug = true,
  onDebugLog,
}) => {
  // Session + logging helper
  const sessionIdRef = useRef(Math.random().toString(36).slice(2, 8));
  const mountedRef = useRef(true);
  const log = useCallback(
    (...args) => {
      if (!enableDebug) return;
      const prefix = `[RobustCropper][${sessionIdRef.current}]`;
      // Console log
      console.log(prefix, ...args);
      // Optional external collector
      if (onDebugLog) {
        try {
          onDebugLog(
            [prefix, ...args]
              .map((a) =>
                typeof a === "object" ? JSON.stringify(a) : String(a),
              )
              .join(" "),
          );
        } catch (e) {
          /* ignore */
        }
      }
    },
    [enableDebug, onDebugLog],
  );

  const warn = useCallback(
    (...args) => {
      if (enableDebug)
        console.warn(`[RobustCropper][${sessionIdRef.current}]`, ...args);
    },
    [enableDebug],
  );
  const err = useCallback(
    (...args) => {
      if (enableDebug)
        console.error(`[RobustCropper][${sessionIdRef.current}]`, ...args);
    },
    [enableDebug],
  );

  // Input validation
  if (!imageUri) {
    warn("No imageUri provided");
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>No image provided</Text>
      </View>
    );
  }

  if (typeof imageUri !== "string") {
    warn("Invalid imageUri type:", typeof imageUri);
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Invalid image URI</Text>
      </View>
    );
  }

  // Fixed 4:3 crop frame dimensions
  const frameWidth = screenWidth - 40; // 20px margin each side
  const frameHeight = (frameWidth * 3) / 4; // 4:3 aspect ratio

  // Image state
  const [imageLoaded, setImageLoaded] = useState(false);
  const [originalDimensions, setOriginalDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [localImageUri, setLocalImageUri] = useState(null);
  const [tempFiles, setTempFiles] = useState([]); // Track temp files for cleanup
  const [minScale, setMinScale] = useState(1);
  const [currentScaleValue, setCurrentScaleValue] = useState(1); // Track scale for logging without reading .value

  // Gesture shared values
  const scale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);

  // Gesture start values
  const startScale = useSharedValue(1);
  const startTranslationX = useSharedValue(0);
  const startTranslationY = useSharedValue(0);

  const maxScale = 4;

  // Thresholds for proactive downscaling
  const LARGE_DIMENSION = 5000; // Any side above this triggers downscale
  const LARGE_PIXEL_COUNT = 40_000_000; // ~40MP
  const TARGET_MAX_DIMENSION = 4000; // Desired max side after downscale
  const TARGET_MAX_PIXELS = 24_000_000; // ~24MP safe target

  // Multi-step downscale to reduce peak memory (avoid one huge decode + resize)
  const progressiveDownscale = useCallback(
    async (srcUri, startW, startH) => {
      let w = startW;
      let h = startH;
      let uri = srcUri;
      const steps = [];

      const addTemp = (u) => setTempFiles((prev) => [...prev, u]);

      // Helper to run one resize step
      const runStep = async (nextW, nextH, note) => {
        log("Downscale step ->", nextW, "x", nextH, note || "");
        const r = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: nextW, height: nextH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        if (r.uri !== uri) addTemp(r.uri);
        uri = r.uri;
        w = r.width || nextW;
        h = r.height || nextH;
        steps.push({ w, h });
      };

      // While far above target, shrink by ~60% each iteration
      while (
        Math.max(w, h) > TARGET_MAX_DIMENSION * 1.6 ||
        w * h > TARGET_MAX_PIXELS * 1.6
      ) {
        const factor = 0.6;
        const nextW = Math.round(w * factor);
        const nextH = Math.round(h * factor);
        await runStep(nextW, nextH, "progressive");
      }

      // Final precise resize if still above target constraints
      const maxSide = Math.max(w, h);
      const pixelCount = w * h;
      if (maxSide > TARGET_MAX_DIMENSION || pixelCount > TARGET_MAX_PIXELS) {
        const scaleFactor = Math.min(
          TARGET_MAX_DIMENSION / maxSide,
          Math.sqrt(TARGET_MAX_PIXELS / pixelCount),
        );
        const finalW = Math.round(w * scaleFactor);
        const finalH = Math.round(h * scaleFactor);
        await runStep(finalW, finalH, "final");
      }

      log("Downscale complete. Steps:", steps);
      return { uri, width: w, height: h };
    },
    [log, setTempFiles],
  );

  // Helper: compute and apply initial transform so image fully covers frame
  const calculateInitialTransform = useCallback(
    (dims) => {
      if (!dims?.width || !dims?.height) return;
      const scaleToFitWidth = frameWidth / dims.width;
      const scaleToFitHeight = frameHeight / dims.height;
      const neededScale = Math.max(scaleToFitWidth, scaleToFitHeight);
      // Guard against NaN / Infinity
      const safeScale =
        !Number.isFinite(neededScale) || neededScale <= 0 ? 1 : neededScale;
      scale.value = safeScale;
      translationX.value = 0;
      translationY.value = 0;
      setCurrentScaleValue(safeScale); // Update tracked value
    },
    [frameWidth, frameHeight, scale, translationX, translationY],
  );

  // Download remote image if needed and measure dimensions
  useEffect(() => {
    let isMounted = true;

    const setupImage = async () => {
      const tStart = Date.now();
      try {
        log("--- Setup start ---");
        log("Image URI:", imageUri);
        setImageLoaded(false);

        let localUri = imageUri;

        // Download remote images to local storage
        if (imageUri.startsWith("http")) {
          log("Remote image detected. Downloading...");
          const filename = imageUri.split("/").pop() || "image.jpg";
          const downloadPath = `${FileSystem.documentDirectory}temp_crop_${Date.now()}_${filename}`;

          const downloadResult = await FileSystem.downloadAsync(
            imageUri,
            downloadPath,
          );
          localUri = downloadResult.uri;
          setTempFiles((prev) => [...prev, localUri]); // Track for cleanup
          log(
            "Download complete ->",
            localUri,
            "size(bytes)=",
            downloadResult?.headers?.["Content-Length"],
          );
        }

        if (!isMounted) return;
        setLocalImageUri(localUri);

        // Check file size first to prevent memory issues
        log("Checking file info...");
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        log("File size bytes:", (fileInfo as any).size, "exists:", fileInfo.exists);
        if (!fileInfo.exists)
          throw new Error("File does not exist after download");

        // If file is very large (>50MB), resize it first
        let processedUri = localUri;
        if (fileInfo.size > 50 * 1024 * 1024) {
          // 50MB
          log("Large file >50MB. Pre-resizing to reduce memory footprint...");
          try {
            const resizeResult = await ImageManipulator.manipulateAsync(
              localUri,
              [{ resize: { width: 2048 } }], // Resize to max width 2048px
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
            );
            processedUri = resizeResult.uri;
            setTempFiles((prev) => [...prev, processedUri]); // Track for cleanup
            log(
              "Pre-resize success. New URI:",
              processedUri,
              "newWidth:",
              resizeResult.width,
              "newHeight:",
              resizeResult.height,
            );
          } catch (resizeError) {
            err("Pre-resize failed:", resizeError);
            // Continue with original if resize fails
          }
        }

        // Get image dimensions using a direct and safe approach
        log("Getting image dimensions (safe method)...");

        const getImageDimensionsSafe = async () => {
          // Method 1: Try with no manipulations to get original dimensions
          try {
            log(
              "Attempting ImageManipulator.manipulateAsync([]) to read dimensions",
            );
            const result = await ImageManipulator.manipulateAsync(
              processedUri,
              [], // No operations - just get info
              { format: ImageManipulator.SaveFormat.JPEG },
            );
            log(
              "Manipulator dimension result:",
              result.width,
              "x",
              result.height,
              "tempResultUri:",
              result.uri !== processedUri ? result.uri : "same-as-source",
            );

            // Clean up the duplicate file created
            try {
              if (result.uri !== processedUri) {
                await FileSystem.deleteAsync(result.uri);
              }
            } catch (cleanupError) {
              warn("Temp duplicate cleanup warning:", cleanupError);
            }

            return { width: result.width, height: result.height };
          } catch (manipulatorError) {
            warn(
              "ImageManipulator dimension attempt failed:",
              manipulatorError.message,
            );

            // Method 2: Use default dimensions if all else fails
            warn("Falling back to default dimensions.");

            // Return reasonable default dimensions for a 4:3 crop
            // This will allow the component to work even if we can't get exact dimensions
            const defaultWidth = frameWidth * 2; // Assume 2x frame size
            const defaultHeight = frameHeight * 2;

            warn(
              "Fallback dimensions selected:",
              defaultWidth,
              "x",
              defaultHeight,
            );
            return { width: defaultWidth, height: defaultHeight };
          }
        };

        try {
          const dimensions = await getImageDimensionsSafe();
          log(
            "Final chosen dimensions (original):",
            dimensions.width,
            "x",
            dimensions.height,
          );
          if (!isMounted) return;

          // Evaluate memory risk
          const pixelCountOrig = dimensions.width * dimensions.height;
          const estimatedDecompressedMB = (pixelCountOrig * 4) / (1024 * 1024);
          log(
            "Estimated decompressed RGBA size (MB):",
            estimatedDecompressedMB.toFixed(2),
          );

          let workingDims = { ...dimensions };
          let workingUri = processedUri;
          let downscaled = false;

          const needsDownscale =
            workingDims.width > LARGE_DIMENSION ||
            workingDims.height > LARGE_DIMENSION ||
            workingDims.width * workingDims.height > LARGE_PIXEL_COUNT ||
            estimatedDecompressedMB > 250;

          if (needsDownscale) {
            warn("Large image detected. Performing progressive downscale...");
            try {
              const ds = await progressiveDownscale(
                workingUri,
                workingDims.width,
                workingDims.height,
              );
              workingUri = ds.uri;
              workingDims = { width: ds.width, height: ds.height };
              downscaled = true;
              const newPixels = ds.width * ds.height;
              log(
                "Downscaled result:",
                ds.width,
                "x",
                ds.height,
                "pixels:",
                newPixels,
                "estMB:",
                ((newPixels * 4) / (1024 * 1024)).toFixed(2),
              );
            } catch (dErr) {
              err(
                "Progressive downscale failed. Continuing with original (risk of crash):",
                dErr,
              );
            }
          }

          if (workingDims.width > 0 && workingDims.height > 0) {
            setOriginalDimensions(workingDims);
            setLocalImageUri(workingUri);

            // Calculate minimum scale to cover the 4:3 frame with new (maybe downscaled) dims
            const scaleToFitWidth = frameWidth / workingDims.width;
            const scaleToFitHeight = frameHeight / workingDims.height;
            const calculatedMinScale = Math.max(
              scaleToFitWidth,
              scaleToFitHeight,
            );
            log("Min scale calculated:", calculatedMinScale);
            setMinScale(calculatedMinScale);

            scale.value = calculatedMinScale;
            translationX.value = 0;
            translationY.value = 0;
            setCurrentScaleValue(calculatedMinScale); // Track for safe logging
            setImageLoaded(true);

            if (downscaled) {
              const newPixelCount = workingDims.width * workingDims.height;
              const newEstMB = (newPixelCount * 4) / (1024 * 1024);
              log(
                "Post-downscale decompressed MB estimate:",
                newEstMB.toFixed(2),
              );
            }
          } else {
            throw new Error("Invalid image dimensions (zero or negative)");
          }
        } catch (error) {
          if (!isMounted) return;
          err("Failed to get image size:", error);
          Alert.alert(
            "Error",
            `Failed to load image dimensions: ${error.message}`,
          );
        }
      } catch (error) {
        if (!isMounted) return;
        err("Setup error:", error);
        Alert.alert("Error", `Failed to prepare image: ${error.message}`);
      } finally {
        log("--- Setup end (ms):", Date.now() - tStart, "---");
      }
    };

    if (imageUri) {
      setupImage();
    }

    return () => {
      isMounted = false;
      // Cleanup temp files
      tempFiles.forEach(async (tempUri) => {
        try {
          const fileInfo = await FileSystem.getInfoAsync(tempUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(tempUri);
            log("Cleaned temp file (effect cleanup):", tempUri);
          }
        } catch (error) {
          warn("Failed to cleanup temp file (effect cleanup):", tempUri, error);
        }
      });
    };
  }, [imageUri, frameWidth, frameHeight]);

  // Cleanup effect for temp files
  useEffect(() => {
    return () => {
      // Cleanup temp files on unmount
      tempFiles.forEach(async (tempUri) => {
        try {
          const fileInfo = await FileSystem.getInfoAsync(tempUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(tempUri);
            log("Cleaned temp file on unmount:", tempUri);
          }
        } catch (error) {
          warn("Failed to cleanup temp file on unmount:", tempUri, error);
        }
      });
    };
  }, [tempFiles]);

  // Calculate pan bounds to keep image covering the frame (improved)
  const getPanBounds = useCallback(
    (currentScale) => {
      if (!originalDimensions.width || !originalDimensions.height) {
        return { maxX: 0, maxY: 0, minX: 0, minY: 0 };
      }

      const scaledWidth = originalDimensions.width * currentScale;
      const scaledHeight = originalDimensions.height * currentScale;

      // Calculate maximum translation to keep image covering the frame
      const maxX = Math.max(0, (scaledWidth - frameWidth) / 2);
      const maxY = Math.max(0, (scaledHeight - frameHeight) / 2);

      return {
        maxX,
        maxY,
        minX: -maxX,
        minY: -maxY,
      };
    },
    [originalDimensions, frameWidth, frameHeight],
  );

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      log("Pan gesture started");
      startTranslationX.value = translationX.value;
      startTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      try {
        const { maxX, maxY, minX, minY } = getPanBounds(scale.value);

        if (
          !Number.isFinite(maxX) ||
          !Number.isFinite(maxY) ||
          !Number.isFinite(minX) ||
          !Number.isFinite(minY)
        ) {
          runOnJS(warn)("Invalid pan bounds:", { maxX, maxY, minX, minY });
          return;
        }

        const newTransX = clamp(
          startTranslationX.value + event.translationX,
          minX,
          maxX,
        );
        const newTransY = clamp(
          startTranslationY.value + event.translationY,
          minY,
          maxY,
        );

        if (Number.isFinite(newTransX) && Number.isFinite(newTransY)) {
          translationX.value = newTransX;
          translationY.value = newTransY;
        }
      } catch (error) {
        runOnJS(err)("Pan gesture error:", error);
      }
    })
    .onEnd(() => {
      log("Pan gesture ended");
    });

  // Pinch gesture with focal point compensation
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      log("Pinch gesture started");
      startScale.value = scale.value;
      startTranslationX.value = translationX.value;
      startTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      try {
        // Some Android devices occasionally report scale=0 or undefined very early
        const rawScale =
          event && Number.isFinite(event.scale) && event.scale > 0
            ? event.scale
            : 1;
        const newScale = clamp(startScale.value * rawScale, minScale, maxScale);

        if (!Number.isFinite(newScale) || newScale <= 0) {
          runOnJS(warn)("Invalid scale in pinch:", newScale);
          return;
        }

        // Focal point compensation to keep zoom centered under fingers
        const frameCenterX = frameWidth / 2;
        const frameCenterY = frameHeight / 2;
        // Guard against undefined focal values (can be NaN on first frame)
        const safeFocalX =
          event && Number.isFinite(event.focalX) ? event.focalX : frameCenterX;
        const safeFocalY =
          event && Number.isFinite(event.focalY) ? event.focalY : frameCenterY;
        const focalOffsetX = safeFocalX - frameCenterX;
        const focalOffsetY = safeFocalY - frameCenterY;

        const scaleFactor = newScale / scale.value - 1;
        const adjustedTranslationX =
          startTranslationX.value - focalOffsetX * scaleFactor;
        const adjustedTranslationY =
          startTranslationY.value - focalOffsetY * scaleFactor;

        const { maxX, maxY, minX, minY } = getPanBounds(newScale);

        if (
          Number.isFinite(maxX) &&
          Number.isFinite(maxY) &&
          Number.isFinite(minX) &&
          Number.isFinite(minY)
        ) {
          scale.value = newScale;
          translationX.value = clamp(adjustedTranslationX, minX, maxX);
          translationY.value = clamp(adjustedTranslationY, minY, maxY);
          runOnJS(setCurrentScaleValue)(newScale); // Update tracked value
        }
      } catch (error) {
        runOnJS(err)("Pinch gesture error:", error);
      }
    })
    .onEnd(() => {
      log("Pinch gesture ended");
      // Smooth spring animation when gesture ends
      scale.value = withSpring(scale.value);
      translationX.value = withSpring(translationX.value);
      translationY.value = withSpring(translationY.value);
    });

  // Combine gestures to work simultaneously
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Animated style for the image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    if (!imageLoaded) {
      return { opacity: 0 };
    }

    try {
      const currentScale = scale.value;
      const currentTransX = translationX.value;
      const currentTransY = translationY.value;

      // Guard against invalid values that could cause render issues
      if (!Number.isFinite(currentScale) || currentScale <= 0) {
        return { opacity: 0 };
      }

      if (!Number.isFinite(currentTransX) || !Number.isFinite(currentTransY)) {
        return { opacity: 0 };
      }

      return {
        opacity: 1,
        transform: [
          { scale: currentScale },
          { translateX: currentTransX },
          { translateY: currentTransY },
        ] as any,
      };
    } catch (error) {
      return { opacity: 0 };
    }
  }, [imageLoaded, log, err]);

  // Handle crop operation
  const handleCrop = async () => {
    try {
      log("--- Crop start ---");

      if (
        !imageLoaded ||
        !localImageUri ||
        !originalDimensions.width ||
        !originalDimensions.height
      ) {
        Alert.alert(
          "Error",
          "Image not ready for cropping. Please wait for the image to load completely.",
        );
        return;
      }

      // Validate transformation values
      const currentScale = scale.value;
      const currentTranslationX = translationX.value;
      const currentTranslationY = translationY.value;

      if (!Number.isFinite(currentScale) || currentScale <= 0) {
        Alert.alert(
          "Error",
          "Invalid zoom level detected. Please reset and try again.",
        );
        return;
      }

      if (
        !Number.isFinite(currentTranslationX) ||
        !Number.isFinite(currentTranslationY)
      ) {
        Alert.alert(
          "Error",
          "Invalid position detected. Please reset and try again.",
        );
        return;
      }

      log("Current transform:", {
        scale: currentScale,
        translationX: currentTranslationX,
        translationY: currentTranslationY,
      });

      // Calculate the visible area in original image coordinates
      const scaledImageWidth = originalDimensions.width * currentScale;
      const scaledImageHeight = originalDimensions.height * currentScale;

      // Calculate the top-left corner of the crop area in the scaled image
      const visibleLeft =
        (scaledImageWidth - frameWidth) / 2 - currentTranslationX;
      const visibleTop =
        (scaledImageHeight - frameHeight) / 2 - currentTranslationY;

      // Convert to original image pixel coordinates
      const pixelRatioX = originalDimensions.width / scaledImageWidth;
      const pixelRatioY = originalDimensions.height / scaledImageHeight;

      let cropOriginX = Math.round(visibleLeft * pixelRatioX);
      let cropOriginY = Math.round(visibleTop * pixelRatioY);
      let cropWidth = Math.round(frameWidth * pixelRatioX);
      let cropHeight = Math.round(frameHeight * pixelRatioY);

      // Clamp to image bounds to prevent out-of-bounds errors
      cropOriginX = Math.max(
        0,
        Math.min(originalDimensions.width - 1, cropOriginX),
      );
      cropOriginY = Math.max(
        0,
        Math.min(originalDimensions.height - 1, cropOriginY),
      );
      cropWidth = Math.max(
        1,
        Math.min(originalDimensions.width - cropOriginX, cropWidth),
      );
      cropHeight = Math.max(
        1,
        Math.min(originalDimensions.height - cropOriginY, cropHeight),
      );

      log("Crop parameters:", {
        originX: cropOriginX,
        originY: cropOriginY,
        width: cropWidth,
        height: cropHeight,
        originalSize: originalDimensions,
      });

      // Validate crop parameters
      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error("Invalid crop dimensions calculated");
      }

      // Memory management: Check file size and resize if needed
      let sourceUri = localImageUri;
      let resizeRatio = 1;

      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(localImageUri);
      const fileSizeMB = (fileInfo as any).size / (1024 * 1024);
      log("Source file size (MB):", fileSizeMB.toFixed(2));

      // Resize large images or those with large dimensions
      const maxDimension = Math.max(
        originalDimensions.width,
        originalDimensions.height,
      );
      const shouldResize = maxDimension > 4000 || fileSizeMB > 20;

      if (shouldResize) {
        log("Resizing large image before crop...");
        let targetMaxDimension = 3000;

        // More aggressive resize for very large files
        if (fileSizeMB > 50) {
          targetMaxDimension = 2000;
        }

        resizeRatio = targetMaxDimension / maxDimension;

        const resizeWidth = Math.round(originalDimensions.width * resizeRatio);
        const resizeHeight = Math.round(
          originalDimensions.height * resizeRatio,
        );

        log("Resize target size:", resizeWidth, "x", resizeHeight);

        const resizeResult = await ImageManipulator.manipulateAsync(
          localImageUri,
          [{ resize: { width: resizeWidth, height: resizeHeight } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );

        sourceUri = resizeResult.uri;
        setTempFiles((prev) => [...prev, sourceUri]); // Track for cleanup

        // Adjust crop parameters for resized image
        cropOriginX = Math.round(cropOriginX * resizeRatio);
        cropOriginY = Math.round(cropOriginY * resizeRatio);
        cropWidth = Math.round(cropWidth * resizeRatio);
        cropHeight = Math.round(cropHeight * resizeRatio);

        log("Adjusted crop for resized source:", {
          originX: cropOriginX,
          originY: cropOriginY,
          width: cropWidth,
          height: cropHeight,
          resizeRatio,
        });
      }

      // Perform the crop with optimized settings
      const cropResult = await ImageManipulator.manipulateAsync(
        sourceUri,
        [
          {
            crop: {
              originX: cropOriginX,
              originY: cropOriginY,
              width: cropWidth,
              height: cropHeight,
            },
          },
        ],
        {
          compress: 0.8, // Higher compression to reduce memory usage
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      log(
        "Crop success. Result URI:",
        cropResult.uri,
        "dimensions:",
        cropWidth,
        "x",
        cropHeight,
      );

      // Check final file size
      const finalInfo = await FileSystem.getInfoAsync(cropResult.uri);
      const finalSizeMB = (finalInfo as any).size / (1024 * 1024);
      log("Final cropped file size (MB):", finalSizeMB.toFixed(2));

      if (onCropComplete) {
        onCropComplete(cropResult.uri, {
          originX: cropOriginX,
          originY: cropOriginY,
          width: cropWidth,
          height: cropHeight,
        });
      }
    } catch (error) {
      err("Crop error:", error);
      Alert.alert("Crop Error", `Failed to crop image: ${error.message}`);
    } finally {
      log("--- Crop end ---");
    }
  };

  // Reset the image to initial position and zoom
  const handleReset = () => {
    if (originalDimensions.width && originalDimensions.height) {
      log("Reset pressed: restoring initial transform");
      calculateInitialTransform(originalDimensions);
      setCurrentScaleValue(minScale); // Update tracked value
    }
  };
  if (!imageLoaded || !localImageUri) {
    log(
      "Render: Loading state - imageLoaded:",
      imageLoaded,
      "localImageUri:",
      !!localImageUri,
    );
    return (
      <View style={[styles.container, style]}>
        <View
          style={[styles.cropFrame, { width: frameWidth, height: frameHeight }]}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading image...</Text>
          </View>
        </View>
      </View>
    );
  }

  log(
    "Render: Main render - dimensions:",
    originalDimensions.width,
    "x",
    originalDimensions.height,
    "URI:",
    !!localImageUri,
  );

  // Additional safety checks before rendering
  if (
    !originalDimensions.width ||
    !originalDimensions.height ||
    originalDimensions.width <= 0 ||
    originalDimensions.height <= 0
  ) {
    err("Render: Invalid dimensions detected:", originalDimensions);
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Invalid image dimensions</Text>
      </View>
    );
  }

  log(
    "Render: About to render with minScale:",
    minScale,
    "trackedScale:",
    currentScaleValue,
  );

  return (
    <GestureHandlerRootView style={[styles.container, style]}>
      {/* Fixed 4:3 crop frame */}
      <View
        style={[styles.cropFrame, { width: frameWidth, height: frameHeight }]}
      >
        {/* Image with gesture handling */}
        <GestureDetector gesture={composedGesture}>
          <View style={styles.imageContainer}>
            <Animated.View style={[styles.imageWrapper, imageAnimatedStyle]}>
              <Image
                source={{ uri: localImageUri }}
                style={[
                  styles.image,
                  {
                    width: originalDimensions.width,
                    height: originalDimensions.height,
                  },
                ]}
                contentFit="contain"
                contentPosition="center"
                recyclingKey={localImageUri} // Help with memory management
                priority="high"
                cachePolicy="memory-disk"
                onLoadStart={() => log("Image onLoadStart")}
                onLoad={(e) =>
                  log("Image onLoad (natural size may differ platform)")
                }
                onError={(e) => err("Image onError:", e)}
              />
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Crop frame overlay */}
        <View style={styles.cropOverlay} pointerEvents="none">
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
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleReset}
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cropButton]}
            onPress={handleCrop}
          >
            <Text style={styles.cropButtonText}>Crop Image</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GestureHandlerRootView>
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    // Size will be set dynamically based on original dimensions
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
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
  controls: {
    marginTop: 20,
    width: "100%",
    paddingHorizontal: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  resetButton: {
    backgroundColor: "#666",
  },
  resetButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
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
  errorText: {
    color: "#ff4444",
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 20,
  },
});

export default RobustCropper4x3;
