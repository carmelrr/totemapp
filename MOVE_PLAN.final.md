# FINAL MOVE PLAN - Automated Implementation
Generated: 2025-08-22

## Core App Structure Moves
- `App.js` → Keep at root (entry point)
- `firebase-config.js` → `src/features/data/firebase.ts`
- `routesService.js` → `src/features/routes/routesService.ts`
- `GoogleAuth.js` → `src/features/auth/GoogleAuth.tsx`

## Screen Reorganization
### Main Screens
- `screens/HomeScreen.js` → `src/screens/HomeScreen.tsx`
- `screens/LoginScreen.js` → `src/screens/auth/LoginScreen.tsx`
- `screens/ProfileScreen.js` → `src/screens/profile/ProfileScreen.tsx`
- `screens/UserProfileScreen.js` → `src/screens/profile/UserProfileScreen.tsx`
- `screens/SocialScreen.js` → `src/screens/social/SocialScreen.tsx`
- `screens/WallMapScreen.js` → `src/screens/routes/WallMapScreen.tsx`
- `screens/AddRouteScreen.js` → `src/screens/routes/AddRouteScreen.tsx`
- `screens/EnhancedAddRouteScreen.js` → `src/screens/routes/EnhancedAddRouteScreen.tsx`
- `screens/LeaderboardScreen.js` → `src/screens/social/LeaderboardScreen.tsx`
- `screens/ColorPickerScreen.js` → `src/screens/routes/ColorPickerScreen.tsx`
- `screens/AdminWallSetupScreen.js` → `src/screens/admin/AdminWallSetupScreen.tsx`

### Spray Wall Screens
- `screens/spray/SprayWallHomeScreen.js` → `src/screens/SprayWall/SprayWallHomeScreen.tsx`
- `screens/spray/SprayEditorScreen.js` → `src/screens/SprayWall/SprayEditorScreen.tsx`
- `screens/spray/SprayLeaderboardScreen.js` → `src/screens/SprayWall/SprayLeaderboardScreen.tsx`
- `screens/spray/SprayResetScreen.js` → `src/screens/SprayWall/SprayResetScreen.tsx`

## Component Reorganization
### Core Components
- `components/ErrorBoundary.js` → `src/components/ui/ErrorBoundary.tsx`
- `components/DimOverlay.js` → `src/components/ui/DimOverlay.tsx`

### Route-Related Components
- `components/AddRouteModal.js` → `src/components/routes/AddRouteModal.tsx`
- `components/EditRouteModal.js` → `src/components/routes/EditRouteModal.tsx`
- `components/RouteDialog.js` → `src/components/routes/RouteDialog.tsx`
- `components/RouteCircle.js` → `src/components/routes/RouteCircle.tsx`
- `components/RouteList.js` → `src/components/routes/RouteList.tsx`
- `components/RouteFeedbackView.js` → `src/components/routes/RouteFeedbackView.tsx`
- `components/RouteEditPanel.js` → `src/components/routes/RouteEditPanel.tsx`
- `components/HoldMarker.js` → `src/components/routes/HoldMarker.tsx`
- `components/HoldRing.js` → `src/components/routes/HoldRing.tsx`
- `components/HoldsLegend.js` → `src/components/routes/HoldsLegend.tsx`

### Canvas/Map Components
- `components/WallMap.js` → `src/components/canvas/WallMap.tsx`
- `components/MapBackground.js` → `src/components/canvas/MapBackground.tsx`
- `components/EditMapManager.js` → `src/components/canvas/EditMapManager.tsx`

### Image Processing Components
- `components/FlexibleCropper.js` → `src/components/image/FlexibleCropper.tsx`
- `components/SimpleImageCropper.js` → `src/components/image/SimpleImageCropper.tsx`

### Spray Wall Components
- `components/spray/SprayHeader.js` → `src/components/spray/SprayHeader.tsx`
- `components/spray/ZoomableImage.js` → `src/components/spray/ZoomableImage.tsx`
- `components/spray/Toolbar.js` → `src/components/spray/Toolbar.tsx`
- `components/spray/HoldRing.js` → `src/components/spray/HoldRing.tsx`
- `components/spray/GlobalHoldEditor.js` → `src/components/spray/GlobalHoldEditor.tsx`
- `components/spray/HoldTypeSelector.js` → `src/components/spray/HoldTypeSelector.tsx`
- `components/spray/Cropper4x3.js` → `src/components/spray/Cropper4x3.tsx`
- `components/spray/RobustCropper4x3.js` → `src/components/spray/RobustCropper4x3.tsx`
- `components/spray/Simple4x3Viewer.js` → `src/components/spray/Simple4x3Viewer.tsx`

