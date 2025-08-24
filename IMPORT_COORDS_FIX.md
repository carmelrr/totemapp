# Fixed Import Resolution for Coordinate Utils

## Issue
The error `Unable to resolve "../utils/coords" from "src\features\routes-map\hooks\useMapTransforms.ts"` was caused by outdated import paths after the codebase reorganization.

## Root Cause
During the previous refactoring, coordinate utilities were consolidated from multiple files into `src/utils/coordinateUtils.ts`, but some import statements still referenced the old deprecated `../utils/coords` path.

## Files Fixed

### 1. useMapTransforms.ts
**Before:**
```typescript
import { clampViewport } from '../utils/coords';
```
**After:**
```typescript
import { clampViewport } from '@/utils/coordinateUtils';
```

### 2. AddRouteScreen.tsx
**Before:**
```typescript
import { toImg, toNorm } from '../utils/coords';
```
**After:**
```typescript
import { toImg, toNorm } from '@/utils/coordinateUtils';
```

### 3. RouteMarkersLayer.tsx
**Before:**
```typescript
import { fromNorm } from '../utils/coords';
```
**After:**
```typescript
import { fromNorm } from '@/utils/coordinateUtils';
```

### 4. useVisibleRoutes.ts
**Before:**
```typescript
import { getViewportBounds, fromNorm } from '../utils/coords';
```
**After:**
```typescript
import { getViewportBounds, fromNorm } from '@/utils/coordinateUtils';
```

### 5. Added Missing Function
Added the missing `getViewportBounds` function to `coordinateUtils.ts` which was only available in the archived coords file:

```typescript
/**
 * חישוב גבולות נקודת התצוגה הנוכחית במערכת קואורדינטות התמונה
 * Calculate current viewport bounds in image coordinate system
 */
export function getViewportBounds(
  { translateX, translateY, scale }: MapTransforms,
  screenW: number,
  screenH: number
) {
  // Implementation with safety checks
}
```

## Verification
- ✅ TypeScript compilation passes with no errors
- ✅ All coordinate utility functions are properly exported from `coordinateUtils.ts`
- ✅ No remaining references to the old `../utils/coords` path
- ✅ All files now use the unified `@/utils/coordinateUtils` import path

## Status
🟢 **RESOLVED** - All import resolution errors have been fixed and the codebase now uses the consolidated coordinate utilities consistently.
