import { auth, db } from "@/features/data/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import type { UserStats, GradeStatsMap } from "../types";

export async function fetchUserStats(userId: string): Promise<UserStats> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("User not authenticated");
  }

  try {
    // חישוב סטטיסטיקות בזמן אמת מכל המסלולים (כולל ארכיון)
    const allTimeStats = await calculateAllTimeStats(userId);
    
    // חישוב אחוז סגירה מהמסלולים הפעילים בלבד
    const completionPercentage = await calculateActiveRoutesCompletionPercentage(userId);

    const userDoc = await getDoc(doc(db, "users", userId));
    let joinDate: Date | null = null;
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      joinDate = userData.createdAt
        ? new Date(userData.createdAt.seconds * 1000)
        : new Date(user.metadata.creationTime);
    } else {
      joinDate = new Date(user.metadata.creationTime);
    }

    return {
      totalRoutesSent: allTimeStats.totalRoutesSent,
      highestGrade: allTimeStats.highestGrade,
      totalFeedbacks: allTimeStats.totalFeedbacks,
      averageStarRating: allTimeStats.averageStarRating,
      completionPercentage,
      joinDate,
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    throw error;
  }
}

/**
 * Fetch stats for any user (including other users, not just the current authenticated user)
 * Used for viewing other user profiles
 */
export async function fetchOtherUserStats(userId: string): Promise<UserStats> {
  try {
    // חישוב סטטיסטיקות בזמן אמת מכל המסלולים (כולל ארכיון)
    const allTimeStats = await calculateAllTimeStats(userId);
    
    // חישוב אחוז סגירה מהמסלולים הפעילים בלבד
    const completionPercentage = await calculateActiveRoutesCompletionPercentage(userId);

    const userDoc = await getDoc(doc(db, "users", userId));
    let joinDate: Date | null = null;
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      joinDate = userData.createdAt
        ? new Date(userData.createdAt.seconds * 1000)
        : null;
    }

    return {
      totalRoutesSent: allTimeStats.totalRoutesSent,
      highestGrade: allTimeStats.highestGrade,
      totalFeedbacks: allTimeStats.totalFeedbacks,
      averageStarRating: allTimeStats.averageStarRating,
      completionPercentage,
      joinDate,
    };
  } catch (error) {
    console.error("Error fetching other user stats:", error);
    throw error;
  }
}

// חישוב סטטיסטיקות מכל המסלולים שהמשתמש אי פעם סגר (כולל ארכיון)
async function calculateAllTimeStats(userId: string): Promise<{
  totalRoutesSent: number;
  highestGrade: string;
  totalFeedbacks: number;
  averageStarRating: number;
}> {
  try {
    // קודם נקבל את כל המסלולים כדי לדעת את הגריידים שלהם
    const routesSnapshot = await getDocs(collection(db, "routes"));
    const routesMap = new Map<string, any>();
    routesSnapshot.docs.forEach(doc => {
      routesMap.set(doc.id, doc.data());
    });
    
    // מחפשים פידבקים באוסף routeFeedbacks (לא subcollection)
    const feedbacksRef = collection(db, "routeFeedbacks");
    const userFeedbackQuery = query(
      feedbacksRef,
      where("userId", "==", userId)
    );
    const userFeedbackSnapshot = await getDocs(userFeedbackQuery);
    
    let totalRoutesSent = 0;
    let totalFeedbacks = 0;
    let starRatings: number[] = [];
    let completedGrades: string[] = [];

    const gradeValues: Record<string, number> = {
      V1: 1, V2: 2, V3: 3, V4: 4, V5: 5,
      V6: 6, V7: 7, V8: 8, V9: 9, V10: 10,
      V11: 11, V12: 12, V13: 13, V14: 14, V15: 15,
    };

    userFeedbackSnapshot.forEach((feedbackDoc) => {
      const feedback = feedbackDoc.data();
      totalFeedbacks++;

      // בודקים גם isCompleted וגם closedRoute כי יש שני שדות בשימוש
      const isRouteCompleted = feedback.isCompleted === true || feedback.closedRoute === true;
      
      if (isRouteCompleted) {
        totalRoutesSent++;
        // שומרים את הגרייד של המסלול שנסגר
        const routeData = routesMap.get(feedback.routeId);
        if (routeData?.grade) {
          completedGrades.push(routeData.grade);
        }
      }

      if (feedback.starRating) {
        starRatings.push(feedback.starRating);
      }
    });

    // חישוב הדירוג הגבוה ביותר מהמסלולים שנסגרו
    let highestGrade = "N/A";
    if (completedGrades.length > 0) {
      highestGrade = completedGrades.reduce((highest, current) => {
        return (gradeValues[current] || 0) > (gradeValues[highest] || 0)
          ? current
          : highest;
      });
    }

    // חישוב דירוג כוכבים ממוצע
    const averageStarRating =
      starRatings.length > 0
        ? starRatings.reduce((sum, rating) => sum + rating, 0) / starRatings.length
        : 0;

    console.log(`[Stats] All-time stats: ${totalRoutesSent} routes completed, highest grade: ${highestGrade}`);

    return {
      totalRoutesSent,
      highestGrade,
      totalFeedbacks,
      averageStarRating,
    };
  } catch (error) {
    console.error("Error calculating all-time stats:", error);
    return {
      totalRoutesSent: 0,
      highestGrade: "N/A",
      totalFeedbacks: 0,
      averageStarRating: 0,
    };
  }
}

