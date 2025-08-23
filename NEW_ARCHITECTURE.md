# Totem Spray Wall App - מבנה חדש

## סקירה כללית

אפליקציה לניהול ספריי וול עם יכולות מתקדמות לעריכת מסלולים, יישור תמונות, ניהול אחיזות ויצוא תמונות.

## ארכיטקטורה חדשה

### מבנה תיקיות

```
src/
├── app/navigation/          # ניווט ראשי
├── screens/                 # מסכים
│   ├── SprayWall/           # מסכי ספריי וול
│   │   ├── SprayWallScreen.tsx
│   │   ├── AddOrReplaceWallScreen.tsx
│   │   ├── CropAndRectifyScreen.tsx
│   │   ├── GridAlignScreen.tsx
│   │   └── SymmetryToolsScreen.tsx
│   └── Routes/              # מסכי מסלולים
│       ├── NewRouteScreen.tsx
│       └── RouteDetailScreen.tsx
├── components/              # רכיבים
│   ├── canvas/              # רכיבי קנבס
│   │   ├── WallCanvas.tsx
│   │   ├── HoldRing.tsx
│   │   └── VolumePolygon.tsx
│   └── ui/                  # רכיבי UI
│       ├── ToolButton.tsx
│       ├── BottomToolbar.tsx
│       └── FloatingPanel.tsx
├── features/                # תכונות עסקיות
│   ├── image/               # עיבוד תמונות
│   │   ├── picker.ts
│   │   ├── exif.ts
│   │   ├── resize.ts
│   │   └── homography.ts
│   ├── spraywall/           # לוגיקת ספריי וול
│   │   ├── types.ts
│   │   ├── store.ts
│   │   ├── transforms.ts
│   │   └── export.ts
│   ├── routes/              # לוגיקת מסלולים
│   │   ├── types.ts
│   │   ├── store.ts
│   │   ├── outline.ts
│   │   ├── symmetry.ts
│   │   └── validators.ts
│   └── data/                # ניהול נתונים
│       ├── firebase.ts
│       └── models.ts
├── utils/                   # עזרים כלליים
│   ├── matrix.ts
│   ├── geometry.ts
│   └── throttle.ts
├── styles/
│   └── theme.ts
└── constants/
    ├── colors.ts
    └── roles.ts
```

## תכונות עיקריות

### 1. הוספת/החלפת תמונת קיר

- **בחירת תמונה**: מצלמה או גלריה
- **תיקון EXIF**: אוטומטי
- **שינוי גודל**: למניעת בעיות ביצועים
- **חיתוך פרספקטיבי**: 4 נקודות → הומוגרפיה
- **יישור רשת T-Nuts**: התאמת spacing/rotation/origin
- **כלי סימטריה**: אנכי/אופקי/קו/מרכז

### 2. יצירת מסלולים

- **כלי בחירה**: טבעת/נקודה/נפח/קו מתאר
- **תפקידי אחיזות**: התחלה/סיום/יד/רגל/כלל
- **סימטריה**: החלת מראה אוטומטית
- **ולידציה**: בדיקות תקינות מסלול
- **Undo/Redo**: מערכת פעולות מלאה

### 3. ניהול מסך מגע

- **Pan/Zoom**: חלק ומהיר
- **שמירת גודל**: אחיזות בגודל קבוע על המסך
- **Hit-Testing**: זיהוי מדויק של אחיזות
- **Transform יחיד**: למניעת "קפיצות"

## טכנולוגיות

### State Management

- **Zustand**: ניהול מצב גלובלי
- **Stores נפרדים**: spraywall, routes
- **Actions**: מובנות ונקיות

### עיבוד תמונות

- **expo-image-picker**: בחירת תמונות
- **expo-image-manipulator**: עיבוד ושינוי גודל
- **Homography**: יישור פרספקטיבה

### UI/UX

- **React Native Gesture Handler**: מחוות מגע
- **Slider**: בקרות ערכים
- **SafeAreaView**: תמיכה בחריצים

### Storage

- **Firebase Firestore**: נתוני מסלולים/קירות
- **Firebase Storage**: תמונות
- **Auto-cleanup**: מחיקה אוטומטית של קבצים ישנים

## זרימות עבודה

### הוספת קיר חדש

1. AddOrReplaceWallScreen → בחירת תמונה
2. CropAndRectifyScreen → חיתוך 4 נקודות
3. GridAlignScreen → יישור רשת (אופציונלי)
4. SymmetryToolsScreen → הגדרת סימטריה (אופציונלי)
5. שמירה ב-Firebase

### יצירת מסלול

1. SprayWallScreen → צפייה בקיר
2. NewRouteScreen → פרטי מסלול
3. בחירת כלי (טבעת/נקודה/וכו')
4. הוספת אחיזות על הקיר
5. ולידציה ושמירה

### ייצוא תמונה

1. רנדור קנבס עם שכבות
2. צילום snapshot
3. שמירה בגלריה או שיתוף

## קבצים מרכזיים

### Types

- `spraywall/types.ts`: Wall, GridSpec, Symmetry, Homography
- `routes/types.ts`: Route, Hold, Volume, HoldRole

### Stores

- `spraywall/store.ts`: ניהול מצב קיר וטרנספורמים
- `routes/store.ts`: ניהול מצב מסלול ו-Undo/Redo

### Utils

- `utils/matrix.ts`: פעולות מטריצות והמרות
- `utils/geometry.ts`: חישובים גיאומטריים
- `features/routes/outline.ts`: Convex Hull לקו מתאר
- `features/routes/symmetry.ts`: פעולות סימטריה

## הרצה והתקנה

```bash
# התקנת תלויות
npm install

# הרצה
npm start
# או
npx expo start
```

## תלויות חדשות

- `zustand`: ניהול מצב
- `react-native-gesture-handler`: מחוות
- `@react-native-community/slider`: בקרות
- `expo-media-library`: שמירה בגלריה
- `expo-sharing`: שיתוף תמונות

## TODO - המשך פיתוח

1. **קנבס Skia**: מימוש מלא של WallCanvas
2. **Homography מלא**: SVD אמיתי במקום placeholder
3. **Grid Renderer**: רנדור רשת T-Nuts דינמית
4. **Volume Tools**: כלי ציור פוליגונים
5. **Export Pipeline**: צילום קנבס ויצוא PNG/JPG
6. **Animation**: אנימציות חלקות לזום/פאן
7. **Offline Support**: עבודה ללא אינטרנט
8. **Performance**: אופטימיזציה למאות אחיזות

## מעבר מהקוד הישן

הקוד הישן נמצא בתיקיות המקוריות ויכול להמשיך לפעול במקביל.
הארכיטקטורה החדשה בנויה לתמוך בשדרוג הדרגתי.
