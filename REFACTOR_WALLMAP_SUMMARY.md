# רפקטור מסך המפה - 2025-08-24

## שינויים שבוצעו

### 1. מבנה קבצים חדש ✅

#### קומפוננטות חדשות:
- `src/components/map/WallMap.tsx` - תצוגת המפה בלבד (תמונה/SVG + מחוות זום/פאן)
- `src/components/routes/FilterSortBar.tsx` - Toolbar בין המפה לרשימה
- `src/components/routes/RoutesList.tsx` - רשימת מסלולים (FlatList מוטבת)
- `src/components/routes/PlusFAB.tsx` - כפתור פלוס צף (רק לאדמין)

#### Context וHooks:
- `src/context/AuthContext.tsx` - Context אחיד לניהול הרשאות
- `src/hooks/useWallTransform.ts` - Hook מפורט לניהול זום/פאן עם minScale
- `src/hooks/useVisibleRoutes.ts` - שופר עם throttling וסינון מסלולים לפי viewport

### 2. עקרונות הזום והפאן ✅

- **minScale** הוא הגודל ההתחלתי והקטן ביותר
- אי אפשר להקטין מתחת ל-minScale (קליפינג)
- דאבל-טאפ מחזיר ל-minScale
- כפיית גבולות פאן שמונעת "בריחה" של המפה

### 3. סינון מסלולים לפי viewport ✅

- חישוב מלבן הנראה בקואורדינטות התמונה
- throttling של 100ms למניעת רינדור יתר במחוות
- רק מסלולים הנראים במסך מועברים לרשימה

### 4. כפתורים והרשאות ✅

- **הוסר** פאנל 5 הכפתורים הצדדיים לחלוטין
- **נשאר** רק כפתור הפלוס, מוגבל לאדמין
- AuthContext מבסיס על Firebase Auth + Firestore (users/{uid}.isAdmin)

### 5. קומפוזיציה במסך הראשי ✅

**סדר התצוגה:**
1. `WallMap` (flex: 2) - המפה עם נקודות מסלולים
2. `FilterSortBar` - כפתורי סינון/מיון
3. `RoutesList` (flex: 1) - רשימת מסלולים נראים
4. `PlusFAB` (absolute) - למטה-ימין

### 6. שיפורי ביצועים ✅

- RouteCircle קיים כבר עם React.memo
- FlatList עם getItemLayout ו-maxToRenderPerBatch
- Throttling בעדכון visible routes
- useCallback ו-useMemo במקומות המתאימים

## בדיקות קבלה 🎯

- [x] זום מתחת ל-minScale לא מתאפשר
- [x] דאבל-טאפ מחזיר ל-minScale  
- [x] הרשימה מתעדכנת רק עם מסלולים נראים
- [x] רק אדמין רואה את הפלוס
- [x] כפתורי סינון/מיון נמצאים בין המפה לרשימה
- [x] אין שגיאות TypeScript

## שימוש

```tsx
// המסך מוכן לשימוש ב:
import WallMapScreen from '@/screens/routes/WallMapScreen';

// כל השינויים משולבים ב-WallMapScreen.tsx החדש
// AuthProvider כבר נוסף ל-App.tsx
```

## הערות טכניות

- התאימות לאחור נשמרה ב-useVisibleRoutes
- הממדים WALL_WIDTH/WALL_HEIGHT צריכים התאמה לקיר האמיתי
- המסלולים מוכנים להציג נקודות אדומות על המפה
- מוכן לחיבור למסד נתונים אמיתי במקום mock data
