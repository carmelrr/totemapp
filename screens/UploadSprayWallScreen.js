import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { createSprayWall } from '../services/sprayWallService';
import { generateHoldGrid } from '../services/holdDetectionService';

export default function UploadSprayWallScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [selectedImage, setSelectedImage] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const styles = createStyles(theme);

  const pickImage = async () => {
    try {
      console.log('Starting image picker...');
      
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Media library permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('שגיאה', 'נדרשת הרשאה לגישה לגלריה');
        return;
      }      // Launch image picker with improved config
      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4], // 3:4 aspect ratio for spray walls (portrait)
        quality: 0.9, // High quality for better hold detection
        allowsMultipleSelection: false,
        base64: false, // Don't include base64 to avoid memory issues
        exif: false, // Don't include EXIF data
      });

      console.log('Image picker result:', {
        canceled: result.canceled,
        assetsLength: result.assets ? result.assets.length : 0
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log('Selected image asset:', {
          uri: selectedAsset.uri,
          width: selectedAsset.width,
          height: selectedAsset.height,
          fileSize: selectedAsset.fileSize
        });
        
        setSelectedImage(selectedAsset);
      } else {
        console.log('Image selection was canceled or no assets found');
      }
    } catch (error) {
      console.error('Error in pickImage:', error);
      Alert.alert('שגיאה', `שגיאה בבחירת תמונה: ${error.message}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      Alert.alert('שגיאה', 'יש לבחור תמונה');
      return;
    }

    Alert.alert(
      'אישור העלאה',
      'העלאת קיר ספריי חדש תאפס את הלידרבורד הקיים ותתחיל עונת ספריי חדשה. האם אתה בטוח?',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'המשך', 
          style: 'destructive',
          onPress: uploadSprayWall
        }
      ]
    );
  };

  const uploadSprayWall = async () => {
    setUploading(true);
    try {
      console.log('Starting spray wall upload process...');
      
      // הכנת נתוני הקיר עם התמונה והתיאור
      const sprayWallData = {
        imageUri: selectedImage.uri,
        description: description.trim(),
        width: selectedImage.width || 1080,
        height: selectedImage.height || 1440,
      };
      
      console.log('Spray wall data prepared:', sprayWallData);
      
      // העלאת קיר הספריי
      const newSprayWall = await createSprayWall(sprayWallData);
      console.log('Spray wall created:', newSprayWall);
      
      // יצירת גריד אוטומטי של אחיזות אפשריות
      console.log('Creating automatic hold grid...');
      await generateHoldGrid(newSprayWall.id, sprayWallData.width, sprayWallData.height);
      
      const holdCount = Math.floor((sprayWallData.width * sprayWallData.height) / 5000); // תחשיב משוער
      
      Alert.alert(
        'הצלחה!',
        `קיר הספריי החדש הועלה בהצלחה עם ${holdCount} נקודות אחיזה אוטומטיות! עונת ספריי חדשה התחילה!`,
        [
          {
            text: 'אישור',
            onPress: () => {
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error uploading spray wall:', error);
      const errorMessage = error.message || 'אירעה שגיאה לא ידועה';
      Alert.alert('שגיאה', `שגיאה בהעלאת הקיר: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={uploading}
        >
          <Text style={styles.backButtonText}>← חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>העלאת קיר ספריי חדש</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Warning */}
        <View style={styles.warningContainer}>
          <Text style={styles.warningTitle}>⚠️ אזהרה</Text>
          <Text style={styles.warningText}>
            העלאת קיר ספריי חדש תאפס את הלידרבורד הקיים ותתחיל עונת ספריי חדשה.
            כל המסלולים והניקוד הקיימים יישארו בהיסטוריה אבל לא יובאו בחשבון בלידרבורד החדש.
          </Text>
        </View>

        {/* Image Selection */}
        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>תמונת הקיר</Text>
          
          {selectedImage ? (
            <View style={styles.selectedImageContainer}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.selectedImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={pickImage}
                disabled={uploading}
              >
                <Text style={styles.changeImageButtonText}>📸 שנה תמונה</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectImageButton}
              onPress={pickImage}
              disabled={uploading}
            >
              <Text style={styles.selectImageButtonText}>📷 בחר תמונה</Text>
              <Text style={styles.selectImageSubtext}>
                מומלץ תמונה באיכות גבוהה בפורמט נוף (16:9)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>תיאור (אופציונלי)</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="תיאור העונה החדשה, שינויים בקירות, וכד'..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!uploading}
          />
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={uploading || !selectedImage}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.uploadButtonText}>מעלה...</Text>
            </View>
          ) : (
            <Text style={styles.uploadButtonText}>🚀 העלה קיר חדש</Text>
          )}
        </TouchableOpacity>

        {/* Season Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>ℹ️ מה יקרה לאחר ההעלאה?</Text>
          <Text style={styles.infoText}>
            • הקיר הישן יועבר לארכיון{'\n'}
            • לידרבורד חדש יתחיל מאפס{'\n'}
            • המשתמשים יוכלו להתחיל להוסיף מסלולים חדשים{'\n'}
            • כל הנתונים הישנים יישמרו בהיסטוריה
          </Text>
        </View>
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
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  warningContainer: {
    backgroundColor: theme.warning + '20',
    borderWidth: 1,
    borderColor: theme.warning,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.warning,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
  imageSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
  },
  selectedImageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: theme.border,
    marginBottom: 12,
  },
  changeImageButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  changeImageButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectImageButton: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  selectImageButtonText: {
    fontSize: 18,
    color: theme.primary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectImageSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionInput: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    minHeight: 100,
  },
  uploadButton: {
    backgroundColor: theme.error,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  uploadButtonDisabled: {
    backgroundColor: theme.border,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});
