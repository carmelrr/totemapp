# Codebase Cleanup Implementation Plan

## 📊 Current State Analysis

### ✅ Already Cleaned Up (Good!)
- **EnhancedAddRouteScreen.tsx** - Not found (already removed)
- **NewRouteScreen.tsx** - Not found (already removed)  
- **SocialScreen.js** - Not found (already removed)
- **discovery-script.js** - Not found (already removed)
- **Legacy setup scripts** - All properly archived in `archive/2025-08-22/`

### 🧹 Files That Need Cleanup

#### 1. Test/Debug Scripts in Root Directory
These are development/testing files that should be moved to archive:

- `test-routes-comprehensive.js` (135 lines) - Firebase routes testing script
- `test-route-conversion.js` - Route conversion testing
- `test-coordinate-analysis.js` - Coordinate analysis testing  
- `debug-routes.js` (54 lines) - Firestore debug script
- `debug-notion.js` - Notion integration debug script

#### 2. Backup Files
- `src/features/routes-map/screens/RoutesMapScreen.backup.tsx` - Backup file

#### 3. Root App.js File
- `App.js` - Potentially obsolete if using `src/App.tsx`

## 🎯 Cleanup Actions

### Phase 1: Move Debug/Test Scripts to Archive
Create archive structure for development tools and move non-production files.

### Phase 2: Remove Backup Files  
Clean up .backup files that are no longer needed.

### Phase 3: Verify Navigation Structure
Ensure only actively used screens are in navigation.

## 📁 Proposed Archive Structure

```
archive/
├── 2025-08-22/           # ✅ Already exists with setup scripts
│   ├── setup-*.js
│   └── firebase-*.js
└── dev-tools/            # 🆕 New - for development scripts
    ├── test-routes-comprehensive.js
    ├── test-route-conversion.js
    ├── test-coordinate-analysis.js
    ├── debug-routes.js
    └── debug-notion.js
```

## ✅ Current Navigation Structure (Clean!)
The navigation is well-organized:

**Main App Navigation:**
- Home, ProfileScreen, UserProfile
- RoutesMap, AddRoute (uses `AddRouteMapScreen`)
- ColorPickerScreen, LeaderboardScreen, Analytics
- SprayWall (SprayNavigator)

**SprayNavigator:**
- SprayWallHome, SprayReset, SprayEditor, SprayLeaderboard

## 🚀 Implementation Benefits

1. **Cleaner Root Directory** - Only production files remain
2. **Better Developer Experience** - Clear separation of dev tools
3. **Reduced Bundle Size** - No test scripts in production
4. **Historical Preservation** - Dev tools archived for future reference
5. **Focused Codebase** - Only active, maintained code visible
