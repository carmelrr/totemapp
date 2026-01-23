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

// Validate hex color format
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
