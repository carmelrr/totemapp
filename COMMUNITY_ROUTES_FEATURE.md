# 🧗 Community Routes Feature - מסלולי קהילה

## Overview / סקירה כללית

This feature adds a new tab to the app that allows users to create temporary routes on real photos of climbing walls. Unlike the Spray Wall which uses a predefined wall image, Community Routes lets any user upload their own photo and mark holds on it.

פיצ׳ר זה מוסיף טאב חדש לאפליקציה שמאפשר למשתמשים ליצור מסלולים זמניים על תמונות אמיתיות של קירות טיפוס. בניגוד ל-Spray Wall שמשתמש בתמונה קבועה, מסלולי קהילה מאפשר לכל משתמש להעלות תמונה משלו ולסמן אחיזות עליה.

## Key Features / תכונות עיקריות

### 1. **Temporary Routes (30 Days)** - מסלולים זמניים
- Each route automatically expires after 30 days
- Both the route and its image are automatically deleted
- Users can see how many days are left until expiration
- Routes expiring soon (< 7 days) show a warning badge

### 2. **Real Photo Support** - תמיכה בתמונות אמיתיות
- Users can take a new photo or select from gallery
- Same hold marking system as Spray Wall
- 3 hold types: Start/Top (Red), Middle (Blue), Feet (Yellow)

### 3. **Social Features** - תכונות חברתיות
- Like routes ❤️
- Add comments 💬
- View count tracking 👁️
- See who created the route

### 4. **Filtering & Sorting** - סינון ומיון
- Sort by: Newest, Popular, Expiring Soon
- Optional gym name tagging
- Grade filtering

## File Structure / מבנה הקבצים

```
src/
├── features/
│   └── community-routes/
│       ├── index.ts           # Exports all modules
│       ├── types.ts           # TypeScript interfaces
│       ├── service.ts         # Firebase operations
│       └── hooks.ts           # React hooks
│
├── screens/
│   └── CommunityRoutes/
│       ├── index.ts                        # Exports screens
│       ├── CommunityRoutesListScreen.tsx   # Main list view
│       ├── AddCommunityRouteScreen.tsx     # Create new route
│       └── CommunityRouteDetailScreen.tsx  # View single route
│
├── navigation/
│   ├── CommunityNavigator.tsx   # Stack navigator
│   └── MainTabNavigator.tsx     # Updated with new tab
│
functions/
└── index.js                     # Cloud Functions for auto-cleanup
```

## Firebase Collections / קולקציות Firebase

### communityRoutes
```typescript
{
  id: string;
  imageUrl: string;        // Firebase Storage URL
  imageWidth: number;
  imageHeight: number;
  name: string;
  description?: string;
  grade: string;           // V-grade (VB, V0, V1, etc.)
  holds: Hold[];           // Array of hold positions
  gymName?: string;
  createdBy: string;       // User ID
  creatorName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;    // 30 days after creation
  viewCount: number;
  likeCount: number;
  commentCount: number;
}
```

### communityRouteComments
```typescript
{
  id: string;
  routeId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: Timestamp;
}
```

### communityRouteLikes
```typescript
{
  id: string;              // "{routeId}_{userId}"
  routeId: string;
  userId: string;
  createdAt: Timestamp;
}
```

## Cloud Functions / פונקציות Cloud

### cleanupExpiredCommunityRoutes
- **Schedule:** Daily at 3:00 AM UTC
- **Actions:**
  1. Query routes where `expiresAt < now`
  2. Delete image from Storage
  3. Delete all comments
  4. Delete all likes
  5. Delete route document

### manualCleanupExpiredRoutes
- HTTP endpoint for manual cleanup trigger
- POST request to `/manualCleanupExpiredRoutes`
- Useful for testing or admin operations

## Deployment Steps / שלבי Deployment

### 1. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Storage Rules
```bash
firebase deploy --only storage
```

### 3. Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### 4. Deploy Cloud Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 5. Build and Test App
```bash
npx expo start
```

## Navigation / ניווט

The new tab appears in the bottom tab bar with the icon `images-outline` and label "קהילה" (Community).

Tab order:
1. בית (Home)
2. מפת מסלולים (Routes Map)
3. **קהילה (Community)** ← New!
4. לוח שיאים (Leaderboard)
5. Spray Wall
6. פרופיל (Profile)

## Usage Flow / תהליך שימוש

1. **Open Community Tab** - לחיצה על טאב "קהילה"
2. **Tap + Button** - לחיצה על כפתור ה-+
3. **Select/Take Photo** - בחירת תמונה מהגלריה או צילום
4. **Mark Holds** - סימון אחיזות על התמונה
5. **Add Details** - הזנת שם, דירוג ופרטים
6. **Create Route** - יצירת המסלול

## Best Practices / המלצות

1. **Photo Quality**: Use well-lit, clear photos of the wall section
2. **Naming**: Use descriptive route names
3. **Grading**: Grade conservatively; community feedback will adjust
4. **Holds**: Mark at least 3-4 holds for a meaningful route
5. **Gym Name**: Add gym name for discoverability

## Error Handling / טיפול בשגיאות

- Image upload failures show clear error messages
- Network errors are caught and displayed
- Expired routes gracefully show "Route not found" message
- Delete operations require confirmation

## Future Improvements / שיפורים עתידיים

- [ ] Extend route expiration (pay feature?)
- [ ] Route challenges/competitions
- [ ] Photo zoom during hold marking
- [ ] Route sharing via deep links
- [ ] Top climbers leaderboard per route
- [ ] Save favorite routes locally
