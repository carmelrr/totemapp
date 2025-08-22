// spraywall/types.ts
export type Homography = [number,number,number, number,number,number, number,number,number];

export interface GridSpec {
  spacing: number;     // בפיקסלים בקואורדינטת קיר קנונית
  rotation: number;    // ברדיאנים
  origin: { x: number; y: number };
  pattern: "square" | "staggered";
}

export interface Symmetry {
  type: "none" | "vertical" | "horizontal" | "line";
  line?: { p1: {x:number;y:number}, p2:{x:number;y:number} };
  center?: { x:number; y:number };
}

export interface Wall {
  id: string;
  name: string;
  imageUri: string;    // Storage/קובץ מקומי
  canonW: number;      // רוחב התמונה הקנונית
  canonH: number;
  H: Homography;       // ממקור → קנון
  Hinv: Homography;    // קנון → מקור
  grid?: GridSpec;
  symmetry?: Symmetry;
  createdAt: number;
  updatedAt: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}
