// הגדרת מנהל ראשון - הפעל קוד זה פעם אחת אחרי יצירת המשתמש הראשון
// קובץ זה לא חלק מהאפליקציה - הוא רק לעזרה בהגדרה ראשונית

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCClgfCWH9megeAsPydnR9MknrbSV2ToM",
  authDomain: "totemapp-464009.firebaseapp.com",
  projectId: "totemapp-464009",
  storageBucket: "totemapp-464009.firebasestorage.app",
  messagingSenderId: "720872675049",
  appId: "1:720872675049:web:410665ffdf49999f07c278",
  measurementId: "G-2T1NVDPG50",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// פונקציה להגדרת מנהל ראשון
async function setupFirstAdmin() {
  const adminUserId = "3wMPGiXFKmRmLzmU60DV8nLbiXC3"; // החלף עם ה-UID האמיתי שלך
  const adminData = {
    email: "carmel@razromeo.net", // החלף עם המייל שלך
    displayName: "CarmelRR", // החלף עם השם שלך
    isAdmin: true,
    createdAt: serverTimestamp(),
    privacy: {
      showProfile: true,
      showTotalRoutes: true,
      showHighestGrade: true,
      showFeedbackCount: true,
      showAverageRating: true,
      showGradeStats: true,
      showJoinDate: true,
    },
    stats: {
      totalRoutesSent: 0,
      highestGrade: null,
      totalFeedbacks: 0,
      averageStarRating: 0,
    },
  };

  try {
    await setDoc(doc(db, "users", adminUserId), adminData);
    console.log("✅ מנהל ראשון הוגדר בהצלחה!");
    console.log("עכשיו תוכל להתחבר לאפליקציה עם הרשאות מנהל");
  } catch (error) {
    console.error("❌ שגיאה בהגדרת המנהל:", error);
  }
}

// כדי להפעיל את הפונקציה:
// 1. התקן את firebase: npm install firebase
// 2. הפעל את הקובץ: node setup-first-admin.js
// 3. או העתק את הקוד ל-browser console ב-Firebase Console

// אם אתה רוצה להפעיל ישירות:
setupFirstAdmin();
