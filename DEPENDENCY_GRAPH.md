# DEPENDENCY GRAPH - Automated Analysis
Generated: 2025-08-22T09:18:44.034Z

## Problematic Dependencies

### Files with Deep Relative Imports
#### state\spray\useSprayWall.js
- `../../services/spray/sprayApi`

#### services\spray\sprayApi.js
- `../../firebase-config`

#### screens\spray\SprayWallHomeScreen.js
- `../../components/spray/SprayHeader`
- `../../state/spray/useSprayWall`
- `../../utils/permissions`

#### screens\spray\SprayResetScreen.js
- `../../components/spray/Simple4x3Viewer`
- `../../services/spray/sprayApi`
- `../../utils/permissions`

#### screens\spray\SprayLeaderboardScreen.js
- `../../services/spray/sprayApi`

#### screens\spray\SprayEditorScreen.js
- `../../components/spray/ZoomableImage`
- `../../components/spray/HoldRing`
- `../../components/spray/GlobalHoldEditor`
- `../../components/spray/HoldTypeSelector`
- `../../components/spray/Toolbar`
- `../../state/spray/useSprayEditor`
- `../../services/spray/sprayApi`
- `../../services/spray/validations`
- `../../firebase-config`

#### components\spray\SprayHeader.js
- `../../assets/spray/placeholder.jpg`

#### src\features\spraywall\transforms.ts
- `../../utils/matrix`
- `../../utils/geometry`

#### src\features\image\homography.ts
- `../../utils/matrix`

#### src\features\data\firebase.ts
- `../../../firebase-config`

#### src\screens\SprayWall\SprayWallScreen.tsx
- `../../components/ui/BottomToolbar`
- `../../components/ui/FloatingPanel`
- `../../components/ui/ToolButton`
- `../../constants/colors`
- `../../utils/matrix`

#### src\screens\SprayWall\NewSprayEditorDemoScreen.tsx
- `../../components/NewSprayEditor`
- `../../constants/colors`

#### src\screens\SprayWall\GridAlignScreen.tsx
- `../../constants/colors`

#### src\screens\SprayWall\CropAndRectifyScreen.tsx
- `../../features/image/homography`
- `../../constants/colors`

#### src\screens\SprayWall\AddOrReplaceWallScreen.tsx
- `../../features/image/picker`
- `../../features/image/exif`
- `../../features/image/resize`
- `../../constants/colors`

#### src\screens\Routes\NewRouteScreen.tsx
- `../../features/routes/store`
- `../../constants/colors`
- `../../constants/roles`
- `../../features/routes/validators`

#### src\components\ui\ToolButton.tsx
- `../../constants/colors`

#### src\components\ui\FloatingPanel.tsx
- `../../constants/colors`

#### src\components\ui\BottomToolbar.tsx
- `../../constants/colors`

### Cross-Feature Dependencies  


