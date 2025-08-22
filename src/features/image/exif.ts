// features/image/exif.ts
import * as ImageManipulator from 'expo-image-manipulator';

export interface ExifInfo {
  orientation: number;
  needsRotation: boolean;
  rotationDegrees: number;
}

export async function getExifInfo(uri: string): Promise<ExifInfo> {
  // Note: expo-image-manipulator handles EXIF automatically in most cases
  // This is a placeholder for more complex EXIF handling if needed
  return {
    orientation: 1,
    needsRotation: false,
    rotationDegrees: 0,
  };
}

export async function fixImageOrientation(uri: string): Promise<string> {
  try {
    // expo-image-manipulator automatically handles EXIF orientation
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [], // No transformations needed - orientation is handled automatically
      {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return result.uri;
  } catch (error) {
    console.error('Error fixing image orientation:', error);
    return uri; // Return original if fixing fails
  }
}
