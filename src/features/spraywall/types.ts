// src/features/spraywall/types.ts
// Types for Spray Wall feature

export interface Vec2 {
  x: number;
  y: number;
}

// Hold types with their colors
export type HoldType = 'start' | 'middle' | 'feet';

export const HOLD_TYPES: Record<HoldType, { label: string; color: string }> = {
  start: { label: 'התחלה/טופ', color: '#FF4444' },  // Red
  middle: { label: 'ביניים', color: '#4488FF' },     // Blue
  feet: { label: 'רגליים', color: '#FFCC00' },       // Yellow
};

export interface Hold {
  id: string;
  x: number;      // מרכז הטבעת כערך יחסי מ-0 עד 1 לפי רוחב התמונה
  y: number;      // מרכז כערך יחסי מ-0 עד 1 לפי גובה התמונה
  radius: number; // רדיוס כערך יחסי (ביחס לרוחב התמונה)
  type: HoldType; // סוג האחיזה
  color: string;  // צבע הטבעת (נגזר מה-type)
}

// מספור אחיזות - רשומה של אחיזה ממוספרת
export interface HoldNumberEntry {
  holdId: string;  // מזהה האחיזה
  number: number;  // מספר סידורי
}

// נתיב מסיכה שחור להסתרת אחיזות מפריעות
export interface MaskPath {
  points: Vec2[];       // נקודות הנתיב בקואורדינטות 0-1
  strokeWidth: number;  // רוחב הקו יחסית לרוחב התמונה
}

export interface SprayRouteFeedback {
  id?: string;
  routeId: string;
  userId: string;
  userDisplayName: string;
  starRating: number;       // 1-5
  suggestedGrade: string;   // הדירוג שהמשתמש מציע
  comment: string;
  videoUrl?: string;        // לינק לסרטון בטא
  createdAt?: any;
  updatedAt?: any;
}

export interface SprayRoute {
  id?: string;
  wallId: string;
  name: string;
  grade: string;                  // הדירוג המקורי של היוצר
  holds: Hold[];
  holdNumbering?: HoldNumberEntry[];  // מספור אחיזות (אופציונלי)
  maskPaths?: MaskPath[];             // נתיבי מסיכה שחורים (אופציונלי)
  createdAt?: any;
  createdBy?: string | null;
  creatorName?: string;           // שם היוצר
  
  // Statistics - calculated from feedbacks
  averageStarRating?: number;     // ממוצע כוכבים מהקהילה
  calculatedGrade?: string;       // דירוג ממוצע מהקהילה
  feedbackCount?: number;         // מספר פידבקים
  topsCount?: number;             // מספר משתמשים שסגרו
  color?: string;                 // צבע לתצוגה
}

export interface Wall {
  id?: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  isPublic: boolean;
  createdAt?: any;
  createdBy?: string | null;
}

export interface WallWithRoutes extends Wall {
  routes: SprayRoute[];
}
