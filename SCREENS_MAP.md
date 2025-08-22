# SCREENS MAP - Final Report
Generated: 2025-08-22

## Screen Organization Structure

### Main Application Screens
- **Home**: `src/screens/HomeScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "Home"

### Authentication Screens
- **Login**: `src/screens/auth/LoginScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "Login"

### Profile Management
- **Profile**: `src/screens/profile/ProfileScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "Profile"
- **User Profile**: `src/screens/profile/UserProfileScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "UserProfile"

### Route Management
- **Wall Map**: `src/screens/routes/WallMapScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "WallMap"
- **Add Route**: `src/screens/routes/AddRouteScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "AddRoute"
- **Enhanced Add Route**: `src/screens/routes/EnhancedAddRouteScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "EnhancedAddRoute"
- **Color Picker**: `src/screens/routes/ColorPickerScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "ColorPicker"
- **New Route**: `src/screens/routes/NewRouteScreen.tsx`
  - Navigator: TBD (New screen for next-gen route creation)

### Social Features
- **Social**: `src/screens/social/SocialScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "Social"
- **Leaderboard**: `src/screens/social/LeaderboardScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "Leaderboard"

### Spray Wall System
- **Spray Wall Home**: `src/screens/SprayWall/SprayWallHomeScreen.tsx`
  - Navigator: SprayNavigator (src/navigation/SprayNavigator.tsx)
  - Route: "SprayWallHome"
- **Spray Editor**: `src/screens/SprayWall/SprayEditorScreen.tsx`
  - Navigator: SprayNavigator (src/navigation/SprayNavigator.tsx)
  - Route: "SprayEditor"
- **Spray Leaderboard**: `src/screens/SprayWall/SprayLeaderboardScreen.tsx`
  - Navigator: SprayNavigator (src/navigation/SprayNavigator.tsx)
  - Route: "SprayLeaderboard"
- **Spray Reset**: `src/screens/SprayWall/SprayResetScreen.tsx`
  - Navigator: SprayNavigator (src/navigation/SprayNavigator.tsx)
  - Route: "SprayReset"

### New Spray Wall Features (Next Generation)
- **Spray Wall Main**: `src/screens/SprayWall/SprayWallScreen.tsx`
  - Navigator: TBD (New main spray wall interface)
- **Add/Replace Wall**: `src/screens/SprayWall/AddOrReplaceWallScreen.tsx`
  - Navigator: TBD (Wall management)
- **Crop and Rectify**: `src/screens/SprayWall/CropAndRectifyScreen.tsx`
  - Navigator: TBD (Image processing workflow)
- **Grid Align**: `src/screens/SprayWall/GridAlignScreen.tsx`
  - Navigator: TBD (Grid alignment tool)
- **New Spray Editor Demo**: `src/screens/SprayWall/NewSprayEditorDemoScreen.tsx`
  - Navigator: TBD (Next-gen editor demonstration)

### Administrative
- **Admin Wall Setup**: `src/screens/admin/AdminWallSetupScreen.tsx`
  - Navigator: Main Stack Navigator (App.js)
  - Route: "AdminWallSetup"

## Navigation Hierarchy

```
App.js (Main Stack Navigator)
├── Home
├── Login
├── Profile
├── UserProfile
├── WallMap
├── AddRoute
├── EnhancedAddRoute
├── ColorPicker
├── Social
├── Leaderboard
├── AdminWallSetup
└── SprayNavigator
    ├── SprayWallHome
    ├── SprayEditor
    ├── SprayLeaderboard
    └── SprayReset
```

## Import Paths
All screens now use clean path aliases:
- `@/screens/auth/LoginScreen`
- `@/screens/profile/ProfileScreen`
- `@/screens/routes/WallMapScreen`
- `@/screens/social/SocialScreen`
- `@/screens/SprayWall/SprayEditorScreen`
- etc.

**Status**: ✅ **COMPLETE** - All screens mapped and organized
