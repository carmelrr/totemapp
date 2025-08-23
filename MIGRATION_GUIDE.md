# מדריך מעבר מהארכיטקטורה הישנה לחדשה

## סקירה כללית

המדריך הזה מתאר איך לעבור באופן הדרגתי מהקוד הנוכחי לארכיטקטורה החדשה ללא שבירת הפונקציונליות הקיימת.

## שלב 1: התקנת תלויות חדשות

```bash
npm install zustand react-native-gesture-handler @react-native-community/slider expo-media-library expo-sharing
```

## שלב 2: הוספת המבנה החדש במקביל

הארכיטקטורה החדשה נמצאת ב-`src/` והיא עובדת במקביל לקוד הקיים.

### קבצים חדשים שנוספו:

```
src/
├── features/
│   ├── spraywall/
│   │   ├── types.ts           # טיפוסים חדשים
│   │   ├── store.ts           # Zustand store
│   │   ├── transforms.ts      # ניהול Pan/Zoom
│   │   └── export.ts          # ייצוא תמונות
│   ├── routes/
│   │   ├── types.ts           # טיפוסי מסלולים
│   │   ├── store.ts           # ניהול מסלולים
│   │   ├── outline.ts         # Convex Hull
│   │   ├── symmetry.ts        # פעולות סימטריה
│   │   └── validators.ts      # ולידציה
│   ├── image/
│   │   ├── picker.ts          # בחירת תמונות
│   │   ├── resize.ts          # שינוי גודל
│   │   ├── exif.ts            # תיקון כיוון
│   │   └── homography.ts      # תיקון פרספקטיבה
│   └── data/
│       └── firebase.ts        # Firebase חדש
├── components/
│   ├── NewSprayEditor.tsx     # עורך חדש
│   └── ui/                    # רכיבי UI
├── screens/SprayWall/         # מסכים חדשים
├── hooks/
│   └── useNewSprayEditor.ts   # Hook חדש
├── utils/                     # עזרים
└── constants/                 # קבועים
```

## שלב 3: שימוש במערכת החדשה

### במקום useSprayEditor הישן:

```typescript
// ישן
import { useSprayEditor } from "../state/spray/useSprayEditor";

// חדש
import { useNewSprayEditor } from "../src/hooks/useNewSprayEditor";

const editor = useNewSprayEditor({
  canvasWidth: screenWidth,
  canvasHeight: screenHeight,
  imageWidth: 1000,
  imageHeight: 1000,
});
```

### במקום הרכיבים הישנים:

```typescript
// ישן
import { SprayEditorScreen } from "../screens/spray/SprayEditorScreen";

// חדש
import { NewSprayEditorDemoScreen } from "../src/screens/SprayWall/NewSprayEditorDemoScreen";
```

## שלב 4: מעבר הדרגתי

### 4.1 התחלה עם דף דמו

הוסף נתיב חדש ב-navigation:

```typescript
// RootNavigator.tsx
import { NewSprayEditorDemoScreen } from './src/screens/SprayWall/NewSprayEditorDemoScreen';

// בתוך Stack.Navigator
<Stack.Screen
  name="NewSprayEditorDemo"
  component={NewSprayEditorDemoScreen}
  options={{ title: 'עורך חדש - דמו' }}
/>
```

### 4.2 הוספת כפתור לעורך החדש

במסך הספריי הקיים:

```typescript
// SprayWallScreen.js
<TouchableOpacity
  style={styles.newEditorButton}
  onPress={() => navigation.navigate('NewSprayEditorDemo', {
    wallId: currentSprayWall?.id,
    wallImageUri: currentSprayWall?.imageUrl
  })}
>
  <Text>נסה עורך חדש (בטא)</Text>
</TouchableOpacity>
```

### 4.3 מעבר מהקובץ הישן לחדש

כאשר אתה מוכן לעבור מסך ספציפי:

1. **העתק את הלוגיקה החשובה**:

   ```typescript
   // מ-useSprayEditor.js
   const oldEditor = useSprayEditor();

   // ל-useNewSprayEditor.ts
   const newEditor = useNewSprayEditor(options);
   ```

