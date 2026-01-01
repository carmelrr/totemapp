import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { auth } from "@/features/data/firebase";
import { savePrivacySettings as savePrivacySettingsService, fetchProfile } from "../services/profileService";
import type { PrivacySettings } from "../types";

const defaultPrivacySettings: PrivacySettings = {
  showTotalRoutes: true,
  showHighestGrade: true,
  showFeedbackCount: true,
  showAverageRating: true,
  showGradeStats: true,
  showJoinDate: true,
  showHistory: true,
};

export function useProfilePrivacy() {
  const user = auth.currentUser;
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(defaultPrivacySettings);
  const [isEditingPrivacy, setIsEditingPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load privacy settings from Firestore on mount
  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchProfile(user.uid);
        if (profile.privacySettings) {
          // Merge with defaults to ensure all keys exist
          setPrivacySettings({
            ...defaultPrivacySettings,
            ...profile.privacySettings,
          });
        }
      } catch (error) {
        console.warn("Failed to load privacy settings:", error);
        // Keep defaults on error
      } finally {
        setIsLoading(false);
      }
    };

    loadPrivacySettings();
  }, [user?.uid]);

  const savePrivacySettings = async (newSettings: PrivacySettings) => {
    if (!user) return;
    
    try {
      await savePrivacySettingsService(user.uid, newSettings);
      setPrivacySettings(newSettings);
    } catch (error) {
      console.error("Error saving privacy settings:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור הגדרות פרטיות");
    }
  };

  const updatePrivacySetting = (key: keyof PrivacySettings, value: boolean) => {
    const newSettings = { ...privacySettings, [key]: value };
    savePrivacySettings(newSettings);
  };

  return {
    privacySettings,
    isEditingPrivacy,
    isLoading,
    setPrivacySettings,
    setIsEditingPrivacy,
    savePrivacySettings,
    updatePrivacySetting,
  };
}
