import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Light theme colors
export const lightTheme = {
  primary: '#667eea',
  secondary: '#9b59b6',
  accent: '#f39c12',
  background: '#f0f2f5',
  surface: '#ffffff',
  text: '#2c3e50',
  textSecondary: '#7f8c8d',
  border: '#e0e0e0',
  success: '#27ae60',
  warning: '#f39c12',
  error: '#e74c3c',
  starColor: '#FFD700',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  card: '#f8f9fa',
  inputBackground: '#f8f9fa',
  headerGradient: '#667eea',
  tabBackground: '#f8f9fa',
  activeTab: '#667eea',
  modalBackground: '#ffffff',
  buttonPrimary: '#1abc9c',
  buttonSecondary: '#9b59b6',
  buttonTertiary: '#f1c40f',
  mapBackground: '#fdfdfd',
};

// Dark theme colors
export const darkTheme = {
  primary: '#667eea',
  secondary: '#bb86fc',
  accent: '#ffa726',
  background: '#121212',
  surface: '#1e1e1e',
  text: '#ffffff',
  textSecondary: '#b3b3b3',
  border: '#333333',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  starColor: '#FFD700',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.8)',
  card: '#2d2d2d',
  inputBackground: '#333333',
  headerGradient: '#2d2d2d',
  tabBackground: '#333333',
  activeTab: '#667eea',
  modalBackground: '#1e1e1e',
  buttonPrimary: '#26a69a',
  buttonSecondary: '#bb86fc',
  buttonTertiary: '#ffa726',
  mapBackground: '#1e1e1e',
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
      const savedTheme = await AsyncStorage.getItem('theme_preference');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('theme_preference', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
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
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
