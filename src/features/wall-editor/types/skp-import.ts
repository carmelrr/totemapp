// SKP Import Types - Types for importing SketchUp files

import { Point } from './index';

/**
 * A contour/outline extracted from an SKP file
 */
export interface SKPContour {
  /** Unique identifier */
  id: string;
  /** Name from SketchUp (group/component name) */
  name: string;
  /** Points defining the contour */
  points: Point[];
  /** Whether it's a closed polygon */
  isClosed: boolean;
  /** Layer name from SketchUp */
  layer?: string;
  /** Original color from SketchUp */
  color?: string;
  /** Bounding box */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  /** Suggested type based on layer/name analysis */
  suggestedType?: ContourType;
}

/**
 * Types of contours that can be identified
 */
export type ContourType = 
  | 'climbing_wall'  // Climbing wall surface
  | 'mat'            // Safety mats/padding
  | 'floor'          // Floor outline
  | 'structure'      // General structure
  | 'obstacle'       // Obstacles/columns
  | 'unknown';       // Unidentified

/**
 * Result from SKP parsing
 */
export interface SKPParseResult {
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Original file info */
  fileInfo: {
    name: string;
    sizeBytes: number;
    sketchUpVersion?: string;
  };
  /** Overall bounding box */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  /** Extracted contours */
  contours: SKPContour[];
  /** Suggested scale (pixels per meter) */
  suggestedScale: number;
}

/**
 * User selection of contour types
 */
export interface ContourSelection {
  contourId: string;
  selectedType: ContourType;
  /** Include this contour in import */
  include: boolean;
}

/**
 * Import configuration
 */
export interface SKPImportConfig {
  /** Contour selections by user */
  selections: ContourSelection[];
  /** Scale factor (pixels per real-world unit) */
  scale: number;
  /** Offset to apply */
  offset: Point;
  /** Simplify contours (reduce point count) */
  simplifyTolerance?: number;
  /** Grid size for snapping */
  gridSize?: number;
}

/**
 * Request to parse SKP file
 */
export interface SKPParseRequest {
  /** Base64 encoded file or storage URL */
  fileData?: string;
  storageUrl?: string;
  /** Options */
  options?: {
    /** Extract only 2D top-down view */
    topDownView?: boolean;
    /** Simplification tolerance */
    simplifyTolerance?: number;
    /** Maximum contours to extract */
    maxContours?: number;
  };
}

/**
 * Keywords for auto-detecting contour types from names
 */
export const CONTOUR_TYPE_KEYWORDS: Record<ContourType, string[]> = {
  climbing_wall: ['wall', 'קיר', 'טיפוס', 'climb', 'panel', 'פאנל', 'surface'],
  mat: ['mat', 'מזרן', 'pad', 'padding', 'safety', 'foam', 'ריפוד'],
  floor: ['floor', 'רצפה', 'ground', 'base', 'קרקע'],
  structure: ['structure', 'מבנה', 'frame', 'support', 'beam', 'קורה'],
  obstacle: ['column', 'עמוד', 'pillar', 'obstacle', 'מכשול'],
  unknown: [],
};

/**
 * Colors for different contour types in the selector UI
 */
export const CONTOUR_TYPE_COLORS: Record<ContourType, string> = {
  climbing_wall: '#22C55E',  // Green
  mat: '#3B82F6',            // Blue
  floor: '#6B7280',          // Gray
  structure: '#F59E0B',      // Amber
  obstacle: '#EF4444',       // Red
  unknown: '#9CA3AF',        // Light gray
};

/**
 * Hebrew labels for contour types
 */
export const CONTOUR_TYPE_LABELS: Record<ContourType, string> = {
  climbing_wall: 'קיר טיפוס',
  mat: 'מזרן',
  floor: 'רצפה',
  structure: 'מבנה',
  obstacle: 'מכשול',
  unknown: 'לא מזוהה',
};