### UI Components
- `components/FilterSortModal.js` → `src/components/ui/FilterSortModal.tsx`

## Context & Hooks Reorganization
- `context/UserContext.js` → `src/features/auth/UserContext.tsx`
- `context/ThemeContext.js` → `src/features/theme/ThemeContext.tsx`
- `hooks/MapTransformState.js` → `src/hooks/MapTransformState.ts`
- `hooks/useVisibleRoutes.js` → `src/hooks/useVisibleRoutes.ts`

## Navigation
- `navigation/SprayNavigator.js` → `src/navigation/SprayNavigator.tsx`

## Services & State
- `services/socialService.js` → `src/features/social/socialService.ts`
- `services/spray/sprayApi.js` → `src/features/spraywall/sprayApi.ts`
- `services/spray/validations.js` → `src/features/spraywall/validations.ts`
- `state/spray/useSprayWall.js` → `src/features/spraywall/useSprayWall.ts`
- `state/spray/useSprayEditor.js` → `src/features/spraywall/useSprayEditor.ts`

## Utilities
- `utils/permissions.js` → `src/features/auth/permissions.ts`
- `utils/mapUtils.js` → `src/utils/mapUtils.ts`

## Assets
- `assets/WallMapSVG.js` → `src/assets/WallMapSVG.tsx`
- `assets/spray/placeholder.jpg` → `src/assets/spray/placeholder.jpg`
- `assets/default-avatar.png` → `src/assets/default-avatar.png`
- `assets/icon.png` → `src/assets/icon.png`
- `assets/adaptive-icon.png` → `src/assets/adaptive-icon.png`
- `assets/splash.png` → `src/assets/splash.png`

## Archive Legacy/Unused Files
### Setup Scripts (to archive/2025-08-22/)
- `setup-firebase-spray.js` → `archive/2025-08-22/setup-firebase-spray.js`
- `setup-first-admin.js` → `archive/2025-08-22/setup-first-admin.js`
- `setup-first-admin-with-auth.js` → `archive/2025-08-22/setup-first-admin-with-auth.js`
- `setup-spray-wall.js` → `archive/2025-08-22/setup-spray-wall.js`
- `firebase-console-admin-setup.js` → `archive/2025-08-22/firebase-console-admin-setup.js`
- `firebase-setup-spray.js` → `archive/2025-08-22/firebase-setup-spray.js`

### Test Scripts (to archive/2025-08-22/)
- `test-firebase-connection.js` → `archive/2025-08-22/test-firebase-connection.js`
- `test-cropper-deps.js` → `archive/2025-08-22/test-cropper-deps.js`

### Discovery Script (temporary)
- `discovery-script.js` → DELETE (temporary analysis tool)

## Duplication Resolution
No duplicates detected in current analysis. All files are unique.

## Barrel Files to Create
- `src/components/index.ts` (re-export all component categories)
- `src/components/spray/index.ts`
- `src/components/routes/index.ts`
- `src/components/canvas/index.ts`
- `src/components/image/index.ts`
- `src/components/ui/index.ts`
- `src/features/auth/index.ts`
- `src/features/routes/index.ts`
- `src/features/spraywall/index.ts`
- `src/features/social/index.ts`
- `src/features/data/index.ts`
- `src/features/theme/index.ts`
- `src/screens/index.ts`
- `src/hooks/index.ts`
- `src/utils/index.ts`

## Import Fixes Needed
Files with deep relative imports that need path alias conversion:
- `state/spray/useSprayWall.js` → Update to `@/features/spraywall/sprayApi`
- `services/spray/sprayApi.js` → Update to `@/features/data/firebase`
- All screen files → Update to `@/components/*`, `@/features/*`
- All component files → Update cross-component imports to `@/components/*`

## Total Files to Move: 81
## Total Archive Files: 8
## Files to Delete: 1 (discovery-script.js)
