import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Simple4x3Viewer from '@/components/spray/Simple4x3Viewer';
import { sprayApi } from '@/features/spraywall/sprayApi';
import { checkIsAdmin } from '@/features/auth/permissions';

const SprayResetScreen = ({ navigation, route }) => {
  const { wallId, currentSeason } = route.params;
  // Store the selected asset with uri + dimensions to avoid heavy getSize()
  const [selectedImage, setSelectedImage] = useState(null); // { uri, width, height }
  const [croppedImage, setCroppedImage] = useState(null);
  const [cropMeta, setCropMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImagePicker = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access camera roll is required!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        // width/height are provided by ImagePicker; fall back to 0 if missing
        setSelectedImage({ uri: asset.uri, width: asset.width || 0, height: asset.height || 0 });
        setCroppedImage(null);
        setCropMeta(null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCropComplete = (croppedUri, metadata) => {
    setCroppedImage(croppedUri);
    setCropMeta(metadata);
  };

  const showWarningAndProceed = () => {
    const warningMessage = currentSeason 
      ? 'This action will:\n\n• Replace the current spray wall image\n• Archive all existing routes and sends\n• Delete the previous image from storage\n• Cannot be undone\n\nContinue?'
      : 'This action will:\n\n• Create the first spray wall season\n• Upload the image to storage\n\nContinue?';
      
    Alert.alert(
      currentSeason ? 'Warning: Replace Spray Wall' : 'Create Spray Wall',
      warningMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: currentSeason ? 'destructive' : 'default',
          onPress: currentSeason ? showFinalConfirmation : handleResetSpray,
        },
      ]
    );
  };

  const showFinalConfirmation = () => {
    Alert.alert(
      'Final Confirmation',
      'Are you absolutely sure you want to replace the spray wall? This will delete the current image permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace Now',
          style: 'destructive',
          onPress: handleResetSpray,
        },
      ]
    );
  };

  const handleResetSpray = async () => {
    try {
      setLoading(true);

      // Check admin permission again
      const isAdmin = await checkIsAdmin();
      if (!isAdmin) {
        Alert.alert('Access Denied', 'Only administrators can reset the spray wall');
        return;
      }

      // Convert image to blob
      const response = await fetch(croppedImage);
      const blob = await response.blob();

      // Create new season
      const seasonId = await sprayApi.createNewSeason(wallId, blob, cropMeta);

      Alert.alert(
        'Success',
        currentSeason ? 
          'Spray wall has been replaced with a new season!' :
          'Spray wall has been created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error resetting spray:', error);
      Alert.alert('Error', 'Failed to reset spray wall. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = croppedImage && cropMeta && !loading;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {currentSeason ? 'Replace Spray Wall' : 'Create Spray Wall'}
          </Text>
          <Text style={styles.subtitle}>
            {currentSeason ? 
              'Upload a new image to replace the current season' :
              'Upload an image to create the first season'
            }
          </Text>
        </View>

        {!selectedImage ? (
          <View style={styles.emptyState}>
            <TouchableOpacity style={styles.selectButton} onPress={handleImagePicker}>
              <Text style={styles.selectButtonText}>Select Image</Text>
            </TouchableOpacity>
          </View>
        ) : !croppedImage ? (
          <View style={styles.cropContainer}>
            <Text style={styles.stepText}>Step 2: Process to 4:3 ratio</Text>
            <Simple4x3Viewer
              imageUri={selectedImage.uri}
              onImageReady={handleCropComplete}
              style={styles.cropper}
            />
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <Text style={styles.stepText}>Step 3: Preview & Confirm</Text>
            <View style={styles.preview}>
              <Image source={{ uri: croppedImage }} style={styles.previewImage} />
            </View>
            
            <View style={styles.previewInfo}>
              <Text style={styles.infoText}>
                • New season will be created
              </Text>
              <Text style={styles.infoText}>
                • Previous routes will be archived
              </Text>
              <Text style={styles.infoText}>
                • Image will be uploaded to Firebase Storage
              </Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          {selectedImage && !croppedImage && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.backButtonText}>Select Different Image</Text>
            </TouchableOpacity>
          )}
          
          {croppedImage && (
            <>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => {
                  setCroppedImage(null);
                  setCropMeta(null);
                }}
              >
                <Text style={styles.backButtonText}>Back to Crop</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.resetButton, !canProceed && styles.disabledButton]}
                onPress={showWarningAndProceed}
                disabled={!canProceed}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.resetButtonText}>
                    {currentSeason ? 'Replace Spray Wall' : 'Create Spray Wall'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  selectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  selectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cropContainer: {
    flex: 1,
    margin: 16,
  },
  cropScrollContainer: {
    flex: 1,
  },
  cropScrollContent: {
    flexGrow: 1,
  },
  stepText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  cropper: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewContainer: {
    flex: 1,
    margin: 16,
  },
  preview: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  previewInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  footer: {
    padding: 20,
    gap: 12,
  },
  backButton: {
    backgroundColor: '#666',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SprayResetScreen;
