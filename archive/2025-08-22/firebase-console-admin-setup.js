// העתק את הקוד הזה ל-Firebase Console > Firestore > לשונית "Rules" > Console
// לחץ על "Switch to Console tab" ולחסום את הקוד

// הגדרת מנהל ראשון - להפעלה ב-Firebase Console
const adminUserId = "3wMPGiXFKmRmLzmU60DV8nLbiXC3"; // החלף עם ה-UID האמיתי שלך
const adminData = {
  email: "carmel@razroemo.net", // החלף עם המייל שלך
  displayName: "CarmelRR", // החלף עם השם שלך
  isAdmin: true,
  createdAt: firebase.firestore.Timestamp.now(),
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

// הפעל את הקוד הזה:
firebase
  .firestore()
  .collection("users")
  .doc(adminUserId)
  .set(adminData)
  .then(() => {
    console.log("✅ מנהל ראשון הוגדר בהצלחה!");
    console.log("עכשיו תוכל להתחבר לאפליקציה עם הרשאות מנהל");
  })
  .catch((error) => {
    console.error("❌ שגיאה בהגדרת המנהל:", error);
  });

// הוראות:
// 1. עבור ל-Firebase Console: https://console.firebase.google.com/project/totemapp-464009/firestore
// 2. לחץ על לשונית "Rules"
// 3. בחלק התחתון תמצא "Console" tab
// 4. העתק את הקוד הזה ושים אותו שם
// 5. החלף את adminUserId עם ה-UID האמיתי שלך (תוכל לגלות אותו ב-Authentication > Users)
// 6. החלף את email ו-displayName עם הנתונים שלך
// 7. הפעל את הקוד
