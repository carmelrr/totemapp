// הגדרת מנהל ראשון - עם אימות
// הפעל קוד זה אחרי שיצרת משתמש באפליקציה

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDCClgfCWH9megeAsPydnR9MknrbSV2ToM",
  authDomain: "totemapp-464009.firebaseapp.com",
  projectId: "totemapp-464009",
  storageBucket: "totemapp-464009.firebasestorage.app",
  messagingSenderId: "720872675049",
  appId: "1:720872675049:web:410665ffdf49999f07c278",
  measurementId: "G-2T1NVDPG50"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// פונקציה להגדרת מנהל ראשון עם אימות
async function setupFirstAdminWithAuth() {
  const adminEmail = 'carmel@razromeo.net'; // החלף עם המייל שלך
  const adminPassword = 'bigdaddy1'; // החלף עם הסיסמה שלך
  const adminDisplayName = 'CarmelRR'; // החלף עם השם שלך

  try {
    // התחבר למשתמש
    console.log('מתחבר למשתמש...');
    const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    const user = userCredential.user;
    
    console.log('התחברות הצליחה! UID:', user.uid);

    // הגדר נתוני מנהל
    const adminData = {
      email: adminEmail,
      displayName: adminDisplayName,
      isAdmin: true,
      createdAt: serverTimestamp(),
      privacy: {
        showProfile: true,
        showTotalRoutes: true,
        showHighestGrade: true,
        showFeedbackCount: true,
        showAverageRating: true,
        showGradeStats: true,
        showJoinDate: true
      },
      stats: {
        totalRoutesSent: 0,
        highestGrade: null,
        totalFeedbacks: 0,
        averageStarRating: 0
      }
    };

    // שמור נתוני מנהל
    await setDoc(doc(db, 'users', user.uid), adminData);
    console.log('✅ מנהל ראשון הוגדר בהצלחה!');
    console.log('עכשיו תוכל להתחבר לאפליקציה עם הרשאות מנהל');
    console.log('UID שלך:', user.uid);
    
  } catch (error) {
    console.error('❌ שגיאה בהגדרת המנהל:', error);
    if (error.code === 'auth/user-not-found') {
      console.log('💡 הצעה: צור קודם משתמש באפליקציה עם המייל הזה');
    }
    if (error.code === 'auth/wrong-password') {
      console.log('💡 הצעה: בדוק את הסיסמה');
    }
  }
}

// הוראות שימוש:
// 1. פתח את האפליקציה וצור משתמש חדש עם המייל והסיסמה שלך
// 2. החלף את adminEmail, adminPassword ו-adminDisplayName בקוד למעלה
// 3. הפעל: node setup-first-admin-with-auth.js

console.log('⚠️  עצור! לפני הפעלת הקוד:');
console.log('1. פתח את האפליקציה וצור משתמש חדש');
console.log('2. עדכן את adminEmail, adminPassword ו-adminDisplayName בקוד');
console.log('3. הפעל שוב את הסקריפט');
console.log('');
console.log('אם עדכנת את הנתונים, הסר את ההערה מהשורה הבאה:');
console.log('// setupFirstAdminWithAuth();');

// הסר את ההערה מהשורה הבאה אחרי שעדכנת את הנתונים:
setupFirstAdminWithAuth();
