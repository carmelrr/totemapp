// constants/colors.ts
export const HOLD_COLORS = {
  start: "#22C55E", // ירוק
  finish: "#EF4444", // אדום
  hand: "#FFFFFF", // לבן
  foot: "#3B82F6", // כחול
  any: "#FDE047", // צהוב
} as const;

export const ROUTE_COLORS = [
  "#22C55E", // ירוק
  "#EF4444", // אדום
  "#3B82F6", // כחול
  "#F59E0B", // כתום
  "#8B5CF6", // סגול
  "#EC4899", // ורוד
  "#10B981", // תכלת
  "#F97316", // כתום כהה
] as const;

// קבוע מיפוי צבעים - יחיד לכל האפליקציה
export const COLOR_MAPPING: Record<string, string> = {
  // צבעים בעברית לקודי HEX
  'אדום': '#FF0000',
  'כחול': '#0000FF', 
  'ירוק': '#00FF00',
  'צהוב': '#FFFF00',
  'שחור': '#000000',
  'לבן': '#FFFFFF',
  'סגול': '#800080',
  'כתום': '#FFA500',
  'ורוד': '#FFC0CB',
  'אפור': '#808080',
  'חום': '#A52A2A',
  'ציאן': '#00FFFF',
  'מגנטה': '#FF00FF',
  'זהב': '#FFD700',
  'כסף': '#C0C0C0',
  'ברונזה': '#CD7F32',
  
  // צבעים באנגלית לנוחות
  'red': '#FF0000',
  'blue': '#0000FF',
  'green': '#00FF00', 
  'yellow': '#FFFF00',
  'black': '#000000',
  'white': '#FFFFFF',
  'purple': '#800080',
  'orange': '#FFA500',
  'pink': '#FFC0CB',
  'gray': '#808080',
  'brown': '#A52A2A',
  'cyan': '#00FFFF',
  'magenta': '#FF00FF',
  'gold': '#FFD700',
  'silver': '#C0C0C0',
  'bronze': '#CD7F32',
};

// פונקציות עזר לחישובי צבע
export const getColorHex = (colorName: string): string => {
  return COLOR_MAPPING[colorName] || COLOR_MAPPING[colorName.toLowerCase()] || '#808080';
};

export const getContrastTextColor = (hexColor: string): string => {
  // המר HEX ל-RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // חישוב בהירות יחסית
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // החזר צבע טקסט מתאים
  return brightness > 150 ? '#000000' : '#ffffff';
};

// סוגי דרגות קושי עם מידע נוסף
export const GRADE_INFO: Record<string, { difficulty: number; color: string }> = {
  'V0': { difficulty: 0, color: '#4CAF50' },
  'V1': { difficulty: 1, color: '#8BC34A' },
  'V2': { difficulty: 2, color: '#CDDC39' },
  'V3': { difficulty: 3, color: '#FFEB3B' },
  'V4': { difficulty: 4, color: '#FFC107' },
  'V5': { difficulty: 5, color: '#FF9800' },
  'V6': { difficulty: 6, color: '#FF5722' },
  'V7': { difficulty: 7, color: '#F44336' },
  'V8': { difficulty: 8, color: '#E91E63' },
  'V9': { difficulty: 9, color: '#9C27B0' },
  'V10': { difficulty: 10, color: '#673AB7' },
  'V11': { difficulty: 11, color: '#3F51B5' },
  'V12': { difficulty: 12, color: '#2196F3' },
  'V13': { difficulty: 13, color: '#03A9F4' },
  'V14': { difficulty: 14, color: '#00BCD4' },
  'V15': { difficulty: 15, color: '#009688' },
};

export const getGradeColor = (grade: string): string => {
  return GRADE_INFO[grade]?.color || '#808080';
};

export const getGradeDifficulty = (grade: string): number => {
  return GRADE_INFO[grade]?.difficulty || 0;
};

export const THEME_COLORS = {
  primary: "#007AFF",
  secondary: "#5856D6",
  background: "#F2F2F7",
  surface: "#FFFFFF",
  text: "#000000",
  textSecondary: "#6D6D80",
  border: "#C7C7CC",
  shadow: "#000000",
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
} as const;
