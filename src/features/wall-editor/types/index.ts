// Wall Editor Types - Types for the dynamic wall/room editor

/**
 * A 2D point with x,y coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A room/space that contains walls and mats
 */
export interface Room {
  id: string;
  name: string;
  /** Width in units (meters, feet, etc.) */
  width: number;
  /** Height in units */
  height: number;
  /** Background color */
  backgroundColor: string;
  /** Grid color */
  gridColor: string;
  /** Grid cell size in units */
  gridSize: number;
  /** Show grid lines */
  showGrid: boolean;
  /** Walls/sectors within the room */
  walls: Wall[];
  /** Mat/floor areas (rendered below walls) */
  mats: Mat[];
  /** Sectors/zones within the room */
  sectors?: Sector[];
  /** Entrance arrow indicator */
  entranceArrow?: EntranceArrow;
  /** Standalone text labels on the map */
  textLabels?: TextLabel[];
  /** Whether room is published to routes map */
  isPublished?: boolean;
  /** Whether room is hidden from users (admin only) */
  isHidden?: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** User who created */
  createdBy: string;
}

/**
 * A mat/floor area represented as a polygon
 */
export interface Mat {
  id: string;
  /** Points defining the mat polygon */
  points: Point[];
  /** Mat fill color */
  color: string;
  /** Fill opacity (0-1) */
  opacity: number;
  /** Mat name/label */
  name?: string;
}

/**
 * Entrance arrow to indicate room entry direction
 */
export interface EntranceArrow {
  /** Start point of the arrow */
  start: Point;
  /** End point of the arrow (where the arrowhead is) */
  end: Point;
  /** Arrow color */
  color: string;
  /** Arrow stroke width */
  strokeWidth: number;
  /** Whether the arrow is visible */
  visible: boolean;
}

/**
 * A standalone text label that can be placed anywhere on the map
 */
export interface TextLabel {
  id: string;
  /** Text content */
  text: string;
  /** Position on the map */
  position: Point;
  /** Font size */
  fontSize: number;
  /** Text color */
  color: string;
  /** Text opacity (0-1) */
  opacity: number;
  /** Font weight */
  fontWeight?: 'normal' | 'bold' | '700';
  /** Background color (optional) */
  backgroundColor?: string;
  /** Background opacity */
  backgroundOpacity?: number;
  /** Padding around text */
  padding?: number;
  /** Border radius for background */
  borderRadius?: number;
}

/**
 * A sector/zone within a room for grouping and navigation
 */
export interface Sector {
  id: string;
  /** Sector name/title */
  name: string;
  /** Bounding box for the sector area */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Display color */
  color: string;
  /** Label position offset from sector center (in room coordinates) */
  labelOffset?: Point;
  /** Label opacity (0-1, default 1) */
  labelOpacity?: number;
  /** Label font size (in room coordinates, default 14) */
  labelFontSize?: number;
  /** Order for display */
  order: number;
}

/**
 * A wall/sector represented as a polyline of points
 */
export interface Wall {
  id: string;
  /** Points defining the wall polyline */
  points: Point[];
  /** Wall stroke color */
  color: string;
  /** Wall stroke width */
  strokeWidth: number;
  /** Wall name/label */
  name?: string;
  /** Whether wall is closed (polygon) */
  isClosed: boolean;
  /** Optional fill color for closed walls */
  fillColor?: string;
  /** Fill opacity (0-1) */
  fillOpacity?: number;
  /** Angle/tilt of the wall (for climbing context) */
  angle?: number;
  /** Wall type (slab, vertical, overhang, roof) */
  wallType?: 'slab' | 'vertical' | 'overhang' | 'roof';
}

/**
 * A route with points that snap to walls
 */
export interface EditorRoute {
  id: string;
  /** Route name */
  name: string;
  nameHe?: string;
  nameEn?: string;
  /** Route color */
  color: string;
  /** Route grade/difficulty */
  grade: string;
  /** Points defining the route (normalized 0-1) */
  points: RoutePoint[];
  /** Wall this route is attached to */
  wallId?: string;
  /** Rating 1-5 */
  rating?: number;
  /** Video link */
  videoUrl?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** User who created */
  createdBy: string;
}

/**
 * A point in a route
 */
export interface RoutePoint {
  id: string;
  /** Normalized X coordinate (0-1) */
  x: number;
  /** Normalized Y coordinate (0-1) */
  y: number;
  /** Point color (optional, defaults to route color) */
  color?: string;
  /** Point type */
  type: 'start' | 'hold' | 'finish';
  /** Order in the route */
  order: number;
  /** Snapped to wall ID */
  snappedToWall?: string;
}

/**
 * Editor mode states
 */
export type EditorMode = 
  | 'select'       // Select and edit existing elements
  | 'pan'          // Pan/zoom the canvas
  | 'wall'         // Draw new walls
  | 'mat'          // Draw mat layer
  | 'text'         // Place text labels
  | 'erase';       // Delete elements

/**
 * Selection state
 */
export interface Selection {
  type: 'wall' | 'point' | 'route' | 'none';
  wallId?: string;
  pointIndex?: number;
  routeId?: string;
}

/**
 * Editor style configuration
 */
export interface EditorStyles {
  roomBackgroundColor: string;
  gridColor: string;
  gridOpacity: number;
  wallDefaultColor: string;
  wallDefaultWidth: number;
  snapThreshold: number;
  pointRadius: number;
}

/**
 * Default editor styles
 */
export const DEFAULT_EDITOR_STYLES: EditorStyles = {
  roomBackgroundColor: '#1a1a2e',
  gridColor: '#4a4a6a',
  gridOpacity: 0.3,
  wallDefaultColor: '#ffffff',
  wallDefaultWidth: 3,
  snapThreshold: 15,
  pointRadius: 8,
};

/**
 * Grid configuration
 */
export interface GridConfig {
  cellSize: number;
  showMajorLines: boolean;
  majorLineEvery: number;
  majorLineColor: string;
  minorLineColor: string;
  showLabels: boolean;
}

/**
 * Default grid configuration
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  cellSize: 50,
  showMajorLines: true,
  majorLineEvery: 5,
  majorLineColor: '#6a6a8a',
  minorLineColor: '#3a3a5a',
  showLabels: true,
};

/**
 * Transform state for pan/zoom
 */
export interface TransformState {
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * Room creation payload
 */
export interface CreateRoomPayload {
  name: string;
  width: number;
  height: number;
  gridSize?: number;
}

/**
 * Wall creation payload (points added incrementally)
 */
export interface CreateWallPayload {
  roomId: string;
  color?: string;
  strokeWidth?: number;
  name?: string;
}

// Re-export overlay types
export * from './overlay';
