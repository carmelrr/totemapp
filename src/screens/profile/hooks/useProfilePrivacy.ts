import { useState } from "react";
import { Alert } from "react-native";
import { auth } from "@/features/data/firebase";
import { savePrivacySettings as savePrivacySettingsService } from "../services/profileService";
import type { PrivacySettings } from "../types";

export function useProfilePrivacy() {
  const user = auth.currentUser;
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    showTotalRoutes: true,
    showHighestGrade: true,
    showFeedbackCount: true,
    showAverageRating: true,
    showGradeStats: true,
    showJoinDate: true,
  });
  const [isEditingPrivacy, setIsEditingPrivacy] = useState(false);

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
    setPrivacySettings,
    setIsEditingPrivacy,
    savePrivacySettings,
    updatePrivacySetting,
  };
}
