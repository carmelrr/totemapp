import { useState, useEffect, useRef } from "react";
import { Alert, Animated, Dimensions } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "@/features/data/firebase";
import { useUser } from "@/features/auth/UserContext";
import { saveProfile } from "../services/profileService";
import { uploadImage, deleteOldFirebaseImage } from "../services/imageService";

const { width: screenWidth } = Dimensions.get("window");

declare global {
  var __adminMode: boolean | undefined;
}

export function useProfileBasics() {
  const user = auth.currentUser;
  const { circleSize, setCircleSize } = useUser();
  
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const adminModeRef = useRef(false);
  
  // Side panel animation
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const [showSidePanel, setShowSidePanel] = useState(false);

  // Admin mode persistence
  useEffect(() => {
    const saved = (globalThis as any)?.__adminMode;
    if (saved !== undefined) {
      setAdminMode(!!saved);
      adminModeRef.current = !!saved;
    }
  }, []);

  useEffect(() => {
    (globalThis as any).__adminMode = adminMode;
    adminModeRef.current = adminMode;
  }, [adminMode]);

  const toggleSidePanel = () => {
    if (showSidePanel) {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setShowSidePanel(false));
    } else {
      setShowSidePanel(true);
      Animated.timing(slideAnim, {
        toValue: screenWidth * 0.2,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      await saveProfile(user.uid, { displayName, photoURL });
      setEditing(false);
      Alert.alert("הצלחה", "הפרופיל עודכן");
    } catch (e: any) {
      Alert.alert("שגיאה", "לא ניתן לעדכן פרופיל: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleImageUpload = async (uri: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      const currentPhotoURL = photoURL;
      const downloadURL = await uploadImage(user.uid, uri);
      
      setPhotoURL(downloadURL);
      
      // Delete old image if it exists
      if (
        currentPhotoURL &&
        currentPhotoURL.includes("firebasestorage.googleapis.com")
      ) {
        try {
          await deleteOldFirebaseImage(currentPhotoURL);
        } catch (deleteError) {
          console.warn("Failed to delete old profile image:", deleteError);
        }
      }
      
      Alert.alert("הצלחה", "תמונת הפרופיל עודכנה בהצלחה!");
    } catch (e: any) {
      Alert.alert("שגיאה", e.message || "לא ניתן להעלות תמונה");
    } finally {
      setLoading(false);
    }
  };

  return {
    userId: user?.uid || "",
    displayName,
    email,
    photoURL,
    editing,
    loading,
    isAdmin,
    adminMode,
    circleSize,
    showSidePanel,
    slideAnim,
    setDisplayName,
    setEmail,
    setPhotoURL,
    setEditing,
    setIsAdmin,
    setAdminMode,
    setCircleSize,
    toggleSidePanel,
    handleSave,
    handleLogout,
    handleImageUpload,
  };
}
