// Overlay Types - Simple reference image overlay for tracing walls

export interface OverlayImage {
  uri: string;
  name: string;
  // Position in canvas coordinates (pixels) - can be negative to position outside room
  x: number;
  y: number;
  // Original size
  originalWidth: number;
  originalHeight: number;
  // Current scale (1 = original size)
  scale: number;
  // Opacity (0-1)
  opacity: number;
  // Brightness (0.5-2.0, where 1 = normal, >1 = brighter)
  brightness: number;
  // Rotation in degrees
  rotation: number;
  // Is it locked (can't be moved)
  locked: boolean;
  // Flip horizontal (like flipping a coin left-right)
  flipX: boolean;
  // Flip vertical (like flipping a coin up-down)
  flipY: boolean;
  // Crop region (optional) - in original image coordinates
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OverlayState {
  overlay: OverlayImage | null;
  isAdjusting: boolean; // When true, show resize/rotate handles
}

export const DEFAULT_OVERLAY: Partial<OverlayImage> = {
  x: 0,
  y: 0,
  scale: 1,
  opacity: 0.5,
  brightness: 1,
  rotation: 0,
  locked: false,
  flipX: false,
  flipY: false,
};
