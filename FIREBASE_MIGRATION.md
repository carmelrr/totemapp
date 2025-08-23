# Firebase Migration Guide - TotemApp

## שינויים שבוצעו

### 1. עדכון קונפיגורציה

עודכן קובץ `firebase-config.js` עם פרטי הפרויקט החדש:

- Project ID: `totemapp-464009`
- Storage Bucket: `totemapp-464009.firebasestorage.app`
- Auth Domain: `totemapp-464009.firebaseapp.com`

### 2. חוקי Firestore מעודכנים

עודכנו חוקי הגישה ב-`firestore.rules`:

- ✅ הגנה מחוזקת על נתוני משתמשים
- ✅ הפרדה בין יוצרי תוכן למנהלים
- ✅ ולידציה של נתונים
- ✅ תמיכה במבנה המסלולים החדש

### 3. חוקי Storage מעודכנים

חוקי `storage-security-rules.rules` כוללים:

- ✅ הגבלות גודל קבצים
- ✅ הגבלות סוג קבצים (רק תמונות)
- ✅ הפרדת הרשאות בין משתמשים למנהלים

## צעדים לביצוע ב-Firebase Console

### שלב 1: עדכון חוקי Firestore

1. היכנס ל-Firebase Console: https://console.firebase.google.com/
2. בחר בפרויקט `totemapp-464009`
3. עבור ל-Firestore Database → Rules
4. העתק את התוכן מקובץ `firestore.rules`
5. לחץ על "Publish"

### שלב 2: עדכון חוקי Storage

1. באותו פרויקט, עבור ל-Storage → Rules
2. העתק את התוכן מקובץ `storage-security-rules.rules`
3. לחץ על "Publish"

### שלב 3: הגדרת המנהל הראשון

הפעל את הקוד הבא ב-Firebase Functions או ישירות ב-Firestore:

```javascript
// הוסף למשתמש הראשון הרשאות מנהל
await firestore
  .collection("users")
  .doc("YOUR_USER_ID")
  .set(
    {
      email: "your-email@example.com",
      displayName: "Your Name",
      isAdmin: true,
      createdAt: new Date(),
      privacy: {
        showProfile: true,
        showTotalRoutes: true,
        showHighestGrade: true,
        showFeedbackCount: true,
        showAverageRating: true,
        showGradeStats: true,
        showJoinDate: true,
      },
    },
    { merge: true },
  );
```

### שלב 4: בדיקת החיבור

1. הפעל את האפליקציה
2. התחבר עם משתמש
3. ודא שהנתונים נשמרים ונטענים כראוי

## מבנה הנתונים המומלץ

### משתמשים (users collection)

```javascript
{
  uid: "user123",
  email: "user@example.com",
  displayName: "שם המשתמש",
  photoURL: "https://storage.googleapis.com/...",
  isAdmin: false,
  createdAt: timestamp,
  privacy: {
    showProfile: true,
    showTotalRoutes: true,
    // ...
  }
}
```

### מסלולים (routes collection)

```javascript
{
  id: "route123",
  createdBy: "user123",
  grade: "V5",
  color: "#ff0000",
  x: 0.5,
  y: 0.3,
  createdAt: timestamp,
  description: "תיאור המסלול"
}
```

### קירות ספריי (sprayWalls collection)

```javascript
{
  id: "wall123",
  name: "קיר ראשי",
  imageUrl: "https://storage.googleapis.com/...",
  createdAt: timestamp,
  isActive: true,
  createdBy: "admin123"
}
```

## טיפים חשובים

1. **גיבוי נתונים**: לפני המעבר, גבה את כל הנתונים מהפרויקט הישן
2. **בדיקת הרשאות**: ודא שהמשתמשים יכולים לגשת רק לנתונים המתאימים להם
3. **ניטור ביצועים**: עקב אחר הביצועים לאחר המעבר
4. **מיגרציה הדרגתית**: שקול לעשות מיגרציה הדרגתית של הנתונים

## פתרון בעיות נפוצות

### שגיאת הרשאות

```
FirebaseError: Missing or insufficient permissions
```

**פתרון**: ודא שחוקי Firestore מעודכנים וש-isAdmin מוגדר נכון

### שגיאת העלאת תמונות

```
StorageError: User does not have permission to access this object
```

**פתרון**: ודא שחוקי Storage מעודכנים ושהמשתמש מחובר

### שגיאת חיבור

```
FirebaseError: Firebase: No Firebase App '[DEFAULT]' has been created
```

**פתרון**: ודא שקובץ firebase-config.js מעודכן נכון
