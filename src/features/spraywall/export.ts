// features/spraywall/export.ts
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export interface ExportOptions {
  format: "png" | "jpg";
  quality?: number;
  includeOverlay?: boolean;
  backgroundTransparent?: boolean;
}

export interface ExportResult {
  uri: string;
  width: number;
  height: number;
  success: boolean;
}

// מימוש זמני - בפועל יצריך Skia Canvas
export async function exportWallWithRoutes(
  wallImageUri: string,
  overlayData: any, // נתוני השכבות
  options: ExportOptions = { format: "png" },
): Promise<ExportResult> {
  try {
    // TODO: מימוש אמיתי עם Skia
    // כרגע מחזיר את התמונה המקורית

    console.log("Exporting wall with routes...", {
      wallImageUri,
      overlayData,
      options,
    });

    // זמני - פשוט מחזיר את URI המקורי
    return {
      uri: wallImageUri,
      width: 1000,
      height: 1000,
      success: true,
    };
  } catch (error) {
    console.error("Export failed:", error);
    return {
      uri: "",
      width: 0,
      height: 0,
      success: false,
    };
  }
}

export async function saveToGallery(imageUri: string): Promise<boolean> {
  try {
    // בקש הרשאות
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("הרשאה נדרשת", "נדרשת הרשאה לשמירה בגלריה");
      return false;
    }

    // שמור לגלריה
    await MediaLibrary.saveToLibraryAsync(imageUri);
    return true;
  } catch (error) {
    console.error("Failed to save to gallery:", error);
    return false;
  }
}

export async function shareImage(imageUri: string): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("שגיאה", "שיתוף לא זמין במכשיר זה");
      return false;
    }

    await Sharing.shareAsync(imageUri, {
      mimeType: "image/png",
      dialogTitle: "שתף מסלול ספריי",
    });

    return true;
  } catch (error) {
    console.error("Failed to share image:", error);
    return false;
  }
}

// פונקציה ליצירת snapshot של קנבס (יצריך Skia)
export async function captureCanvas(
  canvasRef: any, // Skia Canvas Ref
): Promise<string | null> {
  try {
    // TODO: מימוש אמיתי עם Skia
    // const image = canvasRef.current?.makeImageSnapshot();
    // const data = image.encodeToBase64();
    // return `data:image/png;base64,${data}`;

    console.log("Canvas capture not implemented yet");
    return null;
  } catch (error) {
    console.error("Canvas capture failed:", error);
    return null;
  }
}

// פונקציה ליצירת תמונה עם נתוני מסלול
export function generateRouteOverlayData(
  routeData: any, // Route object
  wallDimensions: { width: number; height: number },
) {
  return {
    holds: routeData.holds || [],
    volumes: routeData.volumes || [],
    routeName: routeData.name,
    routeGrade: routeData.grade,
    wallDimensions,
    timestamp: Date.now(),
  };
}
