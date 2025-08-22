// src/index.ts - מרכז ייצואים לארכיטקטורה החדשה

// ===== SCREENS =====
export { SprayWallScreen } from './screens/SprayWall/SprayWallScreen';
export { AddOrReplaceWallScreen } from './screens/SprayWall/AddOrReplaceWallScreen';
export { CropAndRectifyScreen } from './screens/SprayWall/CropAndRectifyScreen';
export { GridAlignScreen } from './screens/SprayWall/GridAlignScreen';
export { NewRouteScreen } from './screens/Routes/NewRouteScreen';
export { NewSprayEditorDemoScreen } from './screens/SprayWall/NewSprayEditorDemoScreen';

// ===== COMPONENTS =====
export { NewSprayEditor } from './components/NewSprayEditor';
export { ToolButton } from './components/ui/ToolButton';
export { BottomToolbar } from './components/ui/BottomToolbar';
export { FloatingPanel } from './components/ui/FloatingPanel';

// ===== HOOKS =====
export { useNewSprayEditor } from './hooks/useNewSprayEditor';

// ===== STORES =====
export { useSprayWallStore } from './features/spraywall/store';
export { useRouteStore } from './features/routes/store';

// ===== TYPES =====
export type { 
  Wall, 
  GridSpec, 
  Symmetry, 
  Homography, 
  Transform, 
  Vec2 
} from './features/spraywall/types';

export type { 
  Route, 
  Hold, 
  Volume, 
  HoldRole, 
  RouteAction, 
  RouteState 
} from './features/routes/types';

// ===== UTILITIES =====
export * from './utils/matrix';
export * from './utils/geometry';
export * from './utils/throttle';

// ===== FEATURES =====
export * from './features/image/picker';
export * from './features/image/resize';
export * from './features/image/exif';
export * from './features/image/homography';

export * from './features/routes/outline';
export * from './features/routes/symmetry';
export * from './features/routes/validators';

export * from './features/spraywall/transforms';
export * from './features/spraywall/export';

export * from './features/data/firebase';

// ===== CONSTANTS =====
export * from './constants/colors';
export * from './constants/roles';
