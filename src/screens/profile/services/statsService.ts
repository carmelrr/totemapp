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
    const userDoc = await getDoc(doc(db, "users", userId));
    
    // חישוב אחוז סגירה מהמסלולים הפעילים בלבד
    const completionPercentage = await calculateActiveRoutesCompletionPercentage(userId);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const persistentStats = userData.stats || {};

      return {
        totalRoutesSent: persistentStats.totalRoutesSent || 0,
        highestGrade: persistentStats.highestGrade || "N/A",
        totalFeedbacks: persistentStats.totalFeedbacks || 0,
        averageStarRating: persistentStats.averageStarRating || 0,
        completionPercentage,
        joinDate: userData.createdAt
          ? new Date(userData.createdAt.seconds * 1000)
          : new Date(user.metadata.creationTime),
      };
    } else {
      // Initialize user stats if document doesn't exist
      return await initializeUserStats(userId);
    }
  } catch (error) {
    console.error("Error fetching user stats:", error);
    throw error;
  }
}

// חישוב אחוז סגירה מהמסלולים שעל הקיר כרגע
// מסלול נחשב "על הקיר" אם status === 'active' או אם אין לו status (ברירת מחדל)
async function calculateActiveRoutesCompletionPercentage(userId: string): Promise<number> {
  try {
    // קבל את כל המסלולים ונסנן מקומית
    // זה כי Firestore לא תומך ב-OR queries או ב-checking for null/missing fields בקלות
    const allRoutesSnapshot = await getDocs(collection(db, "routes"));
    
    // סנן מסלולים פעילים (status === 'active' או status לא קיים/undefined)
    const activeRoutes = allRoutesSnapshot.docs.filter(doc => {
      const data = doc.data();
      // מסלול פעיל אם: אין לו status, או status הוא 'active', או status הוא undefined/null
      return !data.status || data.status === 'active';
    });
    
    if (activeRoutes.length === 0) {
      console.log('[Stats] No active routes found');
      return 0;
    }
    
    console.log(`[Stats] Found ${activeRoutes.length} active routes`);
    
    let completedCount = 0;
    
    // בדוק כמה מהמסלולים הפעילים המשתמש סגר
    for (const routeDoc of activeRoutes) {
      const feedbacksRef = collection(db, "routes", routeDoc.id, "feedbacks");
      const userFeedbackQuery = query(
        feedbacksRef,
        where("userId", "==", userId),
        where("closedRoute", "==", true)
      );
      const userFeedbackSnapshot = await getDocs(userFeedbackQuery);
      
      if (!userFeedbackSnapshot.empty) {
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
    const feedbacksQuery = query(collection(db, "routes"));
    const routesSnapshot = await getDocs(feedbacksQuery);

    let totalRoutesSent = 0;
    let totalFeedbacks = 0;
    let starRatings: number[] = [];
    let closedRouteGrades: string[] = [];

    // Process each wall map route
    for (const routeDoc of routesSnapshot.docs) {
      const routeData = routeDoc.data();
      const feedbacksRef = collection(db, "routes", routeDoc.id, "feedbacks");
      const userFeedbackQuery = query(
        feedbacksRef,
        where("userId", "==", userId),
      );
      const userFeedbackSnapshot = await getDocs(userFeedbackQuery);

      userFeedbackSnapshot.forEach((feedbackDoc) => {
        const feedback = feedbackDoc.data();
        totalFeedbacks++;

        if (feedback.closedRoute) {
          totalRoutesSent++;
          // שמור את הדירוג של המסלול שנסגר (דירוג מחושב או דירוג מקורי)
          const routeGrade = routeData.calculatedGrade || routeData.grade;
          if (routeGrade) {
            closedRouteGrades.push(routeGrade);
          }
        }

        if (feedback.starRating) {
          starRatings.push(feedback.starRating);
        }
      });
    }

    // Also process spray wall routes
    const sprayRoutesSnapshot = await getDocs(collection(db, "sprayRoutes"));
    for (const sprayRouteDoc of sprayRoutesSnapshot.docs) {
      const sprayRouteData = sprayRouteDoc.data();
      const feedbacksRef = collection(db, "sprayRoutes", sprayRouteDoc.id, "feedbacks");
      const userFeedbackQuery = query(
        feedbacksRef,
        where("userId", "==", userId),
      );
      const userFeedbackSnapshot = await getDocs(userFeedbackQuery);

      userFeedbackSnapshot.forEach((feedbackDoc) => {
        const feedback = feedbackDoc.data();
        totalFeedbacks++;

        if (feedback.closedRoute) {
          totalRoutesSent++;
          // שמור את הדירוג של מסלול הספריי שנסגר
          const sprayGrade = sprayRouteData.calculatedGrade || sprayRouteData.grade;
          if (sprayGrade) {
            closedRouteGrades.push(sprayGrade);
          }
        }

        if (feedback.starRating) {
          starRatings.push(feedback.starRating);
        }
      });
    }

    // Calculate highest grade from all closed routes
    const gradeValues: Record<string, number> = {
      VB: 0, V0: 0.5,
      V1: 1, V2: 2, V3: 3, V4: 4, V5: 5,
      V6: 6, V7: 7, V8: 8, V9: 9, V10: 10, V11: 11, V12: 12,
    };

    let highestGrade = "N/A";
    if (closedRouteGrades.length > 0) {
      const validGrades = closedRouteGrades.filter((grade) => grade && gradeValues[grade] !== undefined);
      if (validGrades.length > 0) {
        highestGrade = validGrades.reduce((highest, current) => {
          return (gradeValues[current] || 0) > (gradeValues[highest] || 0)
            ? current
            : highest;
        });
      }
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
    // Get all wall map routes
    const routesSnapshot = await getDocs(collection(db, "routes"));
    const routes: any[] = [];
    routesSnapshot.forEach((doc) => {
      routes.push({ id: doc.id, ...doc.data(), type: 'wallmap' });
    });

    // Get all spray wall routes
    const sprayRoutesSnapshot = await getDocs(collection(db, "sprayRoutes"));
    sprayRoutesSnapshot.forEach((doc) => {
      routes.push({ id: doc.id, ...doc.data(), type: 'spray' });
    });

    // Count routes by grade
    const routesByGrade: Record<string, number> = {};
    routes.forEach((route) => {
      const grade = route.grade || "לא מוגדר";
      routesByGrade[grade] = (routesByGrade[grade] || 0) + 1;
    });

    // Count completed routes by grade
    const completedByGrade: Record<string, number> = {};

    for (const route of routes) {
      const collectionName = route.type === 'spray' ? "sprayRoutes" : "routes";
      const feedbacksRef = collection(db, collectionName, route.id, "feedbacks");
      const userFeedbackQuery = query(
        feedbacksRef,
        where("userId", "==", userId),
        where("closedRoute", "==", true),
      );
      const userFeedbackSnapshot = await getDocs(userFeedbackQuery);

      if (!userFeedbackSnapshot.empty) {
        const grade = route.grade || "לא מוגדר";
        completedByGrade[grade] = (completedByGrade[grade] || 0) + 1;
      }
    }

    // Calculate percentages
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

    return { routes, gradeStats };
  } catch (error) {
    console.error("Error calculating grade stats:", error);
    throw error;
  }
}