// חישוב אחוז סגירה מהמסלולים שעל הקיר כרגע
// מסלול נחשב "על הקיר" אם status === 'active' או אם אין לו status (ברירת מחדל)
async function calculateActiveRoutesCompletionPercentage(userId: string): Promise<number> {
  try {
    // קבל את כל המסלולים ונסנן מקומית
    const allRoutesSnapshot = await getDocs(collection(db, "routes"));
    
    // סנן מסלולים פעילים (status === 'active' או status לא קיים/undefined)
    const activeRoutes = allRoutesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.status || data.status === 'active';
    });
    
    if (activeRoutes.length === 0) {
      console.log('[Stats] No active routes found');
      return 0;
    }
    
    console.log(`[Stats] Found ${activeRoutes.length} active routes`);
    
    // קבל את כל הפידבקים של המשתמש מאוסף routeFeedbacks
    const feedbacksRef = collection(db, "routeFeedbacks");
    const userFeedbackQuery = query(
      feedbacksRef,
      where("userId", "==", userId)
    );
    const userFeedbackSnapshot = await getDocs(userFeedbackQuery);
    
    // יוצרים set של מזהי מסלולים שהמשתמש סגר
    const completedRouteIds = new Set<string>();
    userFeedbackSnapshot.forEach(doc => {
      const data = doc.data();
      const isCompleted = data.isCompleted === true || data.closedRoute === true;
      if (isCompleted && data.routeId) {
        completedRouteIds.add(data.routeId);
      }
    });
    
    // סופרים כמה מהמסלולים הפעילים המשתמש סגר
    let completedCount = 0;
    for (const routeDoc of activeRoutes) {
      if (completedRouteIds.has(routeDoc.id)) {
        completedCount++;
        console.log(`[Stats] User completed route: ${routeDoc.id}`);
      }
    }
    
    const percentage = Math.round((completedCount / activeRoutes.length) * 100);
    console.log(`[Stats] Completion: ${completedCount}/${activeRoutes.length} = ${percentage}%`);
    
    return percentage;
  } catch (error) {
    console.error("Error calculating active routes completion:", error);
    return 0;
  }
}