2. **התאם את מבני הנתונים**:

   ```typescript
   // ישן
   const hold = {
     type: "start",
     x: 0.5,
     y: 0.5,
     r: 0.02,
   };

   // חדש
   const hold: Hold = {
     id: generateId(),
     role: "start",
     x: 0.5,
     y: 0.5,
     size: 0.02,
     color: HOLD_COLORS.start,
   };
   ```

3. **עדכן את הפונקציות**:

   ```typescript
   // ישן
   addHold(xPx, yPx, imageWidth, imageHeight);

   // חדש
   handleCanvasTouch(screenX, screenY); // הכול אוטומטי
   ```

## שלב 5: שילוב עם Firebase הקיים

### שמירת מסלולים

```typescript
// השתמש ב-firebase.ts החדש
import { saveRoute } from "../src/features/data/firebase";

const handleSave = async () => {
  const route: Route = {
    id: generateRouteId(),
    wallId: currentWall.id,
    name: routeName,
    grade: routeGrade,
    holds: editor.route.holds || [],
    createdAt: Date.now(),
    createdBy: currentUser.uid,
  };

  await saveRoute(route);
};
```

### טעינת נתונים קיימים

```typescript
// המרה מפורמט ישן לחדש
const convertOldHoldToNew = (oldHold: any): Hold => ({
  id: oldHold.id || generateId(),
  x: oldHold.x,
  y: oldHold.y,
  role: mapOldTypeToRole(oldHold.type),
  color: getColorForRole(oldHold.type),
  size: oldHold.r || 0.02,
});
```

## שלב 6: בדיקות ומעבר מלא

### 6.1 בדיקת תאימות

```typescript
// יצירת טסט להשוואה
const testCompatibility = () => {
  const oldData = useSprayEditor();
  const newData = useNewSprayEditor(options);

  // השווה תוצאות
  console.log("Old holds:", oldData.holds);
  console.log("New holds:", newData.route.holds);
};
```

### 6.2 מעבר מלא

כאשר הכל עובד:

1. החלף את הייבוא בכל הקבצים
2. עדכן את ה-navigation
3. מחק את הקבצים הישנים בזהירות

## שלב 7: ניקיון

### קבצים שניתן למחוק בסופו של דבר:

- `state/spray/useSprayEditor.js`
- `screens/spray/SprayEditorScreen.js` (אם הוחלף)
- רכיבים ישנים שלא בשימוש

### קבצים שכדאי לשמור:

- `services/sprayWallService.js` (עד שה-firebase החדש יהיה מוכן לחלוטין)
- נתוני Firebase קיימים

## טיפים למעבר

### 1. עבוד בשכבות

- תחילה הוסף את המבנה החדש
- ואז החלף מסך אחד בכל פעם
- בדוק שהכל עובד לפני מעבר למסך הבא

### 2. שמור על תאימות לאחור

```typescript
// פונקציה שעובדת עם שני הפורמטים
const getHolds = (data: any) => {
  // אם זה פורמט ישן
  if (data.holds && Array.isArray(data.holds)) {
    return data.holds.map(convertOldHoldToNew);
  }

  // אם זה פורמט חדש
  return data.route?.holds || [];
};
```

### 3. הוסף לוגים

```typescript
console.log("Using new spray editor architecture");
```

### 4. בדוק ביצועים

השווה ביצועים בין הגרסה הישנה והחדשה, במיוחד עם הרבה אחיזות.

## פתרון בעיות נפוצות

### 1. בעיות imports

אם יש שגיאות import:

```typescript
// וודא שהנתיבים נכונים
import { useNewSprayEditor } from "../../src/hooks/useNewSprayEditor";
```

### 2. בעיות טיפוסים

```typescript
// הוסף any זמנית אם נדרש
const holdData: any = oldHoldData;
const newHold: Hold = convertHold(holdData);
```

### 3. בעיות state

```typescript
// וודא שה-stores מאותחלים
useEffect(() => {
  routeStore.setRoute({ wallId: "test" });
}, []);
```

המעבר הזה אמור להיות הדרגתי ובטוח, כך שהאפליקציה תמשיך לפעול כל הזמן.
