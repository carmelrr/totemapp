import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { en, he, TranslationKeys } from "./translations";

// Supported languages
export type Language = "he" | "en";

// Context type
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: TranslationKeys;
  isRTL: boolean;
  isLoading: boolean;
}

// Storage key
const LANGUAGE_STORAGE_KEY = "app_language";

// Translations map
const translations: Record<Language, TranslationKeys> = {
  en,
  he,
};

// Create context
const LanguageContext = createContext<LanguageContextType | null>(null);

// Hook to use language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

// Provider props
interface LanguageProviderProps {
  children: ReactNode;
}

// Provider component
export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // Default to Hebrew as the app was originally in Hebrew
  const [language, setLanguageState] = useState<Language>("he");
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language preference on mount
  useEffect(() => {
    loadLanguagePreference();
  }, []);

  const loadLanguagePreference = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && (savedLanguage === "he" || savedLanguage === "en")) {
        setLanguageState(savedLanguage as Language);
      }
    } catch (error) {
      console.error("Error loading language preference:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);

      // Sync RTL with the chosen language
      const shouldBeRTL = lang === 'he';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
        // I18nManager change requires an app reload to take full effect.
        // Expo handles this automatically on next restart; in dev you can
        // call `Updates.reloadAsync()` or prompt the user.
      }
    } catch (error) {
      console.error("Error saving language preference:", error);
      throw error;
    }
  }, []);

  // Get current translations
  const t = translations[language];
  const isRTL = language === "he";

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    isRTL,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
