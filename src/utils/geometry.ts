// utils/geometry.ts
import { Vec2 } from '@/features/'spraywall/types';

// מרחק בין שתי נקודות
export function distance(p1: Vec2, p2: Vec2): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// מרכז מסה של נקודות
export function centroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

// בדיקה אם נקודה נמצאת על קו (בטולרנס)
export function isPointOnLine(
  point: Vec2, 
  lineStart: Vec2, 
  lineEnd: Vec2, 
  tolerance: number = 0.01
): boolean {
  const d1 = distance(point, lineStart);
  const d2 = distance(point, lineEnd);
  const lineLength = distance(lineStart, lineEnd);
  
  return Math.abs(d1 + d2 - lineLength) < tolerance;
}

// בדיקה אם נקודה נמצאת בתוך מלבן
export function isPointInRect(
  point: Vec2,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return point.x >= rect.x && 
         point.x <= rect.x + rect.width &&
         point.y >= rect.y && 
         point.y <= rect.y + rect.height;
}

// חישוב רדיוס שמשמר גודל על המסך
export function getScreenConstantRadius(
  baseRadius: number, 
  scale: number, 
  minRadius: number = 8
): number {
  return Math.max(minRadius, baseRadius / scale);
}

// בדיקה אם נקודה נמצאת בתוך עיגול
export function isPointInCircle(point: Vec2, center: Vec2, radius: number): boolean {
  return distance(point, center) <= radius;
}

// קלאמפ ערך בין מינימום למקסימום
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// נורמליזציה לקואורדינטות 0-1
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
