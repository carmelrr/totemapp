// src/context/DefaultAvatarContext.tsx
// Context for managing the default avatar image that admins can set

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/features/data/firebase';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface DefaultAvatarContextType {
  defaultAvatarUrl: string | null;
  loading: boolean;
  uploadDefaultAvatar: () => Promise<void>;
  removeDefaultAvatar: () => Promise<void>;
}

const DefaultAvatarContext = createContext<DefaultAvatarContextType>({
  defaultAvatarUrl: null,
  loading: true,
  uploadDefaultAvatar: async () => {},
  removeDefaultAvatar: async () => {},
});

export const useDefaultAvatar = () => useContext(DefaultAvatarContext);

interface DefaultAvatarProviderProps {
  children: ReactNode;
}

// Firestore document path for app settings
const SETTINGS_DOC = 'settings/app';

export function DefaultAvatarProvider({ children }: DefaultAvatarProviderProps) {
  const [defaultAvatarUrl, setDefaultAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to changes in the default avatar setting
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, SETTINGS_DOC),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setDefaultAvatarUrl(data?.defaultAvatarUrl || null);
        } else {
          setDefaultAvatarUrl(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to default avatar:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Upload a new default avatar (admin only)
  const uploadDefaultAvatar = async () => {
    try {
      // Request permissions
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('אין הרשאה', 'יש לאשר גישה לגלריה כדי לבחור תמונה');
          return;
        }
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const uri = result.assets[0].uri;

      // Upload to Firebase Storage
      const fileName = `default_avatar_${Date.now()}.jpg`;
      const imageRef = ref(storage, `app/default_avatar/${fileName}`);

      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload
      await uploadBytes(imageRef, blob);

      // Get download URL
      const downloadUrl = await getDownloadURL(imageRef);

      // Delete old avatar if exists
      if (defaultAvatarUrl) {
        try {
          // Extract path from URL and delete
          const oldRef = ref(storage, defaultAvatarUrl);
          await deleteObject(oldRef);
        } catch (e) {
          // Ignore errors when deleting old avatar
          console.log('Could not delete old default avatar:', e);
        }
      }

      // Save URL to Firestore
      await setDoc(
        doc(db, SETTINGS_DOC),
        { defaultAvatarUrl: downloadUrl },
        { merge: true }
      );

      Alert.alert('הצלחה', 'תמונת ברירת המחדל עודכנה בהצלחה');
    } catch (error) {
      console.error('Error uploading default avatar:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בהעלאת התמונה');
    }
  };

  // Remove the default avatar (admin only)
  const removeDefaultAvatar = async () => {
    try {
      if (defaultAvatarUrl) {
        // Delete from storage
        try {
          const imageRef = ref(storage, defaultAvatarUrl);
          await deleteObject(imageRef);
        } catch (e) {
          console.log('Could not delete default avatar from storage:', e);
        }
      }

      // Remove from Firestore
      await setDoc(
        doc(db, SETTINGS_DOC),
        { defaultAvatarUrl: null },
        { merge: true }
      );

      Alert.alert('הצלחה', 'תמונת ברירת המחדל הוסרה');
    } catch (error) {
      console.error('Error removing default avatar:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בהסרת התמונה');
    }
  };

  return (
    <DefaultAvatarContext.Provider
      value={{
        defaultAvatarUrl,
        loading,
        uploadDefaultAvatar,
        removeDefaultAvatar,
      }}
    >
      {children}
    </DefaultAvatarContext.Provider>
  );
}
