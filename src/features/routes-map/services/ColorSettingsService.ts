// Service for managing custom color settings stored in Firestore
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
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

// Cache for hidden predefined colors
let hiddenColorsCache: Set<string> = new Set();

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
    
    // Load hidden colors
    try {
      const hiddenDoc = await getDoc(doc(db, 'appSettings', 'hiddenColors'));
      if (hiddenDoc.exists()) {
        const data = hiddenDoc.data();
        if (Array.isArray(data.colors)) {
          hiddenColorsCache = new Set(data.colors.map((c: string) => c.toUpperCase()));
        }
      }
    } catch (e) {
      console.warn('Error loading hidden colors:', e);
    }
    
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

/**
 * Reverse lookup: given a display hex (or original key), resolve back to the original key.
 * This is needed because ColorPickerScreen writes the display hex to route.color,
 * but getVisibleColors() returns original keys.
 * 
 * Example: if original key is #FFFF00 and display hex is #FFD700,
 *   resolveOriginalColorKey('#FFD700') → '#FFFF00'
 *   resolveOriginalColorKey('#FFFF00') → '#FFFF00'  (already a key)
 */
export function resolveOriginalColorKey(hex: string): string {
  const normalizedHex = hex.toUpperCase();
  
  // 1. If it's already a known key in the cache, return as-is
  if (colorSettingsCache.has(normalizedHex)) {
    return normalizedHex;
  }
  
  // 2. Reverse lookup: find a setting whose display hex matches
  for (const [key, setting] of colorSettingsCache.entries()) {
    if (setting.hex.toUpperCase() === normalizedHex) {
      return key; // return the original key
    }
  }
  
  // 3. Not found in settings at all — return as-is
  return hex;
}

/**
 * Delete a color setting from Firestore and cache
 * @param hex - The hex color code to delete
 */
export async function deleteColorSetting(hex: string): Promise<void> {
  const normalizedHex = hex.toUpperCase();
  try {
    const docRef = doc(db, 'colorSettings', normalizedHex);
    await deleteDoc(docRef);
    colorSettingsCache.delete(normalizedHex);
  } catch (error) {
    console.error('Error deleting color setting:', error);
    throw error;
  }
}

/**
 * Save a new custom color (not from predefined list)
 * @param setting - The color setting to save
 */
export async function addCustomColor(
  setting: Omit<CustomColorSetting, 'updatedAt'>
): Promise<void> {
  const normalizedHex = setting.hex.toUpperCase();
  const fullSetting: CustomColorSetting = {
    ...setting,
    hex: normalizedHex,
    updatedAt: new Date(),
  };

  try {
    const docRef = doc(db, 'colorSettings', normalizedHex);
    await setDoc(docRef, fullSetting);
    colorSettingsCache.set(normalizedHex, fullSetting);
  } catch (error) {
    console.error('Error adding custom color:', error);
    throw error;
  }
}

/**
 * Get the list of custom (non-predefined) colors from cache
 */
export function getCustomColors(): CustomColorSetting[] {
  const customs: CustomColorSetting[] = [];
  colorSettingsCache.forEach((setting, key) => {
    if (setting.originalHex === undefined || setting.originalHex === null) {
      customs.push(setting);
    }
  });
  return customs;
}

/**
 * Invalidate the cache so it reloads on next init
 */
export function invalidateColorSettingsCache(): void {
  cacheInitialized = false;
}

/**
 * Hide a predefined color so it no longer appears in the color list
 */
export async function hidePredefinedColor(hex: string): Promise<void> {
  const normalizedHex = hex.toUpperCase();
  hiddenColorsCache.add(normalizedHex);
  try {
    const docRef = doc(db, 'appSettings', 'hiddenColors');
    await setDoc(docRef, { colors: Array.from(hiddenColorsCache) }, { merge: true });
  } catch (error) {
    hiddenColorsCache.delete(normalizedHex);
    console.error('Error hiding color:', error);
    throw error;
  }
}

/**
 * Unhide a predefined color
 */
export async function unhidePredefinedColor(hex: string): Promise<void> {
  const normalizedHex = hex.toUpperCase();
  hiddenColorsCache.delete(normalizedHex);
  try {
    const docRef = doc(db, 'appSettings', 'hiddenColors');
    await setDoc(docRef, { colors: Array.from(hiddenColorsCache) }, { merge: true });
  } catch (error) {
    hiddenColorsCache.add(normalizedHex);
    console.error('Error unhiding color:', error);
    throw error;
  }
}

/**
 * Get the set of hidden predefined color hex codes
 */
export function getHiddenColors(): Set<string> {
  return new Set(hiddenColorsCache);
}
