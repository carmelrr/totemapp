import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  Image as RNImage,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  clamp,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const { width: screenWidth } = Dimensions.get('window');

const RobustCropper4x3 = ({ imageUri, onCropComplete, style }) => {
  // Fixed 4:3 crop frame dimensions
  const frameWidth = screenWidth - 40; // 20px margin each side
  const frameHeight = frameWidth * 3 / 4; // 4:3 aspect ratio

  // Image state
  const [imageLoaded, setImageLoaded] = useState(false);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [localImageUri, setLocalImageUri] = useState(null);
  const [minScale, setMinScale] = useState(1);

  // Gesture shared values
  const scale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  
  // Gesture start values
  const startScale = useSharedValue(1);
  const startTranslationX = useSharedValue(0);
  const startTranslationY = useSharedValue(0);

  const maxScale = 4;

  // Download remote image if needed and measure dimensions
  useEffect(() => {
    let isMounted = true;
    
    const setupImage = async () => {
      try {
        console.log('[RobustCropper] Setting up image:', imageUri);
        setImageLoaded(false);
        
        let localUri = imageUri;
        
        // Download remote images to local storage
        if (imageUri.startsWith('http')) {
          console.log('[RobustCropper] Downloading remote image...');
          const filename = imageUri.split('/').pop() || 'image.jpg';
          const downloadPath = `${FileSystem.documentDirectory}temp_crop_${Date.now()}_${filename}`;
          
          const downloadResult = await FileSystem.downloadAsync(imageUri, downloadPath);
          localUri = downloadResult.uri;
          console.log('[RobustCropper] Downloaded to:', localUri);
        }
        
        if (!isMounted) return;
        setLocalImageUri(localUri);
        
        // Measure image dimensions
        console.log('[RobustCropper] Measuring image dimensions...');
        RNImage.getSize(
          localUri,
          (width, height) => {
            if (!isMounted) return;
            console.log('[RobustCropper] Image dimensions:', width, 'x', height);
            
            if (width > 0 && height > 0) {
              setOriginalDimensions({ width, height });
              
              // Calculate minimum scale to cover the 4:3 frame
              const scaleToFitWidth = frameWidth / width;
              const scaleToFitHeight = frameHeight / height;
              const calculatedMinScale = Math.max(scaleToFitWidth, scaleToFitHeight);
              
              console.log('[RobustCropper] Min scale calculated:', calculatedMinScale);
              setMinScale(calculatedMinScale);
              
              // Set initial scale to cover frame
              scale.value = calculatedMinScale;
              translationX.value = 0;
              translationY.value = 0;
              
              setImageLoaded(true);
            } else {
              throw new Error('Invalid image dimensions');
            }
          },
          (error) => {
            if (!isMounted) return;
            console.error('[RobustCropper] Failed to get image size:', error);
            Alert.alert('Error', 'Failed to load image dimensions');
          }
        );
      } catch (error) {
        if (!isMounted) return;
        console.error('[RobustCropper] Setup error:', error);
        Alert.alert('Error', `Failed to prepare image: ${error.message}`);
      }
    };

    if (imageUri) {
      setupImage();
    }

    return () => {
      isMounted = false;
    };
  }, [imageUri, frameWidth, frameHeight]);

  // Calculate pan bounds to keep image covering the frame
  const getPanBounds = useCallback((currentScale) => {
    if (!originalDimensions.width || !originalDimensions.height) {
      return { maxX: 0, maxY: 0 };
    }

    const scaledWidth = originalDimensions.width * currentScale;
    const scaledHeight = originalDimensions.height * currentScale;

    const maxX = Math.max(0, (scaledWidth - frameWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - frameHeight) / 2);

    return { maxX, maxY };
  }, [originalDimensions, frameWidth, frameHeight]);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startTranslationX.value = translationX.value;
      startTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      const { maxX, maxY } = getPanBounds(scale.value);
      
      translationX.value = clamp(
        startTranslationX.value + event.translationX,
        -maxX,
        maxX
      );
      translationY.value = clamp(
        startTranslationY.value + event.translationY,
        -maxY,
        maxY
      );
    });

  // Pinch gesture with focal point compensation
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      startScale.value = scale.value;
      startTranslationX.value = translationX.value;
      startTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      const newScale = clamp(startScale.value * event.scale, minScale, maxScale);
      
      // Focal point compensation to keep zoom centered under fingers
      const frameCenterX = frameWidth / 2;
      const frameCenterY = frameHeight / 2;
      const focalOffsetX = event.focalX - frameCenterX;
      const focalOffsetY = event.focalY - frameCenterY;
      
      const scaleFactor = (newScale / scale.value) - 1;
      const adjustedTranslationX = startTranslationX.value - focalOffsetX * scaleFactor;
      const adjustedTranslationY = startTranslationY.value - focalOffsetY * scaleFactor;
      
      const { maxX, maxY } = getPanBounds(newScale);
      
      scale.value = newScale;
      translationX.value = clamp(adjustedTranslationX, -maxX, maxX);
      translationY.value = clamp(adjustedTranslationY, -maxY, maxY);
    })
    .onEnd(() => {
      // Smooth spring animation when gesture ends
      scale.value = withSpring(scale.value);
      translationX.value = withSpring(translationX.value);
      translationY.value = withSpring(translationY.value);
    });

  // Combine gestures to work simultaneously
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Animated style for the image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    if (!imageLoaded) return { opacity: 0 };
    
    return {
      transform: [
        { scale: scale.value },
        { translateX: translationX.value },
        { translateY: translationY.value },
      ],
    };
  });

  // Handle crop operation
  const handleCrop = async () => {
    try {
      console.log('[RobustCropper] Starting crop operation...');
      
      if (!imageLoaded || !localImageUri || !originalDimensions.width || !originalDimensions.height) {
        Alert.alert('Error', 'Image not ready for cropping');
        return;
      }

      const currentScale = scale.value;
      const currentTranslationX = translationX.value;
      const currentTranslationY = translationY.value;

      console.log('[RobustCropper] Current transform:', {
        scale: currentScale,
        translationX: currentTranslationX,
        translationY: currentTranslationY
      });

      // Calculate the visible area in original image coordinates
      const scaledImageWidth = originalDimensions.width * currentScale;
      const scaledImageHeight = originalDimensions.height * currentScale;

      // Calculate the top-left corner of the crop area in the scaled image
      const visibleLeft = (scaledImageWidth - frameWidth) / 2 - currentTranslationX;
      const visibleTop = (scaledImageHeight - frameHeight) / 2 - currentTranslationY;

      // Convert to original image pixel coordinates
      const pixelRatioX = originalDimensions.width / scaledImageWidth;
      const pixelRatioY = originalDimensions.height / scaledImageHeight;

      let cropOriginX = Math.round(visibleLeft * pixelRatioX);
      let cropOriginY = Math.round(visibleTop * pixelRatioY);
      let cropWidth = Math.round(frameWidth * pixelRatioX);
      let cropHeight = Math.round(frameHeight * pixelRatioY);

      // Clamp to image bounds to prevent out-of-bounds errors
      cropOriginX = Math.max(0, Math.min(originalDimensions.width - 1, cropOriginX));
      cropOriginY = Math.max(0, Math.min(originalDimensions.height - 1, cropOriginY));
      cropWidth = Math.max(1, Math.min(originalDimensions.width - cropOriginX, cropWidth));
      cropHeight = Math.max(1, Math.min(originalDimensions.height - cropOriginY, cropHeight));

      console.log('[RobustCropper] Crop parameters:', {
        originX: cropOriginX,
        originY: cropOriginY,
        width: cropWidth,
        height: cropHeight,
        originalSize: originalDimensions
      });

      // Validate crop parameters
      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error('Invalid crop dimensions calculated');
      }

      // Memory management: resize very large images before cropping
      let sourceUri = localImageUri;
      let resizeRatio = 1;
      const maxDimension = Math.max(originalDimensions.width, originalDimensions.height);
      
      if (maxDimension > 6000) {
        console.log('[RobustCropper] Large image detected, resizing first...');
        const targetMaxDimension = 4000;
        resizeRatio = targetMaxDimension / maxDimension;
        
        const resizeWidth = Math.round(originalDimensions.width * resizeRatio);
        const resizeHeight = Math.round(originalDimensions.height * resizeRatio);
        
        const resizeResult = await ImageManipulator.manipulateAsync(
          localImageUri,
          [{ resize: { width: resizeWidth, height: resizeHeight } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        sourceUri = resizeResult.uri;
        
        // Adjust crop parameters for resized image
        cropOriginX = Math.round(cropOriginX * resizeRatio);
        cropOriginY = Math.round(cropOriginY * resizeRatio);
        cropWidth = Math.round(cropWidth * resizeRatio);
        cropHeight = Math.round(cropHeight * resizeRatio);
        
        console.log('[RobustCropper] Adjusted crop for resize:', {
          originX: cropOriginX,
          originY: cropOriginY,
          width: cropWidth,
          height: cropHeight
        });
      }

      // Perform the crop
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
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log('[RobustCropper] Crop successful:', cropResult.uri);

      if (onCropComplete) {
        onCropComplete(cropResult.uri, {
          originX: cropOriginX,
          originY: cropOriginY,
          width: cropWidth,
          height: cropHeight,
        });
      }
    } catch (error) {
      console.error('[RobustCropper] Crop error:', error);
      Alert.alert('Crop Error', `Failed to crop image: ${error.message}`);
    }
  };

  if (!imageLoaded || !localImageUri) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.cropFrame, { width: frameWidth, height: frameHeight }]}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading image...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, style]}>
      {/* Fixed 4:3 crop frame */}
      <View style={[styles.cropFrame, { width: frameWidth, height: frameHeight }]}>
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
              />
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Crop frame overlay */}
        <View style={styles.cropOverlay} pointerEvents="none">
          <View style={styles.cropBorder} />
          <Text style={styles.cropText}>
            4:3 Crop Area{'\n'}Pinch to zoom • Drag to pan
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
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    // Size will be set dynamically based on original dimensions
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  cropBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#fff',
    borderStyle: 'dashed',
  },
  cropText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  handle: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: -1,
  },
  controls: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  cropButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cropButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RobustCropper4x3;
