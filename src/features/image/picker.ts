// features/image/picker.ts
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface PickImageOptions {
  source: 'camera' | 'library';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

export interface PickImageResult {
  uri: string;
  width: number;
  height: number;
  cancelled: boolean;
}

export async function requestPermissions(): Promise<boolean> {
  // בקש הרשאות למצלמה ולגלריה
  const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
  const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (cameraPermission.status !== 'granted' || mediaPermission.status !== 'granted') {
    Alert.alert(
      'הרשאות נדרשות',
      'האפליקציה צריכה הרשאות למצלמה ולגלריה כדי להעלות תמונות',
      [{ text: 'אישור' }]
    );
    return false;
  }
  
  return true;
}

export async function pickImage(options: PickImageOptions): Promise<PickImageResult> {
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    return { uri: '', width: 0, height: 0, cancelled: true };
  }

  let result: ImagePicker.ImagePickerResult;
  
  if (options.source === 'camera') {
    result = await ImagePicker.launchCameraAsync({
      allowsEditing: options.allowsEditing || false,
      aspect: options.aspect,
      quality: options.quality || 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: options.allowsEditing || false,
      aspect: options.aspect,
      quality: options.quality || 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
  }

  if (result.canceled || !result.assets?.[0]) {
    return { uri: '', width: 0, height: 0, cancelled: true };
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width || 0,
    height: asset.height || 0,
    cancelled: false,
  };
}
