// Predefined route colors
export const ROUTE_COLORS = [
  '#D2691E', // wood
  '#E8E8E8', // transparent
  '#000000', // black
  '#C0C0C0', // light gray
  '#87CEEB', // light blue
  '#00008B', // dark blue
  '#00CED1', // cyan
  '#00FF00', // green
  '#006400', // dark green
  '#FF0000', // red
  '#8B4513', // brown
  '#FFA500', // orange
  '#FFFF00', // yellow
  '#800080', // purple
  '#FFC0CB', // pink
  '#FFFFFF', // white
] as const;

import { getHiddenColors, getCustomColors, getColorSettingSync } from '@/features/routes-map/services/ColorSettingsService';

/**
 * Get the list of visible colors (predefined minus hidden + custom).
 * Call this instead of using ROUTE_COLORS directly when displaying a color list.
 */
export function getVisibleColors(): string[] {
  const hidden = getHiddenColors();
  const visiblePredefined = ROUTE_COLORS.filter(c => !hidden.has(c.toUpperCase()));
  const customs = getCustomColors().map(c => c.hex);
  return [...visiblePredefined, ...customs];
}

// Color key to translation key mapping
export const COLOR_TRANSLATION_KEYS: Record<string, string> = {
  '#D2691E': 'wood',
  '#E8E8E8': 'transparent',
  '#000000': 'black',
  '#C0C0C0': 'lightGray',
  '#87CEEB': 'lightBlue',
  '#00008B': 'darkBlue',
  '#00CED1': 'cyan',
  '#00FF00': 'green',
  '#006400': 'darkGreen',
  '#FF0000': 'red',
  '#8B4513': 'brown',
  '#FFA500': 'orange',
  '#FFFF00': 'yellow',
  '#800080': 'purple',
  '#FFC0CB': 'pink',
  '#FFFFFF': 'white',
};

export type RouteColor = typeof ROUTE_COLORS[number];

export function getRandomRouteColor(): RouteColor {
  return ROUTE_COLORS[Math.floor(Math.random() * ROUTE_COLORS.length)];
}

export function isValidRouteColor(color: string): color is RouteColor {
  return ROUTE_COLORS.includes(color as RouteColor);
}

// Get color translation key for use with t.colors[key]
export function getColorTranslationKey(color: string): string {
  const upperColor = color.toUpperCase();
  // Check both uppercase and original case
  return COLOR_TRANSLATION_KEYS[upperColor] || COLOR_TRANSLATION_KEYS[color] || 'custom';
}

export function getContrastTextColor(backgroundColor: string): string {
  // Simple contrast calculation - for production might want a more sophisticated version
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Get the display name for a route based on the current language.
 * Checks: nameHe/nameEn fields → custom color name from settings → translation-based color+grade → route.name fallback
 */
export function getRouteDisplayName(
  route: { name: string; nameHe?: string; nameEn?: string; color?: string; grade?: string; calculatedGrade?: string | null },
  language: 'he' | 'en',
  translations?: any
): string {
  // 1. If the route has explicit bilingual names, use the correct one
  if (language === 'en' && route.nameEn) return route.nameEn;
  if (language === 'he' && route.nameHe) return route.nameHe;

  // Use community grade (includes builder's vote) or fall back to original grade
  const displayGrade = route.calculatedGrade || route.grade;

  // 2. Try to get custom color name from ColorSettingsService
  if (route.color && displayGrade) {
    const setting = getColorSettingSync(route.color);
    if (setting) {
      const colorName = language === 'he' ? setting.nameHe : setting.nameEn;
      if (colorName) return `${colorName} ${displayGrade}`;
    }
  }

  // 3. Try to build name from static color translation + grade
  if (route.color && displayGrade && translations?.colors) {
    const colorKey = getColorTranslationKey(route.color);
    if (colorKey !== 'custom') {
      const colorName = translations.colors[colorKey as keyof typeof translations.colors];
      if (colorName) return `${colorName} ${displayGrade}`;
    }
  }

  // 4. Fallback to stored name
  return route.name;
}

// Validate hex color format
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Parse a hex color string to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substr(0, 2), 16),
    g: parseInt(clean.substr(2, 2), 16),
    b: parseInt(clean.substr(4, 2), 16),
  };
}

/**
 * Calculate the Euclidean distance between two colors in RGB space.
 */
function colorDistance(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2
  );
}

/**
 * Find the closest color from the visible colors list to a given hex color.
 * Uses the display hex of each visible color for comparison.
 * Returns the display hex of the closest match.
 */
export function findClosestVisibleColor(hex: string): string {
  const { getColorDisplayHex } = require('@/features/routes-map/services/ColorSettingsService');
  const visibleKeys = getVisibleColors();
  
  if (visibleKeys.length === 0) return hex;

  let bestKey = visibleKeys[0];
  let bestDisplayHex = getColorDisplayHex(visibleKeys[0]);
  let bestDistance = colorDistance(hex, bestDisplayHex);

  for (let i = 1; i < visibleKeys.length; i++) {
    const displayHex = getColorDisplayHex(visibleKeys[i]);
    const dist = colorDistance(hex, displayHex);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestKey = visibleKeys[i];
      bestDisplayHex = displayHex;
    }
  }

  return bestDisplayHex;
}

/**
 * Find the closest color key from the visible colors list.
 * Returns both the original key and the display hex.
 */
export function findClosestVisibleColorWithKey(hex: string): { key: string; displayHex: string } {
  const { getColorDisplayHex } = require('@/features/routes-map/services/ColorSettingsService');
  const visibleKeys = getVisibleColors();
  
  if (visibleKeys.length === 0) return { key: hex, displayHex: hex };

  let bestKey = visibleKeys[0];
  let bestDisplayHex = getColorDisplayHex(visibleKeys[0]);
  let bestDistance = colorDistance(hex, bestDisplayHex);

  for (let i = 1; i < visibleKeys.length; i++) {
    const displayHex = getColorDisplayHex(visibleKeys[i]);
    const dist = colorDistance(hex, displayHex);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestKey = visibleKeys[i];
      bestDisplayHex = displayHex;
    }
  }

  return { key: bestKey, displayHex: bestDisplayHex };
}