## Full Dependency Graph
```
test-firebase-connection.js depends on:
  - ./firebase-config.js
  - firebase/auth
  - firebase/firestore
  - firebase/storage

test-cropper-deps.js depends on:
  - expo-image
  - expo-image-manipulator
  - expo-file-system
  - react-native-gesture-handler
  - react-native-reanimated

setup-spray-wall.js depends on:


setup-first-admin.js depends on:
  - firebase/app
  - firebase/firestore

setup-first-admin-with-auth.js depends on:
  - firebase/app
  - firebase/auth
  - firebase/firestore

setup-firebase-spray.js depends on:
  - firebase/app
  - firebase/firestore
  - firebase/auth

routesService.js depends on:
  - firebase/firestore
  - ./firebase-config

metro.config.js depends on:
  - @expo/metro-config

GoogleAuth.js depends on:
  - react
  - react-native
  - expo-auth-session/providers/google
  - firebase/auth
  - ./firebase-config
  - expo-constants

firebase-setup-spray.js depends on:


firebase-console-admin-setup.js depends on:


firebase-config.js depends on:
  - firebase/app
  - firebase/auth
  - firebase/firestore
  - firebase/storage
  - @react-native-async-storage/async-storage
  - firebase/auth

discovery-script.js depends on:
  - fs
  - path
  - glob
  - glob
  - child_process

babel.config.js depends on:


App.js depends on:
  - react
  - @react-navigation/native
  - @react-navigation/native-stack
  - react-native-gesture-handler
  - react-native
  - react-native-screens
  - firebase/auth
  - firebase/firestore
  - ./firebase-config
  - ./screens/WallMapScreen
  - ./screens/ProfileScreen
  - ./screens/UserProfileScreen
  - ./screens/HomeScreen
  - ./screens/LoginScreen
  - ./screens/AddRouteScreen
  - ./screens/ColorPickerScreen
  - ./screens/LeaderboardScreen
  - ./navigation/SprayNavigator
  - ./context/UserContext
  - ./context/ThemeContext
  - ./components/ErrorBoundary
  - react-native

utils\permissions.js depends on:
  - react
  - ../firebase-config
  - firebase/firestore

utils\mapUtils.js depends on:


state\spray\useSprayWall.js depends on:
  - react
  - ../../services/spray/sprayApi

state\spray\useSprayEditor.js depends on:
  - react

services\socialService.js depends on:
  - ../firebase-config
  - firebase/firestore

services\spray\validations.js depends on:


services\spray\sprayApi.js depends on:
  - firebase/firestore
  - firebase/storage
  - ../../firebase-config

screens\WallMapScreen.js depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - ../components/WallMap
  - ../components/RouteList
  - ../components/RouteEditPanel
  - ../components/RouteFeedbackView
  - ../components/FilterSortModal
  - ../hooks/useVisibleRoutes
  - ../routesService
  - ../firebase-config
  - ../context/UserContext
  - ../context/ThemeContext

screens\UserProfileScreen.js depends on:
  - react
  - react-native
  - ../firebase-config
  - firebase/firestore
  - ../services/socialService
  - ../assets/default-avatar.png
  - ../context/ThemeContext

screens\SocialScreen.js depends on:


screens\ProfileScreen.js depends on:
  - react
  - react-native
  - expo-image-picker
  - firebase/auth
  - @react-navigation/native
  - ../firebase-config
  - firebase/firestore
  - firebase/storage
  - ../routesService
  - ../services/socialService
  - ../context/UserContext
  - ../context/ThemeContext
  - ../assets/default-avatar.png
  - ../assets/default-avatar.png
  - ../assets/default-avatar.png
  - ../assets/default-avatar.png

screens\LoginScreen.js depends on:
  - react
  - react-native
  - firebase/auth
  - ../firebase-config
  - ../GoogleAuth
  - ../context/ThemeContext

screens\LeaderboardScreen.js depends on:
  - react
  - react-native
  - ../firebase-config
  - firebase/firestore
  - ../assets/default-avatar.png
  - ../context/ThemeContext

screens\HomeScreen.js depends on:
  - react
  - react-native
  - @react-navigation/native
  - ../context/ThemeContext

screens\EnhancedAddRouteScreen.js depends on:
  - react
  - react-native
  - react-native-gesture-handler
  - react-native-reanimated
  - @react-navigation/native
  - ../context/ThemeContext
  - ../context/UserContext
  - ../components/DimOverlay
  - ../components/HoldMarker
  - ../components/HoldsLegend
  - ../components/HoldRing

screens\ColorPickerScreen.js depends on:
  - react
  - react-native
  - @react-navigation/native
  - ../context/ThemeContext

screens\AdminWallSetupScreen.js depends on:
  - react
  - react-native
  - @react-navigation/native
  - react-native-gesture-handler
  - react-native-reanimated
  - ../context/ThemeContext

screens\AddRouteScreen.js depends on:
  - react
  - react-native
  - @react-navigation/native
  - @react-native-async-storage/async-storage
  - ../routesService
  - ../firebase-config
  - ../context/ThemeContext

screens\spray\SprayWallHomeScreen.js depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - @expo/vector-icons
  - ../../components/spray/SprayHeader
  - ../../state/spray/useSprayWall
  - ../../utils/permissions

screens\spray\SprayResetScreen.js depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - expo-image-picker
  - expo-image
  - ../../components/spray/Simple4x3Viewer
  - ../../services/spray/sprayApi
  - ../../utils/permissions

screens\spray\SprayLeaderboardScreen.js depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - @expo/vector-icons
  - ../../services/spray/sprayApi

screens\spray\SprayEditorScreen.js depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - react-native-reanimated
  - ../../components/spray/ZoomableImage
  - ../../components/spray/HoldRing
  - ../../components/spray/GlobalHoldEditor
  - ../../components/spray/HoldTypeSelector
  - ../../components/spray/Toolbar
  - ../../state/spray/useSprayEditor
  - ../../services/spray/sprayApi
  - ../../services/spray/validations
  - ../../firebase-config

navigation\SprayNavigator.js depends on:
  - react
  - @react-navigation/native-stack
  - ../screens/spray/SprayWallHomeScreen
  - ../screens/spray/SprayResetScreen
  - ../screens/spray/SprayEditorScreen
  - ../screens/spray/SprayLeaderboardScreen

hooks\useVisibleRoutes.js depends on:
  - react
  - ../utils/mapUtils

hooks\MapTransformState.js depends on:
  - react-native-reanimated
  - react-native

functions\index.js depends on:
  - firebase-functions/v2/https
  - firebase-functions/v2/firestore
  - firebase-functions
  - firebase-functions/https
  - firebase-functions/logger

context\UserContext.js depends on:
  - react
  - ../firebase-config
  - firebase/firestore

context\ThemeContext.js depends on:
  - react
  - @react-native-async-storage/async-storage

components\WallMap.js depends on:
  - react
  - react-native
  - @react-navigation/native
  - react-native-gesture-handler
  - react-native-reanimated
  - ../assets/WallMapSVG
  - @react-native-community/slider
  - ./RouteCircle
  - ./EditRouteModal
  - ./RouteDialog
  - ../routesService
  - ../context/UserContext
  - ../context/ThemeContext
  - ../utils/mapUtils

components\SimpleImageCropper.js depends on:
  - react
  - react-native
  - expo-image-manipulator
  - react-native-gesture-handler
  - react-native-reanimated
  - expo-image

components\RouteList.js depends on:
  - react
  - react-native
  - ./RouteDialog
  - ../routesService

components\RouteFeedbackView.js depends on:
  - react
  - react-native
  - ../firebase-config
  - ../routesService
  - ../services/socialService
  - ../context/UserContext

components\RouteEditPanel.js depends on:
  - react
  - react-native

components\RouteDialog.js depends on:
  - react
  - react-native
  - ../firebase-config
  - ../routesService
  - ../context/UserContext

components\RouteCircle.js depends on:
  - react
  - react-native
  - react-native-gesture-handler
  - react-native-reanimated
  - ../routesService
  - ../context/UserContext

components\MapBackground.js depends on:
  - react
  - react-native
  - react-native-reanimated
  - ../assets/WallMapSVG

components\HoldsLegend.js depends on:
  - react
  - react-native
  - ../context/ThemeContext

components\HoldRing.js depends on:
  - react
  - react-native
  - react-native-reanimated
  - react-native-svg

components\HoldMarker.js depends on:
  - react
  - react-native
  - ../context/ThemeContext
  - react-native-reanimated

components\FlexibleCropper.js depends on:
  - react
  - ./SimpleImageCropper

components\FilterSortModal.js depends on:
  - react
  - react-native

components\ErrorBoundary.js depends on:
  - react
  - react-native

components\EditRouteModal.js depends on:
  - react
  - react-native

components\EditMapManager.js depends on:
  - react
  - react-native
  - ./RouteCircle

components\DimOverlay.js depends on:
  - react
  - react-native
  - react-native-svg

components\AddRouteModal.js depends on:
  - react
  - react-native

components\spray\ZoomableImage.js depends on:
  - react
  - react-native
  - react-native-gesture-handler
  - react-native-reanimated
  - expo-image

components\spray\Toolbar.js depends on:
  - react
  - react-native
  - @expo/vector-icons

components\spray\SprayHeader.js depends on:
  - react
  - react-native
  - expo-image
  - expo-linear-gradient
  - ../../assets/spray/placeholder.jpg

components\spray\Simple4x3Viewer.js depends on:
  - react
  - react-native
  - expo-image-manipulator
  - expo-file-system

components\spray\RobustCropper4x3.js depends on:
  - react
  - react-native
  - react-native-gesture-handler
  - react-native-reanimated
  - expo-image
  - expo-image-manipulator
  - expo-file-system

components\spray\HoldTypeSelector.js depends on:
  - react
  - react-native

components\spray\HoldRing.js depends on:
  - react
  - react-native
  - react-native-gesture-handler
  - react-native-reanimated
  - react-native-svg

components\spray\GlobalHoldEditor.js depends on:
  - react
  - react-native
  - react-native-gesture-handler
  - react-native-reanimated

components\spray\Cropper4x3.js depends on:
  - react
  - react-native
  - react-native-gesture-handler
  - react-native-reanimated
  - expo-image
  - expo-image-manipulator

assets\WallMapSVG.js depends on:
  - react
  - react-native-svg

src\index.ts depends on:


src\utils\throttle.ts depends on:


src\utils\matrix.ts depends on:
  - ../features/spraywall/types

src\utils\geometry.ts depends on:
  - ../features/spraywall/types

src\hooks\useNewSprayEditor.ts depends on:
  - react
  - ../features/routes/store
  - ../features/spraywall/store
  - ../features/spraywall/transforms
  - ../features/routes/types
  - ../constants/roles
  - ../features/routes/validators

src\features\spraywall\types.ts depends on:


src\features\spraywall\transforms.ts depends on:
  - ./types
  - ../../utils/matrix
  - ../../utils/geometry
  - ../routes/types

src\features\spraywall\store.ts depends on:
  - zustand
  - ./types

src\features\spraywall\export.ts depends on:
  - expo-media-library
  - expo-sharing
  - react-native

src\features\routes\validators.ts depends on:
  - ./types

src\features\routes\types.ts depends on:


src\features\routes\symmetry.ts depends on:
  - ../spraywall/types
  - ./types

src\features\routes\store.ts depends on:
  - ./types

src\features\routes\outline.ts depends on:
  - ../spraywall/types
  - ./types

src\features\image\resize.ts depends on:
  - expo-image-manipulator

src\features\image\picker.ts depends on:
  - expo-image-picker
  - react-native

src\features\image\homography.ts depends on:
  - ../spraywall/types
  - ../../utils/matrix

src\features\image\exif.ts depends on:
  - expo-image-manipulator

src\features\data\firebase.ts depends on:
  - firebase/firestore
  - firebase/storage
  - ../../../firebase-config
  - ../spraywall/types
  - ../routes/types

src\constants\roles.ts depends on:
  - ../features/routes/types
  - ./colors

src\constants\colors.ts depends on:


src\screens\SprayWall\SprayWallScreen.tsx depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - ../../components/ui/BottomToolbar
  - ../../components/ui/FloatingPanel
  - ../../components/ui/ToolButton
  - ../../constants/colors
  - ../../utils/matrix

src\screens\SprayWall\NewSprayEditorDemoScreen.tsx depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - ../../components/NewSprayEditor
  - ../../constants/colors

src\screens\SprayWall\GridAlignScreen.tsx depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - @react-native-community/slider
  - ../../constants/colors

src\screens\SprayWall\CropAndRectifyScreen.tsx depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - react-native-gesture-handler
  - ../../features/image/homography
  - ../../constants/colors

src\screens\SprayWall\AddOrReplaceWallScreen.tsx depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - ../../features/image/picker
  - ../../features/image/exif
  - ../../features/image/resize
  - ../../constants/colors

src\screens\Routes\NewRouteScreen.tsx depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - ../../features/routes/store
  - ../../constants/colors
  - ../../constants/roles
  - ../../features/routes/validators

src\components\NewSprayEditor.tsx depends on:
  - react
  - react-native
  - ../hooks/useNewSprayEditor
  - ./ui/BottomToolbar
  - ./ui/FloatingPanel
  - ./ui/ToolButton
  - ../constants/roles

src\components\ui\ToolButton.tsx depends on:
  - react
  - react-native
  - ../../constants/colors

src\components\ui\FloatingPanel.tsx depends on:
  - react
  - react-native
  - ../../constants/colors

src\components\ui\BottomToolbar.tsx depends on:
  - react
  - react-native
  - react-native-safe-area-context
  - ./ToolButton
  - ../../constants/colors
```
