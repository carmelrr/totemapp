// features/image/resize.ts
import * as ImageManipulator from 'expo-image-manipulator';

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

export interface ResizeResult {
  uri: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

export async function resizeImage(
  uri: string, 
  originalWidth: number,
  originalHeight: number,
  options: ResizeOptions = {}
): Promise<ResizeResult> {
  const {
    maxWidth = 4000,
    maxHeight = 4000,
    quality = 0.8,
    format = 'jpeg'
  } = options;

  try {
    // בדוק אם צריך לשנות גודל
    const needsResize = originalWidth > maxWidth || originalHeight > maxHeight;
    
    if (!needsResize) {
      return {
        uri,
        width: originalWidth,
        height: originalHeight,
        originalWidth,
        originalHeight,
      };
    }

    // חשב גודל חדש תוך שמירה על יחס גובה-רוחב
    const aspectRatio = originalWidth / originalHeight;
    let newWidth = originalWidth;
    let newHeight = originalHeight;

    if (originalWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = maxWidth / aspectRatio;
    }

    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = maxHeight * aspectRatio;
    }

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: Math.round(newWidth), height: Math.round(newHeight) } }],
      {
        compress: quality,
        format: format === 'jpeg' ? ImageManipulator.SaveFormat.JPEG : ImageManipulator.SaveFormat.PNG,
      }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      originalWidth,
      originalHeight,
    };
  } catch (error) {
    console.error('Error resizing image:', error);
    // Return original if resize fails
    return {
      uri,
      width: originalWidth,
      height: originalHeight,
      originalWidth,
      originalHeight,
    };
  }
}
