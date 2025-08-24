/**
 * @fileoverview מדריך מוסכמות שמות ותיעוד הפרויקט
 * @description Project naming conventions and documentation guide
 */

# מוסכמות שמות ותיעוד | Naming Conventions & Documentation

## מסכים | Screens

### מחיקת ספריי | Spray Wall Screens

1. **SprayWallHomeScreen** (`src/screens/SprayWall/SprayWallHomeScreen.tsx`)
   - **תפקיד**: מסך בית של קיר הספריי - הצגת רשימת המסלולים הקיימים
   - **Purpose**: Home screen for spray wall - shows list of existing routes
   - **Navigation**: `SprayWallHome`

2. **SprayWallMapViewScreen** (`src/screens/SprayWall/SprayWallMapViewScreen.tsx`)
   - **תפקיד**: מסך תצוגת מפת קיר הספריי - כלי ציור וניווט בקיר
   - **Purpose**: SprayWall Map View Screen - drawing tools and wall navigation interface
   - **Navigation**: `SprayWallMapView`

3. **SprayEditorScreen** (`src/screens/SprayWall/SprayEditorScreen.tsx`)
   - **תפקיד**: מסך עריכת מסלול ספריי - יצירה ועריכה של מסלולים על הקיר
   - **Purpose**: SprayRoute Editor Screen - create and edit routes on the spray wall
   - **Navigation**: `SprayEditor`

## שירותים | Services

### שירותי מסלולים | Route Services

1. **RoutesService** (`src/features/routes-map/services/RoutesService.ts`)
   - **תפקיד**: שירות ניהול מסלולים - Firestore operations for routes management
   - **Convention**: PascalCase לקלאסים

2. **FeedbackService** (`src/features/routes-map/services/FeedbackService.ts`)
   - **תפקיד**: שירות ניהול משוב מסלולים - Feedback operations for routes
   - **Convention**: PascalCase לקלאסים

3. **RouteStatsService** (`src/features/routes-map/services/RouteStatsService.ts`)
   - **תפקיד**: שירות ניהול סטטיסטיקות מסלולים - Route statistics management
   - **Convention**: PascalCase לקלאסים

4. **UserStatsService** (`src/features/routes-map/services/UserStatsService.ts`)
   - **תפקיד**: שירות ניהול סטטיסטיקות משתמשים - User statistics management
   - **Convention**: PascalCase לקלאסים

## מחסני מצב | State Stores

1. **routesStore** (`src/store/routesStore.ts`)
   - **תפקיד**: מחסן מצב מסלולים עם ניהול זמן אמת
   - **Convention**: camelCase לקובצי חנות

2. **userStore** (`src/store/userStore.ts`)
   - **תפקיד**: מחסן מצב משתמש - User state management using Zustand
   - **Convention**: camelCase לקובצי חנות

## לוגיקה עסקית | Business Logic

1. **routeCalculations** (`src/utils/businessLogic/routeCalculations.ts`)
   - **תפקיד**: פונקציות לחישובי מסלולים - Route calculation utilities
   - **Convention**: camelCase לקובצי תועלת

2. **userStatistics** (`src/utils/businessLogic/userStatistics.ts`)
   - **תפקיד**: פונקציות לחישובי סטטיסטיקות משתמשים - User statistics utilities
   - **Convention**: camelCase לקובצי תועלת

## מוסכמות תיעוד | Documentation Conventions

### כותרת קובץ | File Header
```typescript
/**
 * @fileoverview תיאור בעברית - English description
 * @description Detailed purpose and functionality
 */
```

### הערות קוד | Code Comments
```typescript
/**
 * הערה בעברית
 * English comment
 */
```

### ממשק | Interface
```typescript
interface ComponentNameProps {
    // פרמטר - parameter description
    propertyName: string;
}
```

## מבנה ניווט | Navigation Structure

```
SprayNavigator
├── SprayWallHome → SprayWallHomeScreen
├── SprayWallMapView → SprayWallMapViewScreen  
├── SprayEditor → SprayEditorScreen
├── SprayReset → SprayResetScreen
└── SprayLeaderboard → SprayLeaderboardScreen
```

## הנחיות לפיתוח | Development Guidelines

1. **שמות קובצים**: PascalCase למרכיבים, camelCase לתועלת
2. **שמות מחלקות**: PascalCase תמיד
3. **שמות פונקציות**: camelCase תמיד
4. **שמות משתנים**: camelCase תמיד
5. **תיעוד דו-לשוני**: עברית + אנגלית בכל קובץ
6. **ארכיטקטורה**: ארגון לפי פיצ'רים (feature-based)

## מיקומי קובצים | File Locations

- **Screens**: `src/screens/[Feature]/[ScreenName]Screen.tsx`
- **Services**: `src/features/[feature]/services/[ServiceName]Service.ts`
- **Stores**: `src/store/[storeName]Store.ts`
- **Utils**: `src/utils/[category]/[utilName].ts`
- **Components**: `src/components/[category]/[ComponentName].tsx`
