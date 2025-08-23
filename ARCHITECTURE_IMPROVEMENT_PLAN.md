# תוכנית שיפור ארכיטקטורה - TotemApp

## מצב נוכחי vs ארכיטקטורה מומלצת

### מבנה קיים
```
src/
  features/routes-map/
    components/
      MapViewport.tsx        # ✅ דומה ל-WallMap 
      RouteMarker.tsx        # ✅ דומה ל-RouteCircle
      RouteMarkersLayer.tsx  # ✅ רכיב טוב
      FilterSheet.tsx        # ✅ דומה ל-SortAndFilterSheet
      RouteBottomSheet.tsx   # ✅ כבר קיים
    screens/
      RoutesMapScreen.tsx    # ✅ דומה ל-WallMapScreen
    hooks/
      useMapTransforms.ts    # ✅ דומה ל-useMapTransform
      useVisibleRoutes.ts    # ✅ כבר קיים
    services/
      RoutesService.ts       # ✅ דומה ל-firestore.ts
```

### שיפורים נדרשים

## שלב 1: ארגון מחדש של רכיבי המפה
יצירת תיקיית `WallMap/` עם רכיבים מתמחים

## שלב 2: שיפור מערכת הפילטרים
פיצול לרכיבים קטנים יותר + Zustand store

## שלב 3: שיפור מערכת הקואורדינטות
מעבר לקואורדינטות תמונה מלאות במקום נורמליזציה

## שלב 4: הוספת רכיבי UI חסרים
AppHeader, רשימת מסלולים נראים, מעבר מפה↔רשימה

## שלב 5: ביצועים
אופטימיזציה של רינדור מסלולים גדולים
