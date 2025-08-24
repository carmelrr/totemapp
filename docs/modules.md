# Modules (sync from Notion)

| Name | Path | Type | Role | Miro Node URL | Status |
|---|---|---|---|---|---|
| models.ts | src/features/data/models.ts | State | data model definitions |  | Active |
| routes-store.ts | src/features/routes/store.ts | State | route state management |  | Active |
| validators.ts | src/features/routes/validators.ts | Service | route validation logic |  | Active |
| firebase.ts | src/features/data/firebase.ts | Service | Firebase integration |  | Active |
| symmetry.ts | src/features/routes/symmetry.ts | Service | symmetry operations |  | Active |
| routes-types.ts | src/features/routes/types.ts | State | route type definitions |  | Active |
| outline.ts | src/features/routes/outline.ts | Service | route outline logic |  | Active |
| spraywall-types.ts | src/features/spraywall/types.ts | State | spraywall type definitions |  | Active |
| export.ts | src/features/spraywall/export.ts | Service | export functionality |  | Active |
| picker.ts | src/features/image/picker.ts | Service | image picker utility |  | Active |
| resize.ts | src/features/image/resize.ts | Service | image resizing utility |  | Active |
| transforms.ts | src/features/spraywall/transforms.ts | Service | geometric transformations |  | Active |
| homography.ts | src/features/image/homography.ts | Service | perspective transformation |  | Active |
| spraywall-store.ts | src/features/spraywall/store.ts | State | spraywall state management |  | Active |
| exif.ts | src/features/image/exif.ts | Service | EXIF data extraction |  | Active |
| RouteDetailScreen.tsx | src/screens/Routes/RouteDetailScreen.tsx | Screen | edit route details |  | Active |
| CropAndRectifyScreen.tsx | src/screens/SprayWall/CropAndRectifyScreen.tsx | Screen | perspective crop and rectification |  | Active |
| NewRouteScreen.tsx | src/screens/Routes/NewRouteScreen.tsx | Screen | create new route |  | Active |
| GridAlignScreen.tsx | src/screens/SprayWall/GridAlignScreen.tsx | Screen | align T-Nuts grid |  | Active |
| SprayWallScreen.tsx | src/screens/SprayWall/SprayWallScreen.tsx | Screen | main wall view |  | Active |
| AddOrReplaceWallScreen.tsx | src/screens/SprayWall/AddOrReplaceWallScreen.tsx | Screen | select or replace wall image |  | Active |
| SymmetryToolsScreen.tsx | src/screens/SprayWall/SymmetryToolsScreen.tsx | Screen | apply symmetry tools |  | Active |
| EditMapManager.tsx | src/components/routes/EditMapManager.tsx | Component | long-press add, tap+confirm delete |  | Active |
| routesService.ts | src/features/routes/services/routesService.ts | Service | Firestore CRUD for routes |  | Deprecated |
| WallMapScreen.tsx | src/screens/routes/WallMapScreen.tsx | Screen | map pan/zoom, show/add routes |  | Active |
| RouteCircle.tsx | src/components/routes/RouteCircle.tsx | Component | draw colored circle with grade | https://miro.com/app/board/uXjVJQw4-hM=/?moveToWidget=3458764638189826137&cot=14 | Active |
| default-avatar.png | src/assets/images/default-avatar.png | Asset | default avatar | https://miro.com/app/board/uXjVJQw4-hM=/?moveToWidget=3458764638189826319&cot=14 | Active |
| RootNavigator.tsx | src/app/navigation/RootNavigator.tsx | File | app routing |  | Active |
| usePanZoom.ts | src/hooks/usePanZoom.ts | Hook | pan/zoom shared values | https://miro.com/app/board/uXjVJQw4-hM=/?moveToWidget=3458764638189826251&cot=14 | Active |