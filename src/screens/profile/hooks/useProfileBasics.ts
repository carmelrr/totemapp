import { useState, useEffect, useRef } from "react";
import { Alert, Animated, Dimensions } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "@/features/data/firebase";
import { useUser } from "@/features/auth/UserContext";
import { useUserStore, useUserProfile } from "@/store/userStore";
import { saveProfile, fetchProfile } from "../services/profileService";
import { uploadImage, deleteOldFirebaseImage } from "../services/imageService";

const { width: screenWidth } = Dimensions.get("window");

declare global {
  var __adminMode: boolean | undefined;
}

export function useProfileBasics() {
  const firebaseUser = auth.currentUser;
  const { circleSize, setCircleSize } = useUser();
  
  // Get persisted profile from Zustand store
  const userProfile = useUserProfile();
  const updateUserProfile = useUserStore((state) => state.updateUserProfile);
  const loadUserProfile = useUserStore((state) => state.loadUserProfile);
  
  // Initialize state from Zustand cache first, fallback to Firebase Auth
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || firebaseUser?.displayName || ""
  );
  const [email, setEmail] = useState(
    userProfile?.email || firebaseUser?.email || ""
  );
  const [photoURL, setPhotoURL] = useState<string | null>(
    userProfile?.photoURL || null
  );
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

  // Sync state from Zustand profile when it updates
  useEffect(() => {
    if (userProfile) {
      if (userProfile.displayName) setDisplayName(userProfile.displayName);
      if (userProfile.email) setEmail(userProfile.email);
      if (userProfile.photoURL !== undefined) setPhotoURL(userProfile.photoURL || null);
      setIsAdmin(userProfile.isAdmin || false);
    }
  }, [userProfile]);

  // Fetch profile from Firestore on mount if not in Zustand cache
  useEffect(() => {
    const fetchAndSyncProfile = async () => {
      if (!firebaseUser?.uid) return;
      
      // If no cached profile or photoURL missing, fetch from Firestore
      if (!userProfile?.photoURL) {
        try {
          const firestoreProfile = await fetchProfile(firebaseUser.uid);
          if (firestoreProfile.photoURL) {
            setPhotoURL(firestoreProfile.photoURL);
          }
          if (firestoreProfile.displayName) {
            setDisplayName(firestoreProfile.displayName);
          }
          if (firestoreProfile.isAdmin !== undefined) {
            setIsAdmin(firestoreProfile.isAdmin);
          }
        } catch (error) {
          console.warn('[useProfileBasics] Failed to fetch profile from Firestore:', error);
        }
      }
    };
    
    fetchAndSyncProfile();
  }, [firebaseUser?.uid, userProfile?.photoURL]);

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
    if (!firebaseUser) return;
    
    try {
      setLoading(true);
      await saveProfile(firebaseUser.uid, { displayName, photoURL });
      
      // Sync to Zustand store for persistence
      updateUserProfile({ displayName, photoURL: photoURL || undefined });
      
      setEditing(false);
      Alert.alert("הצלחה", "הפרופיל עודכן");
    } catch (e: any) {
      Alert.alert("שגיאה", "לא ניתן לעדכן פרופיל: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Clear Zustand store on logout
    useUserStore.getState().clearUser();
    await signOut(auth);
  };

  const handleImageUpload = async (uri: string) => {
    if (!firebaseUser) return;
    
    try {
      setLoading(true);
      const currentPhotoURL = photoURL;
      const downloadURL = await uploadImage(firebaseUser.uid, uri);
      
      // Update local state
      setPhotoURL(downloadURL);
      
      // Sync to Zustand store for persistence across app restarts
      updateUserProfile({ photoURL: downloadURL });
      
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
    userId: firebaseUser?.uid || "",
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
