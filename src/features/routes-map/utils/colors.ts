// Predefined route colors
export const ROUTE_COLORS = [
  '#D2691E', // עץ (חום-כתום עץ)
  '#E8E8E8', // שקוף (אפור בהיר מאוד)
  '#000000', // שחור
  '#C0C0C0', // אפור בהיר
  '#87CEEB', // כחול בהיר
  '#00008B', // כחול כהה
  '#00CED1', // תכלת
  '#00FF00', // ירוק
  '#006400', // ירוק כהה
  '#FF0000', // אדום
  '#8B4513', // חום
  '#FFA500', // כתום
  '#FFFF00', // צהוב
  '#800080', // סגול
  '#FFC0CB', // ורוד
  '#FFFFFF', // לבן
] as const;

// Color names in Hebrew for display
export const COLOR_NAMES: Record<string, string> = {
  '#D2691E': 'עץ',
  '#E8E8E8': 'שקוף',
  '#000000': 'שחור',
  '#C0C0C0': 'אפור בהיר',
  '#87CEEB': 'כחול בהיר',
  '#00008B': 'כחול כהה',
  '#00CED1': 'תכלת',
  '#00FF00': 'ירוק',
  '#006400': 'ירוק כהה',
  '#FF0000': 'אדום',
  '#8B4513': 'חום',
  '#FFA500': 'כתום',
  '#FFFF00': 'צהוב',
  '#800080': 'סגול',
  '#FFC0CB': 'ורוד',
  '#FFFFFF': 'לבן',
};

export type RouteColor = typeof ROUTE_COLORS[number];

export function getRandomRouteColor(): RouteColor {
  return ROUTE_COLORS[Math.floor(Math.random() * ROUTE_COLORS.length)];
}

export function isValidRouteColor(color: string): color is RouteColor {
  return ROUTE_COLORS.includes(color as RouteColor);
}

export function getColorName(color: string): string {
  return COLOR_NAMES[color.toLowerCase()] || COLOR_NAMES[color] || 'מותאם אישית';
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
