import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ThemeContextType {
  isDarkMode: boolean;
  theme: any;
  toggleTheme: () => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// Light theme colors - Totem Brand
export const lightTheme = {
  isDark: false,
  primary: "#231F20",       // Charcoal (from logo)
  secondary: "#667eea",     // Blue-purple accent
  accent: "#1abc9c",        // Teal accent
  background: "#F6F7F9",    // Light gray
  surface: "#ffffff",
  text: "#111827",          // Near black
  textSecondary: "#6B7280", // Gray
  border: "#E5E7EB",        // Light border
  success: "#27ae60",       // Keep green
  warning: "#f39c12",       // Keep orange
  error: "#e74c3c",         // Keep red
  starColor: "#FFD700",     // Keep gold
  shadow: "#000000",
  overlay: "rgba(0,0,0,0.5)",
  card: "#f8f9fa",
  inputBackground: "#f8f9fa",
  headerGradient: "#111827", // Dark header
  tabBackground: "#f8f9fa",
  activeTab: "#231F20",      // Charcoal active
  modalBackground: "#ffffff",
  buttonPrimary: "#1abc9c",  // Teal
  buttonSecondary: "#667eea",// Blue-purple
  buttonTertiary: "#f1c40f",
  mapBackground: "#fdfdfd",
};

// Dark theme colors - Totem Brand
export const darkTheme = {
  isDark: true,
  primary: "#0f766e",       // Darker teal (same as buttonPrimary for consistency)
  secondary: "#4c5fd5",     // Darker blue-purple accent (was #667eea)
  accent: "#0d9488",        // Darker teal accent (was #1abc9c)
  background: "#0B0B0F",    // Brand dark
  surface: "#111827",       // Slightly lighter
  text: "#ffffff",
  textSecondary: "#9CA3AF", // Medium gray
  border: "#374151",        // Dark border
  success: "#4caf50",       // Keep green
  warning: "#ff9800",       // Keep orange
  error: "#f44336",         // Keep red
  starColor: "#FFD700",     // Keep gold
  shadow: "#000000",
  overlay: "rgba(0,0,0,0.8)",
  card: "#1F2937",          // Card background
  inputBackground: "#1F2937",
  headerGradient: "#0B0B0F", // Brand dark
  tabBackground: "#111827",
  activeTab: "#0f766e",      // Even darker teal active
  modalBackground: "#111827",
  buttonPrimary: "#0f766e",  // Darker teal for buttons
  buttonSecondary: "#4338ca",// Darker indigo for buttons
  buttonTertiary: "#ffa726",
  mapBackground: "#0B0B0F",
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference from storage
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem("theme_preference");
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === "dark");
      }
    } catch (error) {
      console.error("Error loading theme preference:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem(
        "theme_preference",
        newTheme ? "dark" : "light",
      );
    } catch (error) {
      console.error("Error saving theme preference:", error);
    }
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  const value = {
    isDarkMode,
    theme,
    toggleTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
