// utils/matrix.ts
import { Vec2 } from '@/features/'spraywall/types';

// Transform יחיד לכל המסך
export function screenToCanonical(
  x: number, 
  y: number, 
  tx: number, 
  ty: number, 
  scale: number
): Vec2 {
  return { 
    x: (x - tx) / scale, 
    y: (y - ty) / scale 
  };
}

export function canonicalToScreen(
  x: number, 
  y: number, 
  tx: number, 
  ty: number, 
  scale: number
): Vec2 {
  return { 
    x: x * scale + tx, 
    y: y * scale + ty 
  };
}

// מטריצות 3x3 להומוגרפיה
export type Matrix3x3 = [
  number, number, number,
  number, number, number, 
  number, number, number
];

export function multiplyMatrix3x3(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
  return [
    a[0]*b[0] + a[1]*b[3] + a[2]*b[6], a[0]*b[1] + a[1]*b[4] + a[2]*b[7], a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
    a[3]*b[0] + a[4]*b[3] + a[5]*b[6], a[3]*b[1] + a[4]*b[4] + a[5]*b[7], a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
    a[6]*b[0] + a[7]*b[3] + a[8]*b[6], a[6]*b[1] + a[7]*b[4] + a[8]*b[7], a[6]*b[2] + a[7]*b[5] + a[8]*b[8]
  ];
}

export function invertMatrix3x3(m: Matrix3x3): Matrix3x3 {
  const det = m[0]*(m[4]*m[8] - m[5]*m[7]) - m[1]*(m[3]*m[8] - m[5]*m[6]) + m[2]*(m[3]*m[7] - m[4]*m[6]);
  
  if (Math.abs(det) < 1e-10) {
    throw new Error('Matrix is not invertible');
  }
  
  const invDet = 1 / det;
  
  return [
    (m[4]*m[8] - m[5]*m[7]) * invDet,
    (m[2]*m[7] - m[1]*m[8]) * invDet,
    (m[1]*m[5] - m[2]*m[4]) * invDet,
    (m[5]*m[6] - m[3]*m[8]) * invDet,
    (m[0]*m[8] - m[2]*m[6]) * invDet,
    (m[2]*m[3] - m[0]*m[5]) * invDet,
    (m[3]*m[7] - m[4]*m[6]) * invDet,
    (m[1]*m[6] - m[0]*m[7]) * invDet,
    (m[0]*m[4] - m[1]*m[3]) * invDet
  ];
}

export function transformPoint(point: Vec2, matrix: Matrix3x3): Vec2 {
  const w = matrix[6]*point.x + matrix[7]*point.y + matrix[8];
  return {
    x: (matrix[0]*point.x + matrix[1]*point.y + matrix[2]) / w,
    y: (matrix[3]*point.x + matrix[4]*point.y + matrix[5]) / w
  };
}
