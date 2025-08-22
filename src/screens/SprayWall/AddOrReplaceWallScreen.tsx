// screens/SprayWall/AddOrReplaceWallScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pickImage, PickImageResult } from '@/features/image/picker';
import { fixImageOrientation } from '@/features/image/exif';
import { resizeImage } from '@/features/image/resize';
import { THEME_COLORS } from '@/constants/colors';

interface AddOrReplaceWallScreenProps {
  navigation: any;
  route: {
    params: {
      wallId?: string;
      isReplace?: boolean;
    };
  };
}

export const AddOrReplaceWallScreen: React.FC<AddOrReplaceWallScreenProps> = ({
  navigation,
  route,
}) => {
  const [selectedImage, setSelectedImage] = useState<PickImageResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isReplace = route.params?.isReplace || false;

  const handlePickFromCamera = async () => {
    try {
      const result = await pickImage({ source: 'camera' });
      if (!result.cancelled) {
        await processImage(result);
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לצלם תמונה');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await pickImage({ source: 'library' });
      if (!result.cancelled) {
        await processImage(result);
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לבחור תמונה');
    }
  };

  const processImage = async (imageResult: PickImageResult) => {
    setIsProcessing(true);
    
    try {
      // תקן כיוון EXIF
      const fixedUri = await fixImageOrientation(imageResult.uri);
      
      // שנה גודל אם נדרש
      const resizedImage = await resizeImage(
        fixedUri,
        imageResult.width,
        imageResult.height,
        { maxWidth: 4000, maxHeight: 4000, quality: 0.8 }
      );

      setSelectedImage({
        ...imageResult,
        uri: resizedImage.uri,
        width: resizedImage.width,
        height: resizedImage.height,
      });
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לעבד את התמונה');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinue = () => {
    if (!selectedImage) {
      Alert.alert('שגיאה', 'אנא בחר תמונה תחילה');
      return;
    }

    // עבור למסך חיתוך והתאמה
    navigation.navigate('CropAndRectifyScreen', {
      imageUri: selectedImage.uri,
      imageWidth: selectedImage.width,
      imageHeight: selectedImage.height,
      wallId: route.params?.wallId,
      isReplace,
    });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>
          {isReplace ? 'החלפת תמונת קיר' : 'הוספת קיר ספריי חדש'}
        </Text>

        <Text style={styles.subtitle}>
          בחר תמונה של הקיר מהמצלמה או מהגלריה
        </Text>

        {/* Image Selection Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handlePickFromCamera}
            disabled={isProcessing}
          >
            <Text style={styles.buttonIcon}>📷</Text>
            <Text style={styles.buttonText}>צילום מהמצלמה</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageButton}
            onPress={handlePickFromGallery}
            disabled={isProcessing}
          >
            <Text style={styles.buttonIcon}>🖼️</Text>
            <Text style={styles.buttonText}>בחירה מהגלריה</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>תמונה נבחרה:</Text>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
            <Text style={styles.imageDimensions}>
              {selectedImage.width} × {selectedImage.height} פיקסלים
            </Text>
          </View>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingContainer}>
            <Text style={styles.processingText}>מעבד תמונה...</Text>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>טיפים לתמונה טובה:</Text>
          <Text style={styles.tipText}>• צלם את הקיר במלואו</Text>
          <Text style={styles.tipText}>• וודא שהתאורה אחידה</Text>
          <Text style={styles.tipText}>• הימנע מצללים חזקים</Text>
          <Text style={styles.tipText}>• צלם בזווית ישרה לקיר</Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>ביטול</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueButton, !selectedImage && styles.disabledButton]}
          onPress={handleContinue}
          disabled={!selectedImage || isProcessing}
        >
          <Text style={styles.continueButtonText}>המשך</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  imageButton: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
    borderStyle: 'dashed',
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  previewContainer: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  imageDimensions: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  processingContainer: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  processingText: {
    fontSize: 16,
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
  tipsContainer: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  continueButton: {
    flex: 1,
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
