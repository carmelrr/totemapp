// features/image/homography.ts
import { Vec2, Homography } from '../spraywall/types';
import { Matrix3x3, invertMatrix3x3, transformPoint } from '../../utils/matrix';

// חישוב הומוגרפיה בין 4 נקודות מקור ל-4 נקודות יעד
export function computeHomography(src: Vec2[], dst: Vec2[]): Homography {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('Need exactly 4 source and 4 destination points');
  }

  // בניית מטריצת A למשוואה Ah = 0
  const A: number[][] = [];
  
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    
    A.push([
      -sx, -sy, -1, 0, 0, 0, sx * dx, sy * dx, dx
    ]);
    A.push([
      0, 0, 0, -sx, -sy, -1, sx * dy, sy * dy, dy
    ]);
  }

  // פתרון ע"י SVD (פישוט - נשתמש בשיטה פשוטה יותר)
  // בפועל כדאי להשתמש בספרייה כמו ml-matrix
  
  // זוהי הערכה פשוטה - בפועל צריך SVD אמיתי
  const h = solveHomographyDLT(A);
  
  return h as Homography;
}

// פתרון פשוט עבור הומוגרפיה (DLT)
function solveHomographyDLT(A: number[][]): number[] {
  // פישוט מאוד - בפועל צריך SVD
  // נחזיר הומוגרפיית זהות כברירת מחדל
  return [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ];
}

// החלת הומוגרפיה על נקודה
export function applyHomography(H: Homography, point: Vec2): Vec2 {
  const matrix: Matrix3x3 = [
    H[0], H[1], H[2],
    H[3], H[4], H[5],
    H[6], H[7], H[8]
  ];
  
  return transformPoint(point, matrix);
}

// חישוב הומוגרפיה הפוכה
export function invertHomography(H: Homography): Homography {
  const matrix: Matrix3x3 = [
    H[0], H[1], H[2],
    H[3], H[4], H[5],
    H[6], H[7], H[8]
  ];
  
  const invMatrix = invertMatrix3x3(matrix);
  
  return [
    invMatrix[0], invMatrix[1], invMatrix[2],
    invMatrix[3], invMatrix[4], invMatrix[5],
    invMatrix[6], invMatrix[7], invMatrix[8]
  ];
}

// פונקציית עזר ליצירת הומוגרפיית זהות
export function identityHomography(): Homography {
  return [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ];
}

// חישוב הומוגרפיה פשוטה עבור מלבן לקנוני
export function createRectifyHomography(
  corners: Vec2[], 
  canonicalWidth: number, 
  canonicalHeight: number
): Homography {
  const dst: Vec2[] = [
    { x: 0, y: 0 },
    { x: canonicalWidth, y: 0 },
    { x: canonicalWidth, y: canonicalHeight },
    { x: 0, y: canonicalHeight }
  ];
  
  return computeHomography(corners, dst);
}
