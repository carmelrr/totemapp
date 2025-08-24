// Coordinate normalization utilities
// פונקציות לעבודה עם קורדינטות מנורמלות

export interface NormalizedCoordinate {
  xNorm: number;
  yNorm: number;
}

export interface PixelCoordinate {
  x: number;
  y: number;
}

export interface ViewBox {
  width: number;
  height: number;
}

// ✅ מידות קבועות של ה-ViewBox - עדכן לפי המטרה שלך
export const DEFAULT_VIEWBOX: ViewBox = {
  width: 2560,
  height: 1600,
};

/**
 * המר מקורדינטות פיקסלים לנורמליזציה (0-1)
 */
export function toNorm(
  pixelCoord: PixelCoordinate, 
  viewBox: ViewBox = DEFAULT_VIEWBOX
): NormalizedCoordinate {
  return {
    xNorm: Math.min(Math.max(pixelCoord.x / viewBox.width, 0), 1),
    yNorm: Math.min(Math.max(pixelCoord.y / viewBox.height, 0), 1),
  };
}

/**
 * המר מקורדינטות נורמליזציה (0-1) לפיקסלים
 */
export function toPixel(
  normCoord: NormalizedCoordinate, 
  viewBox: ViewBox = DEFAULT_VIEWBOX
): PixelCoordinate {
  return {
    x: Math.round(normCoord.xNorm * viewBox.width),
    y: Math.round(normCoord.yNorm * viewBox.height),
  };
}

/**
 * וודא שקורדינטות נורמליזציה תקינות (0-1)
 */
export function validateNormCoordinates(coord: NormalizedCoordinate): boolean {
  return (
    Number.isFinite(coord.xNorm) &&
    Number.isFinite(coord.yNorm) &&
    coord.xNorm >= 0 &&
    coord.xNorm <= 1 &&
    coord.yNorm >= 0 &&
    coord.yNorm <= 1
  );
}

/**
 * תקן קורדינטות נורמליזציה לטווח התקין (0-1)
 */
export function clampNormCoordinates(coord: NormalizedCoordinate): NormalizedCoordinate {
  return {
    xNorm: Math.min(Math.max(coord.xNorm || 0, 0), 1),
    yNorm: Math.min(Math.max(coord.yNorm || 0, 0), 1),
  };
}

/**
 * המר קורדינטות legacy (x/y) לנורמליזציה
 */
export function migrateLegacyCoordinates(
  legacyData: { x?: number; y?: number; xNorm?: number; yNorm?: number },
  viewBox: ViewBox = DEFAULT_VIEWBOX
): NormalizedCoordinate {
  // אם יש כבר נורמליזציה תקינה - השתמש בה
  if (
    Number.isFinite(legacyData.xNorm) &&
    Number.isFinite(legacyData.yNorm) &&
    legacyData.xNorm >= 0 &&
    legacyData.xNorm <= 1 &&
    legacyData.yNorm >= 0 &&
    legacyData.yNorm <= 1
  ) {
    return {
      xNorm: legacyData.xNorm,
      yNorm: legacyData.yNorm,
    };
  }

  // אחרת נסה להמיר מ-x/y
  if (Number.isFinite(legacyData.x) && Number.isFinite(legacyData.y)) {
    return toNorm({ x: legacyData.x!, y: legacyData.y! }, viewBox);
  }

  // ברירת מחדל - קורדינטה למרכז
  console.warn('Invalid coordinates provided, using center position', legacyData);
  return { xNorm: 0.5, yNorm: 0.5 };
}
