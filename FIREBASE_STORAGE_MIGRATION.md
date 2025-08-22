# Firebase Storage Migration Guide

## השינויים שבוצעו - Migration from Cloudinary to Firebase Storage

### 1. תמונות פרופיל (Profile Images)

**קובץ:** `screens/ProfileScreen.js`

**שינויים:**

- ✅ החלפת Cloudinary ב-Firebase Storage
- ✅ שיפור פונקציית `uploadImage()` - שימוש ב-`uploadBytes()` ו-`getDownloadURL()`
- ✅ שיפור פונקציית מחיקת תמונות ישנות - שימוש ב-`deleteObject()`
- ✅ הוספת כפתור להסרת תמונת פרופיל
- ✅ שמות קבצים ייחודיים: `profile_{userId}_{timestamp}.jpg`
- ✅ נתיב אחסון: `users/{userId}/profile/{fileName}`

### 2. תמונות קירות ספריי (Spray Wall Images)

**קובץ:** `services/sprayWallService.js`

**שינויים:**

- ✅ החלפת `uploadImageToCloudinary()` ב-`uploadImageToFirebaseStorage()`
- ✅ החלפת `deleteImageFromCloudinary()` ב-`deleteImageFromFirebaseStorage()`
- ✅ שמות קבצים ייחודיים: `spray_wall_{timestamp}.jpg`
- ✅ נתיב אחסון: `sprayWalls/{fileName}`

### 3. חוקי אבטחה Firebase Storage

**קובץ:** `storage-security-rules.rules`

**נתיבי אחסון וחוקי אבטחה:**

```javascript
// תמונות פרופיל
match /users/{userId}/profile/{fileName} {
  allow read: if true; // קריאה ציבורית
  allow write: if request.auth != null &&
    request.auth.uid == userId &&
    isValidImage() &&
    resource.size < 5 * 1024 * 1024; // מקסימום 5MB
}

// תמונות קירות ספריי
match /sprayWalls/{fileName} {
  allow read: if true; // קריאה ציבורית
  allow write: if request.auth != null &&
    isAdmin() &&
    isValidImage() &&
    resource.size < 20 * 1024 * 1024; // מקסימום 20MB
}
```

### 4. עדכון Firebase Configuration

**קבצים:** `firebase-config.js`, `firebase.json`

**שינויים:**

- ✅ הוספת import ל-`getStorage`
- ✅ export של `storage` object
- ✅ הוספת תצורת storage ל-`firebase.json`
- ✅ תיקון פונקציית `isAdmin()` בחוקי האבטחה

## יתרונות המעבר לFirebase Storage

### 1. **עלויות נמוכות יותר**

- Firebase Storage זול יותר מ-Cloudinary
- אין תשלום על bandwidth למשתמשים בתוך Google Cloud

### 2. **אינטגרציה טובה יותר**

- אותו מערכת Authentication
- חוקי אבטחה מרכזיים
- ניהול אחיד של כל השירותים

### 3. **ביצועים טובים יותר**

- CDN גלובלי של Google
- אחסון מבוזר עולמי
- זמני טעינה מהירים

### 4. **ניהול קל יותר**

- ממשק אחיד בקונסול Firebase
- מחיקה אוטומטית של תמונות ישנות
- גיבוי ו-sync אוטומטי

## הוראות לבדיקה

### 1. תמונות פרופיל

1. עבור לפרופיל משתמש
2. העלה תמונת פרופיל חדשה
3. ודא שהתמונה מופיעה
4. העלה תמונה חדשה - ודא שהישנה נמחקת
5. נסה להסיר תמונה לגמרי

### 2. קירות ספריי (למנהלים)

1. עבור למסך העלאת קיר ספריי
2. העלה תמונת קיר חדשה
3. ודא שהקיר החדש מופיע במערכת
4. ודא שהקיר הישן נמחק מהאחסון

## פתרון בעיות

### אם יש שגיאות העלאה:

1. בדוק שחוקי האבטחה פרוסים נכון
2. ודא שהמשתמש מחובר
3. בדוק את גודל הקובץ (מקסימום 5MB לפרופיל, 20MB לספריי)
4. ודא שפורמט התמונה נתמך (JPEG, PNG, WebP)

### אם יש שגיאות אבטחה:

```bash
firebase deploy --only storage
```

### להצגת לוגים:

```bash
firebase emulators:start --only storage
```

## טיפים לפיתוח

1. **תמיד בדוק שהתמונה הישנה נמחקת** לפני העלאת חדשה
2. **השתמש בשמות קבצים ייחודיים** כדי למנוע התנגשויות
3. **הוסף validation לגודל ופורמט קבצים**
4. **טפל בשגיאות בעדינות** - אל תעצור את האפליקציה
5. **תן feedback למשתמש** על מצב ההעלאה

## נתונים טכניים

- **אחסון תמונות פרופיל:** `gs://totemapp-464009.firebasestorage.app/users/{userId}/profile/`
- **אחסון קירות ספריי:** `gs://totemapp-464009.firebasestorage.app/sprayWalls/`
- **גודל מקסימלי פרופיל:** 5MB
- **גודל מקסימלי ספריי:** 20MB
- **פורמטים נתמכים:** JPEG, PNG, WebP
