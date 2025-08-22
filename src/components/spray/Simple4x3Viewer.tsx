import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const { width: screenWidth } = Dimensions.get('window');

const Simple4x3Viewer = ({ imageUri, onImageReady, style, enableDebug = false }) => {
  const log = (...args) => {
    if (enableDebug) console.log('[Simple4x3Viewer]', ...args);
  };

  // Fixed 4:3 dimensions
  const frameWidth = screenWidth - 40;
  const frameHeight = frameWidth * 3 / 4;

  // Image state
  const [loading, setLoading] = useState(false);
  const [processedImageUri, setProcessedImageUri] = useState(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });

  // Process image to 4:3 aspect ratio
  useEffect(() => {
    let isMounted = true;
    
    const processImage = async () => {
      if (!imageUri) return;

      try {
        setLoading(true);
        log('Processing image:', imageUri);
        
        let localUri = imageUri;
        
        // Download remote images if needed
        if (imageUri.startsWith('http')) {
          log('Downloading remote image...');
          const filename = imageUri.split('/').pop() || 'image.jpg';
          const downloadPath = `${FileSystem.documentDirectory}temp_${Date.now()}_${filename}`;
          const downloadResult = await FileSystem.downloadAsync(imageUri, downloadPath);
          localUri = downloadResult.uri;
          log('Download complete:', localUri);
        }
        
        // Get image dimensions
        log('Getting image dimensions...');
        const result = await ImageManipulator.manipulateAsync(
          localUri, 
          [], 
          { format: ImageManipulator.SaveFormat.JPEG }
        );
        
        if (!isMounted) return;
        
        const { width, height } = result;
        log('Original dimensions:', width, 'x', height);
        setOriginalDimensions({ width, height });
        
        // Calculate how to crop to 4:3
        const currentAspectRatio = width / height;
        const targetAspectRatio = 4 / 3;
        
        let cropWidth = width;
        let cropHeight = height;
        let cropOriginX = 0;
        let cropOriginY = 0;
        
        if (currentAspectRatio > targetAspectRatio) {
          // Image is wider than 4:3, crop width
          cropWidth = Math.round(height * targetAspectRatio);
          cropOriginX = Math.round((width - cropWidth) / 2);
        } else if (currentAspectRatio < targetAspectRatio) {
          // Image is taller than 4:3, crop height
          cropHeight = Math.round(width / targetAspectRatio);
          cropOriginY = Math.round((height - cropHeight) / 2);
        }
        
        log('Crop parameters:', {
          originX: cropOriginX,
          originY: cropOriginY,
          width: cropWidth,
          height: cropHeight,
          aspectRatio: (cropWidth / cropHeight).toFixed(3)
        });
        
        // Perform the crop to 4:3
        const croppedResult = await ImageManipulator.manipulateAsync(
          localUri,
          [{
            crop: {
              originX: cropOriginX,
              originY: cropOriginY,
              width: cropWidth,
              height: cropHeight,
            },
          }],
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        
        if (!isMounted) return;
        
        log('Crop completed:', croppedResult.uri);
        log('Result dimensions:', croppedResult.width, 'x', croppedResult.height);
        log('Result aspect ratio:', (croppedResult.width / croppedResult.height).toFixed(3));
        
        setProcessedImageUri(croppedResult.uri);
        
        // Clean up temp files
        if (result.uri !== localUri) {
          await FileSystem.deleteAsync(result.uri).catch(() => {});
        }
        if (localUri !== imageUri && localUri.includes('temp_')) {
          await FileSystem.deleteAsync(localUri).catch(() => {});
        }
        
      } catch (error) {
        if (!isMounted) return;
        log('Processing error:', error);
        Alert.alert('Error', `Failed to process image: ${error.message}`);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    processImage();

    return () => {
      isMounted = false;
    };
  }, [imageUri]);

  // Handle confirm
  const handleConfirm = () => {
    if (processedImageUri && onImageReady) {
      log('Confirming processed image:', processedImageUri);
      onImageReady(processedImageUri, {
        aspectRatio: 4/3,
        originalDimensions,
        processedUri: processedImageUri
      });
    }
  };

  // Handle retry
  const handleRetry = () => {
    setProcessedImageUri(null);
    setLoading(false);
    // This will trigger useEffect to process again
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Processing image to 4:3...</Text>
            <Text style={styles.subText}>Please wait</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!processedImageUri) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to process image</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Title */}
      <Text style={styles.title}>Image Preview (4:3 Format)</Text>
      <Text style={styles.subtitle}>The image has been automatically cropped to 4:3 aspect ratio</Text>
      
      {/* Image frame */}
      <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
        <Image
          source={{ uri: processedImageUri }}
          style={styles.image}
          resizeMode="cover"
          onLoad={() => log('Processed image loaded')}
          onError={(e) => log('Image load error:', e.nativeEvent)}
        />
        
        {/* Frame border */}
        <View style={styles.frameBorder} />
        
        {/* Aspect ratio indicator */}
        <View style={styles.aspectRatioIndicator}>
          <Text style={styles.aspectRatioText}>4:3</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>✓ Use This Image</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.retryButton]} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>↻ Process Again</Text>
        </TouchableOpacity>
      </View>
      
      {enableDebug && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Original: {originalDimensions.width}×{originalDimensions.height}
          </Text>
          <Text style={styles.debugText}>
            Frame: {Math.round(frameWidth)}×{Math.round(frameHeight)}
          </Text>
          <Text style={styles.debugText}>
            URI: {processedImageUri ? 'Ready' : 'Not ready'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  frame: {
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  frameBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 12,
    pointerEvents: 'none',
  },
  aspectRatioIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aspectRatioText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  controls: {
    marginTop: 24,
    width: '100%',
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#FF9800',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  debugInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 2,
  },
});

export default Simple4x3Viewer;
