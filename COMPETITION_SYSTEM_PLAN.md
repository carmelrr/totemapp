# 🏆 מערכת תחרויות ולוח שיאים - תכנון ויישום

## 📊 מצב קיים - לוח השיאים

### ניתוח המערכת הנוכחית

**מיקום:** [LeaderboardScreen.tsx](src/screens/social/LeaderboardScreen.tsx)

**מה קיים:**
- מסך לוח שיאים שמציג דירוג משתמשים לפי נקודות
- חישוב נקודות על בסיס דירוג מסלולים שנסגרו (V1=1נק, V2=2נק וכו')
- תצוגת פודיום ל-3 הראשונים
- רשימה של שאר המשתמשים (מקום 4-13)
- הצגת המשתמש הנוכחי עם הדירוג האמיתי שלו

**בעיות שזוהו:**

1. ❌ **ביצועים** - לכל משתמש נעשית שאילתה נפרדת לכל מסלול
   - `calculateUserPoints` עוברת על כל המסלולים בלולאה
   - זמן טעינה ארוך מאוד עם הרבה משתמשים/מסלולים

2. ❌ **חישוב לא יעיל** - אין caching או שמירת נקודות ב-Firestore
   - כל פעם מחשבים מחדש
   - לא ניתן להציג היסטוריה

3. ❌ **פער בין הניקוד לניקוד הליגה הארצית**
   - כרגע: V1=1, V2=2... V10=10
   - הליגה הארצית: V0=100, V1=200... V8=900

4. ⚠️ **אין הפרדה לקטגוריות** (גיל, מגדר, רמה)

5. ⚠️ **אין timeframe filtering** (שבוע/חודש/כל הזמנים)

### שירותי Backend קיימים

- `UserStatsService.ts` - ניהול סטטיסטיקות משתמש
- `FeedbackService.ts` - ניהול פידבק ודירוגים
- `socialService.ts` - `getLeaderboard()` (לא מיושם במלואו)
- `AdminContext.tsx` - ניהול הרשאות אדמין

---

## 🎯 ארכיטקטורת מערכת התחרויות

### סכימת Firebase Collections

```
competitions/
├── {competitionId}/
│   ├── name: string
│   ├── format: "national_league" | "totemtition" | "custom"
│   ├── status: "draft" | "active" | "closed" | "completed"
│   ├── startDate: Timestamp
│   ├── endDate: Timestamp
│   ├── rounds: Round[]
│   ├── settings: CompetitionSettings
│   ├── createdBy: string (adminId)
│   ├── createdAt: Timestamp
│   ├── updatedAt: Timestamp
│   │
│   ├── routes/
│   │   └── {routeNumber}/
│   │       ├── number: number (1-30)
│   │       ├── grade: string (V0-V8)
│   │       ├── basePoints: number (100-900)
│   │       ├── xNorm: number
│   │       ├── yNorm: number
│   │       └── isActive: boolean
│   │
│   ├── participants/
│   │   └── {participantId}/
│   │       ├── name: string
│   │       ├── idNumber?: string (ת.ז.)
│   │       ├── userId?: string (אם משתמש רשום)
│   │       ├── category?: string
│   │       ├── registeredAt: Timestamp
│   │       ├── registeredBy: string (judgeId)
│   │       └── isActive: boolean
│   │
│   ├── results/
│   │   └── {participantId}/
│   │       ├── routes: { [routeNumber]: RouteResult }
│   │       ├── totalPoints: number
│   │       ├── top7Points: number (לליגה ארצית)
│   │       ├── rank: number
│   │       └── lastUpdated: Timestamp
│   │
│   ├── judges/
│   │   └── {judgeId}/
│   │       ├── userId: string
│   │       ├── displayName: string
│   │       ├── addedBy: string (adminId)
│   │       └── addedAt: Timestamp
│   │
│   └── categories/
│       └── {categoryId}/
│           ├── name: string
│           ├── description?: string
│           └── participantIds: string[]

competition_leaderboards/
├── {competitionId}/
│   └── rankings: LeaderboardEntry[]  // מעודכן בזמן אמת
```

### טיפוסי TypeScript

```typescript
// src/features/competitions/types.ts

export type CompetitionFormat = 'national_league' | 'totemtition' | 'custom';
export type CompetitionStatus = 'draft' | 'active' | 'closed' | 'completed';

export interface Competition {
  id: string;
  name: string;
  format: CompetitionFormat;
  status: CompetitionStatus;
  startDate: Date;
  endDate: Date;
  rounds?: Round[];
  settings: CompetitionSettings;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitionSettings {
  maxRoutes: number;                    // 30 לליגה ארצית
  maxAttempts: number;                  // 5 לליגה ארצית
  topRoutesForScoring: number;          // 7 לליגה ארצית
  attemptPenalty: number;               // 10 נקודות לליגה ארצית
  allowSelfEntry: boolean;              // false לליגה ארצית
  judgesOnly: boolean;                  // true לליגה ארצית
  enableCategories: boolean;
  wallImageUrl?: string;
}

export interface Round {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'active' | 'completed';
}

export interface CompetitionRoute {
  number: number;                       // 1-30
  grade: string;                        // V0-V8
  basePoints: number;                   // 100-900
  xNorm: number;
  yNorm: number;
  isActive: boolean;
}

export interface RouteResult {
  routeNumber: number;
  completed: boolean;
  attempts: number;                     // 1-5
  points: number;                       // basePoints - (attempts-1)*10
  enteredBy: string;                    // judgeId
  enteredAt: Date;
}

export interface Participant {
  id: string;
  name: string;
  idNumber?: string;                    // ת.ז.
  userId?: string;                      // אם משתמש רשום
  category?: string;
  registeredAt: Date;
  registeredBy: string;
  isActive: boolean;
}

export interface ParticipantResult {
  participantId: string;
  participantName: string;
  routes: Record<number, RouteResult>;  // routeNumber -> result
  totalPoints: number;
  top7Points: number;                   // לליגה ארצית
  rank: number;
  category?: string;
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  participantName: string;
  points: number;
  category?: string;
  routesCompleted: number;
}

// פורמט תחרוטוטם
export interface TotemtitionRoute extends CompetitionRoute {
  totalPoints: number;                  // 1000 בהתחלה
  completionCount: number;              // כמה אנשים סגרו
  pointsPerCompletion: number;          // 1000 / completionCount
}

export interface Judge {
  id: string;
  userId: string;
  displayName: string;
  addedBy: string;
  addedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  participantIds: string[];
}
```

---

## 🛠️ מבנה קבצים מוצע

```
src/features/competitions/
├── types.ts                           // טיפוסי TypeScript
├── constants.ts                       // קבועים (ניקוד, הגדרות)
├── index.ts                           // export ציבורי
│
├── services/
│   ├── CompetitionService.ts          // CRUD לתחרויות
│   ├── ResultsService.ts              // הזנת וחישוב תוצאות
│   ├── ParticipantService.ts          // ניהול משתתפים
│   ├── JudgeService.ts                // ניהול שופטים
│   └── LeaderboardService.ts          // לידרבורד חי
│
├── screens/
│   ├── CompetitionsListScreen.tsx     // רשימת תחרויות
│   ├── CompetitionDetailScreen.tsx    // פרטי תחרות + לידרבורד
│   ├── CompetitionWallMapScreen.tsx   // מפת קיר לתחרות
│   ├── admin/
│   │   ├── CreateCompetitionScreen.tsx
│   │   ├── ManageCompetitionScreen.tsx
│   │   ├── ManageParticipantsScreen.tsx
│   │   └── ManageJudgesScreen.tsx
│   └── judge/
│       ├── JudgeEntryScreen.tsx       // הזנת תוצאות ע"י שופט
│       └── SelectParticipantScreen.tsx
│
├── components/
│   ├── CompetitionCard.tsx            // כרטיס תחרות ברשימה
│   ├── CompetitionLeaderboard.tsx     // לידרבורד
│   ├── CompetitionRouteMarker.tsx     // מרקר מסלול על מפה
│   ├── ResultEntryForm.tsx            // טופס הזנת תוצאה
│   ├── ParticipantList.tsx            // רשימת משתתפים
│   └── CategoryFilter.tsx             // פילטר לפי קטגוריה
│
├── hooks/
│   ├── useCompetition.ts              // hook לתחרות בודדת
│   ├── useActiveCompetitions.ts       // hook לתחרויות פעילות
│   ├── useCompetitionLeaderboard.ts   // hook ללידרבורד חי
│   └── useJudgePermissions.ts         // hook להרשאות שופט
│
└── utils/
    ├── scoring.ts                     // חישובי ניקוד
    └── validation.ts                  // ולידציות

src/screens/social/
├── LeaderboardScreen.tsx              // משודרג - כולל אזור תחרויות
└── SocialScreen.tsx
```

---

## 📋 תכנית יישום

### Phase 1: תיקון לוח השיאים הקיים

**משימות:**

1. **אופטימיזציה של חישוב הנקודות**
   - שמירת נקודות מחושבות ב-Firestore (users/{userId}/stats)
   - עדכון בזמן אמת כשמוסיפים feedback
   - Cache local עם invalidation

2. **שיפור ה-UI**
   - הוספת מצב טעינה מתאים
   - הוספת פילטר timeframe (שבוע/חודש/הכל)
   - אנימציות חלקות יותר

3. **הוספת קטגוריות בסיסיות**
   - פילטר לפי מגדר (אם קיים בפרופיל)
   - פילטר לפי דירוג ממוצע

### Phase 2: תשתית תחרויות

**משימות:**

1. **יצירת מודל הנתונים**
   - הגדרת Collections ב-Firestore
   - כתיבת Security Rules
   - יצירת TypeScript types

2. **שירותי Backend**
   - CompetitionService - CRUD
   - ParticipantService
   - JudgeService

3. **אדמין בסיסי**
   - מסך יצירת תחרות
   - הגדרת פורמט וחוקים
   - הוספת שופטים

### Phase 3: פורמט ליגה ארצית

**משימות:**

1. **הגדרת מסלולים**
   - מפת קיר לתחרות
   - סימון מסלולים עם מספרים
   - הגדרת דרגות קושי

2. **ניהול משתתפים**
   - רישום משתתפים ע"י שופטים
   - קטגוריות (גיל/מגדר)
   - הצגת רשימה לכל שופטים

3. **הזנת תוצאות**
   - ממשק שופט
   - בחירת משתתף
   - סימון מסלול + ניסיונות

4. **חישוב ולידרבורד**
   - חישוב TOP7
   - דירוג לפי קטגוריה
   - עדכון בזמן אמת

### Phase 4: פורמט תחרוטוטם

**משימות:**

1. **לוגיקת ניקוד דינמי**
   - 1000 נקודות לחלוקה
   - עדכון בזמן אמת
   - חישוב מחדש עם כל סגירה

2. **הזנה עצמית**
   - כל משתמש יכול לסמן סגירה
   - אימות (אופציונלי)

### Phase 5: אינטגרציה

**משימות:**

1. **שילוב עם לוח השיאים**
   - הצגת תחרות פעילה בראש המסך
   - מעבר חלק בין מצבים
   - שינוי שם הטאב כשיש תחרות

2. **התראות**
   - התחלת תחרות
   - עדכון דירוג
   - סיום תחרות

---

## 🎨 עיצוב UI/UX

### מסך לוח שיאים משודרג

```
┌─────────────────────────────────────┐
│  🏆 לוח שיאים / תחרויות            │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  🔥 תחרות פעילה!               │ │
│ │  ליגה ארצית - סבב 3             │ │
│ │  ⏱️ נותרו 2 שעות               │ │
│ │         [הצג לידרבורד]         │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  [שבוע] [חודש] [הכל]              │
├─────────────────────────────────────┤
│                                     │
│      🥈2      🥇1      🥉3         │
│     ┌───┐   ┌─────┐   ┌───┐       │
│     │   │   │     │   │   │       │
│     └───┘   └─────┘   └───┘       │
│    אליס     בוב      צ'רלי       │
│    890     1250      670          │
│                                     │
├─────────────────────────────────────┤
│  שאר המקומות                       │
│  ───────────────────────────────   │
│  4. דני          520 נק'          │
│  5. אלי          480 נק'          │
│  ...                               │
└─────────────────────────────────────┘
```

### מסך לידרבורד תחרות

```
┌─────────────────────────────────────┐
│  ← ליגה ארצית - סבב 3              │
├─────────────────────────────────────┤
│  ⏱️ נותרו 1:45:32                  │
│  👥 48 משתתפים | 🏔️ 30 מסלולים    │
├─────────────────────────────────────┤
│  [כללי] [גברים] [נשים] [נוער]     │
├─────────────────────────────────────┤
│  #  שם           מסלולים  נקודות  │
│  ───────────────────────────────   │
│  1  אורי כהן      7/7     5840    │
│  2  מאיה לוי      7/7     5690    │
│  3  דני שרון      6/7     5420    │
│  4  ליאור גל      7/7     5380    │
│  ...                               │
├─────────────────────────────────────┤
│  📍 המיקום שלך: #12 | 4,230 נק'   │
└─────────────────────────────────────┘
```

### מסך הזנת תוצאות (שופט)

```
┌─────────────────────────────────────┐
│  ← הזנת תוצאות                     │
├─────────────────────────────────────┤
│  משתתף: אורי כהן                   │
│  קטגוריה: גברים 18+                │
├─────────────────────────────────────┤
│                                     │
│     [תמונת מפת קיר עם מסלולים]     │
│     ⭕1  ⭕2  ✅3  ⭕4  ...         │
│                                     │
├─────────────────────────────────────┤
│  מסלול 3 - V6 (700 נק')            │
│                                     │
│  ניסיונות: [1] [2] [3] [4] [5]    │
│            ✓                        │
│                                     │
│  ניקוד: 690 (700 - 10)             │
│                                     │
│         [שמור תוצאה]               │
└─────────────────────────────────────┘
```

---

## 🔒 Security Rules

```javascript
// competitions collection
match /competitions/{competitionId} {
  // כל אחד יכול לקרוא תחרויות
  allow read: if true;
  
  // רק אדמין יכול ליצור/לערוך תחרות
  allow create, update, delete: if isAdmin();
  
  // routes sub-collection
  match /routes/{routeId} {
    allow read: if true;
    allow write: if isAdmin();
  }
  
  // participants sub-collection
  match /participants/{participantId} {
    allow read: if true;
    // שופטים יכולים להוסיף/לערוך משתתפים
    allow create, update: if isJudge(competitionId);
    allow delete: if isAdmin();
  }
  
  // results sub-collection
  match /results/{participantId} {
    allow read: if true;
    // רק שופטים יכולים להזין תוצאות
    allow write: if isJudge(competitionId);
  }
  
  // judges sub-collection
  match /judges/{judgeId} {
    allow read: if true;
    allow write: if isAdmin();
  }
}

function isAdmin() {
  return request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}

function isJudge(competitionId) {
  return request.auth != null &&
    exists(/databases/$(database)/documents/competitions/$(competitionId)/judges/$(request.auth.uid));
}
```

---

## 📊 ניקוד - פורמט ליגה ארצית

```typescript
// src/features/competitions/constants.ts

export const NATIONAL_LEAGUE_POINTS: Record<string, number> = {
  'V0': 100,
  'V1': 200,
  'V2': 300,
  'V3': 400,
  'V4': 500,
  'V5': 600,
  'V6': 700,
  'V7': 800,
  'V8': 900,
};

export const NATIONAL_LEAGUE_SETTINGS = {
  maxRoutes: 30,
  maxAttempts: 5,
  topRoutesForScoring: 7,
  attemptPenalty: 10,        // נקודות פחות לכל ניסיון נוסף
  judgesOnly: true,
  allowSelfEntry: false,
};

// חישוב ניקוד למסלול
export function calculateRoutePoints(
  grade: string, 
  attempts: number
): number {
  const basePoints = NATIONAL_LEAGUE_POINTS[grade] || 0;
  const penalty = (attempts - 1) * NATIONAL_LEAGUE_SETTINGS.attemptPenalty;
  return Math.max(0, basePoints - penalty);
}

// חישוב TOP7
export function calculateTop7Points(
  routeResults: Record<number, RouteResult>
): number {
  const completedRoutes = Object.values(routeResults)
    .filter(r => r.completed)
    .sort((a, b) => b.points - a.points);
  
  const top7 = completedRoutes.slice(0, 7);
  return top7.reduce((sum, r) => sum + r.points, 0);
}
```

---

## 🔄 סדר יישום מומלץ

### שלב 1 (שבוע 1-2): תיקון הקיים ✅ הושלם חלקית
- [x] אופטימיזציה של `calculateUserPoints` - נוסף filtering לפי זמן
- [x] מצבי טעינה ו-error handling
- [x] פילטר timeframe בסיסי (שבוע/חודש/הכל)
- [ ] שמירת נקודות ב-Firestore (נדרש Cloud Function)

### שלב 2 (שבוע 3-4): תשתית ✅ הושלם
- [x] הגדרת Types ו-Interfaces (`types.ts`)
- [x] יצירת Constants ו-Scoring functions (`constants.ts`)
- [x] Security Rules (`firestore-competition-rules.rules`)
- [x] CompetitionService בסיסי
- [x] ResultsService 
- [x] ParticipantService
- [x] JudgeService
- [x] CompetitionRoutesService
- [x] React Hooks לתחרויות

### שלב 3 (שבוע 5-6): אדמין
- [ ] מסך יצירת תחרות
- [ ] ניהול שופטים
- [ ] מפת קיר לתחרות

### שלב 4 (שבוע 7-8): פונקציונליות ליבה
- [ ] הזנת משתתפים
- [ ] הזנת תוצאות (שופטים)
- [ ] לידרבורד חי
- [ ] קטגוריות

### שלב 5 (שבוע 9-10): שיפורים
- [ ] פורמט תחרוטוטם
- [ ] אינטגרציה עם לוח השיאים
- [ ] התראות
- [ ] בדיקות ותיקונים

---

## 📁 קבצים שנוצרו

### תשתית
- `src/features/competitions/types.ts` - טיפוסי TypeScript
- `src/features/competitions/constants.ts` - קבועים וחישובי ניקוד
- `src/features/competitions/index.ts` - exports ציבוריים

### שירותים
- `src/features/competitions/services/CompetitionService.ts` - CRUD לתחרויות
- `src/features/competitions/services/ResultsService.ts` - הזנת וחישוב תוצאות
- `src/features/competitions/services/ParticipantService.ts` - ניהול משתתפים
- `src/features/competitions/services/JudgeService.ts` - ניהול שופטים
- `src/features/competitions/services/CompetitionRoutesService.ts` - מסלולי תחרות

### Hooks
- `src/features/competitions/hooks/useCompetition.ts` - React hooks

### רכיבים
- `src/features/competitions/components/ActiveCompetitionBanner.tsx` - באנר תחרות פעילה
- `src/features/competitions/components/CompetitionLeaderboard.tsx` - לידרבורד תחרות

### מסכים
- `src/screens/social/LeaderboardScreenV2.tsx` - לוח שיאים משודרג

### אבטחה
- `firestore-competition-rules.rules` - חוקי אבטחה לתחרויות

---

## 🚀 צעדים הבאים

1. **לאשר את הארכיטקטורה** - לעבור על התכנית ולאשר
2. **להתחיל בתיקון לוח השיאים** - שיפורי ביצועים ו-UX
3. **ליצור את מבנה הקבצים** - feature folder לתחרויות
4. **לבנות Types ו-Services** - שכבת הנתונים
5. **לפתח UI בהדרגה** - מסך אחרי מסך

---

*מסמך זה מתאר את הארכיטקטורה והתכנית ליישום מערכת תחרויות מלאה.*
*עודכן לאחרונה: ינואר 2026*
