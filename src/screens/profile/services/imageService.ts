import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { auth, db, storage } from "@/features/data/firebase";
import { doc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  deleteObject,
} from "firebase/storage";

export async function pickImage(): Promise<string | undefined> {
  // Request gallery permissions before opening image picker
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("אין הרשאה", "יש לאשר גישה לגלריה כדי לבחור תמונה");
      return;
    }
  }

  try {
    let result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
  } catch (e) {
    Alert.alert("שגיאה", "אירעה שגיאה בפתיחת בורר התמונות");
  }

  return undefined;
}

export async function uploadImage(userId: string, uri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("User not authenticated");
  }

  try {
    // Create unique filename
    const fileName = `profile_${userId}_${Date.now()}.jpg`;
    const imageRef = ref(storage, `users/${userId}/profile/${fileName}`);

    // Convert URI to blob for Firebase Storage
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload to Firebase Storage
    console.log("Uploading image to Firebase Storage...");
    const snapshot = await uploadBytes(imageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("Image uploaded successfully:", downloadURL);

    // Update Firebase Authentication profile (for persistence)
    await updateProfile(user, { photoURL: downloadURL });

    // Update Firestore (source of truth)
    await setDoc(
      doc(db, "users", userId),
      { photoURL: downloadURL },
      { merge: true },
    );

    return downloadURL;
  } catch (e: any) {
    console.error("Error uploading image:", e);
    throw new Error("לא ניתן להעלות תמונה: " + (e.message || e));
  }
}

export async function deleteOldFirebaseImage(imageUrl: string): Promise<void> {
  try {
    console.log("Deleting old image from Firebase Storage:", imageUrl);

    // Extract path from Firebase Storage URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?alt=media&token=...
    const urlParts = imageUrl.split("/o/")[1].split("?")[0];
    const filePath = decodeURIComponent(urlParts);

    console.log("Extracted file path for deletion:", filePath);

    const imageRef = ref(storage, filePath);
    await deleteObject(imageRef);

    console.log("Old image deleted successfully from Firebase Storage");
  } catch (error) {
    console.error("Error deleting old image from Firebase Storage:", error);
    throw error;
  }
}

export async function removeProfileImage(userId: string, currentPhotoURL: string | null): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("User not authenticated");
  }

  return new Promise((resolve, reject) => {
    Alert.alert(
      "הסרת תמונת פרופיל",
      "האם אתה בטוח שברצונך להסיר את תמונת הפרופיל שלך?",
      [
        {
          text: "ביטול",
          style: "cancel",
          onPress: () => resolve(),
        },
        {
          text: "הסר",
          style: "destructive",
          onPress: async () => {
            try {
              // Update to default image
              await setDoc(
                doc(db, "users", userId),
                { photoURL: null },
                { merge: true },
              );

              // Update Firebase Authentication
              await updateProfile(user, { photoURL: null });

              // Delete image from Firebase Storage if it exists
              if (
                currentPhotoURL &&
                currentPhotoURL.includes("firebasestorage.googleapis.com")
              ) {
                try {
                  await deleteOldFirebaseImage(currentPhotoURL);
                } catch (deleteError) {
                  console.warn(
                    "Failed to delete image from Firebase Storage:",
                    deleteError,
                  );
                }
              }

              Alert.alert("הצלחה", "תמונת הפרופיל הוסרה בהצלחה");
              resolve();
            } catch (error) {
              console.error("Error removing profile image:", error);
              Alert.alert("שגיאה", "לא ניתן להסיר את תמונת הפרופיל");
              reject(error);
            }
          },
        },
      ],
    );
  });
}
