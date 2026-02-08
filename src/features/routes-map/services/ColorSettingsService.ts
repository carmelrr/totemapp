// Service for managing custom color settings stored in Firestore
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { db } from '@/features/data/firebase';

export interface CustomColorSetting {
  hex: string;           // The color hex code (e.g., '#FF0000')
  nameHe: string;        // Hebrew name
  nameEn: string;        // English name
  originalHex?: string;  // Original hex if this is a modification of a predefined color
  updatedAt: Date;
}

// Cache for color settings to avoid repeated Firestore reads
let colorSettingsCache: Map<string, CustomColorSetting> = new Map();
let cacheInitialized = false;

/**
 * Initialize the color settings cache by loading all settings from Firestore
 */
export async function initializeColorSettings(): Promise<void> {
  if (cacheInitialized) return;
  
  try {
    const colorSettingsRef = collection(db, 'colorSettings');
    const snapshot = await getDocs(colorSettingsRef);
    
    snapshot.forEach((doc) => {
      const data = doc.data() as CustomColorSetting;
      colorSettingsCache.set(doc.id, {
        ...data,
        updatedAt: data.updatedAt instanceof Date ? data.updatedAt : new Date(),
      });
    });
    
    cacheInitialized = true;
  } catch (error) {
    console.error('Error initializing color settings:', error);
  }
}

/**
 * Get custom color setting for a specific color
 * @param hex - The hex color code to look up
 * @returns The custom color setting if exists, null otherwise
 */
export async function getColorSetting(hex: string): Promise<CustomColorSetting | null> {
  const normalizedHex = hex.toUpperCase();
  
  // Check cache first
  if (colorSettingsCache.has(normalizedHex)) {
    return colorSettingsCache.get(normalizedHex) || null;
  }
  
  try {
    const docRef = doc(db, 'colorSettings', normalizedHex);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as CustomColorSetting;
      colorSettingsCache.set(normalizedHex, data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting color setting:', error);
    return null;
  }
}

/**
 * Get custom color setting synchronously from cache
 * @param hex - The hex color code to look up
 * @returns The custom color setting if in cache, null otherwise
 */
export function getColorSettingSync(hex: string): CustomColorSetting | null {
  const normalizedHex = hex.toUpperCase();
  return colorSettingsCache.get(normalizedHex) || null;
}

/**
 * Save or update a custom color setting
 * @param originalHex - The original hex code (used as document ID)
 * @param setting - The color setting to save
 */
export async function saveColorSetting(
  originalHex: string,
  setting: Omit<CustomColorSetting, 'updatedAt'>
): Promise<void> {
  const normalizedHex = originalHex.toUpperCase();
  
  const fullSetting: CustomColorSetting = {
    ...setting,
    hex: setting.hex.toUpperCase(),
    updatedAt: new Date(),
  };
  
  try {
    const docRef = doc(db, 'colorSettings', normalizedHex);
    await setDoc(docRef, fullSetting, { merge: true });
    
    // Update cache
    colorSettingsCache.set(normalizedHex, fullSetting);
  } catch (error) {
    console.error('Error saving color setting:', error);
    throw error;
  }
}

/**
 * Get all custom color settings
 * @returns Map of all custom color settings
 */
export function getAllColorSettings(): Map<string, CustomColorSetting> {
  return new Map(colorSettingsCache);
}

/**
 * Subscribe to color settings changes
 * @param callback - Function to call when settings change
 * @returns Unsubscribe function
 */
export function subscribeToColorSettings(
  callback: (settings: Map<string, CustomColorSetting>) => void
): () => void {
  console.log('🔍 [ColorSettingsService] Setting up listener for colorSettings');
  const colorSettingsRef = collection(db, 'colorSettings');
  
  const unsubscribe = onSnapshot(colorSettingsRef, (snapshot) => {
    console.log('✅ [ColorSettingsService] Got colorSettings snapshot, changes:', snapshot.docChanges().length);
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data() as CustomColorSetting;
      if (change.type === 'added' || change.type === 'modified') {
        colorSettingsCache.set(change.doc.id, data);
      } else if (change.type === 'removed') {
        colorSettingsCache.delete(change.doc.id);
      }
    });
    
    callback(new Map(colorSettingsCache));
  }, (err) => {
    console.error('❌ [ColorSettingsService] Firebase Error on colorSettings:', err.code, err.message);
  });
  
  return unsubscribe;
}

/**
 * Get the display name for a color based on language
 * @param hex - The hex color code
 * @param language - 'he' or 'en'
 * @param fallbackName - Fallback name if no custom setting exists
 * @returns The color name
 */
export function getColorDisplayName(
  hex: string,
  language: 'he' | 'en',
  fallbackName: string
): string {
  const setting = getColorSettingSync(hex.toUpperCase());
  
  if (setting) {
    return language === 'he' ? setting.nameHe : setting.nameEn;
  }
  
  return fallbackName;
}

/**
 * Get the actual display hex for a color (in case it was customized)
 * @param originalHex - The original hex code
 * @returns The current hex to display
 */
export function getColorDisplayHex(originalHex: string): string {
  const setting = getColorSettingSync(originalHex.toUpperCase());
  return setting?.hex || originalHex;
}