export async function initializeUserStats(userId: string): Promise<UserStats> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("User not authenticated");
  }

  try {
    // קודם נקבל את כל המסלולים כדי לדעת את הגריידים שלהם
    const routesSnapshot = await getDocs(collection(db, "routes"));
    const routesMap = new Map<string, any>();
    routesSnapshot.docs.forEach(doc => {
      routesMap.set(doc.id, doc.data());
    });

    // מחפשים פידבקים באוסף routeFeedbacks (לא subcollection)
    const feedbacksRef = collection(db, "routeFeedbacks");
    const userFeedbackQuery = query(
      feedbacksRef,
      where("userId", "==", userId)
    );
    const userFeedbackSnapshot = await getDocs(userFeedbackQuery);

    let totalRoutesSent = 0;
    let totalFeedbacks = 0;
    let starRatings: number[] = [];
    let completedGrades: string[] = [];

    userFeedbackSnapshot.forEach((feedbackDoc) => {
      const feedback = feedbackDoc.data();
      totalFeedbacks++;

      const isRouteCompleted = feedback.isCompleted === true || feedback.closedRoute === true;
      
      if (isRouteCompleted) {
        totalRoutesSent++;
        const routeData = routesMap.get(feedback.routeId);
        if (routeData?.grade) {
          completedGrades.push(routeData.grade);
        }
      }

      if (feedback.starRating) {
        starRatings.push(feedback.starRating);
      }
    });

    // Calculate highest grade - מהמסלולים שנסגרו בלבד
    const gradeValues: Record<string, number> = {
      V1: 1, V2: 2, V3: 3, V4: 4, V5: 5,
      V6: 6, V7: 7, V8: 8, V9: 9, V10: 10,
      V11: 11, V12: 12, V13: 13, V14: 14, V15: 15,
    };

    let highestGrade = "N/A";
    if (completedGrades.length > 0) {
      highestGrade = completedGrades.reduce((highest, current) => {
        return (gradeValues[current] || 0) > (gradeValues[highest] || 0)
          ? current
          : highest;
      });
    }

    // Calculate average star rating
    const averageStarRating =
      starRatings.length > 0
        ? starRatings.reduce((sum, rating) => sum + rating, 0) / starRatings.length
        : 0;

    // חישוב אחוז סגירה מהמסלולים הפעילים
    const completionPercentage = await calculateActiveRoutesCompletionPercentage(userId);

    const joinDate = new Date(user.metadata.creationTime);

    const initialStats: UserStats = {
      totalRoutesSent,
      highestGrade,
      totalFeedbacks,
      averageStarRating,
      completionPercentage,
      joinDate,
    };

    // Save initial stats to user document
    await setDoc(
      doc(db, "users", userId),
      {
        stats: {
          totalRoutesSent,
          highestGrade,
          totalFeedbacks,
          averageStarRating,
        },
        createdAt: user.metadata.creationTime,
      },
      { merge: true },
    );

    return initialStats;
  } catch (error) {
    console.error("Error initializing user stats:", error);
    throw error;
  }
}

export async function calculateGradeStats(userId: string): Promise<{ routes: any[]; gradeStats: GradeStatsMap }> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("User not authenticated");
  }

  try {
    // Get all routes
    const routesSnapshot = await getDocs(collection(db, "routes"));
    const allRoutes: any[] = [];
    routesSnapshot.forEach((doc) => {
      allRoutes.push({ id: doc.id, ...doc.data() });
    });

    // סינון מסלולים פעילים בלבד (על הקיר כרגע)
    const activeRoutes = allRoutes.filter(route => !route.status || route.status === 'active');

    // Count routes by grade - רק מסלולים פעילים
    const routesByGrade: Record<string, number> = {};
    activeRoutes.forEach((route) => {
      const grade = route.grade || "לא מוגדר";
      routesByGrade[grade] = (routesByGrade[grade] || 0) + 1;
    });

    // קבל את כל הפידבקים של המשתמש מאוסף routeFeedbacks
    const feedbacksRef = collection(db, "routeFeedbacks");
    const userFeedbackQuery = query(
      feedbacksRef,
      where("userId", "==", userId)
    );
    const userFeedbackSnapshot = await getDocs(userFeedbackQuery);
    
    // יוצרים set של מזהי מסלולים שהמשתמש סגר
    const completedRouteIds = new Set<string>();
    userFeedbackSnapshot.forEach(doc => {
      const data = doc.data();
      const isCompleted = data.isCompleted === true || data.closedRoute === true;
      if (isCompleted && data.routeId) {
        completedRouteIds.add(data.routeId);
      }
    });

    // Count completed routes by grade - רק מסלולים פעילים
    const completedByGrade: Record<string, number> = {};
    for (const route of activeRoutes) {
      if (completedRouteIds.has(route.id)) {
        const grade = route.grade || "לא מוגדר";
        completedByGrade[grade] = (completedByGrade[grade] || 0) + 1;
      }
    }

    // Calculate percentages - רק לפי מסלולים פעילים
    const gradeStats: GradeStatsMap = {};
    Object.keys(routesByGrade).forEach((grade) => {
      const total = routesByGrade[grade];
      const completed = completedByGrade[grade] || 0;
      const percentage = total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0;

      gradeStats[grade] = {
        total,
        completed,
        percentage,
      };
    });

    // מחזירים את המסלולים הפעילים בלבד לתצוגה
    return { routes: activeRoutes, gradeStats };
  } catch (error) {
    console.error("Error calculating grade stats:", error);
    throw error;
  }
}
