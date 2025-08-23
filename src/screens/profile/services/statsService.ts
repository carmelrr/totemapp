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

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const persistentStats = userData.stats || {};

      return {
        totalRoutesSent: persistentStats.totalRoutesSent || 0,
        highestGrade: persistentStats.highestGrade || "N/A",
        totalFeedbacks: persistentStats.totalFeedbacks || 0,
        averageStarRating: persistentStats.averageStarRating || 0,
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
    let grades: string[] = [];

    // Process each route
    for (const routeDoc of routesSnapshot.docs) {
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
        }

        if (feedback.starRating) {
          starRatings.push(feedback.starRating);
        }

        if (feedback.suggestedGrade) {
          grades.push(feedback.suggestedGrade);
        }
      });
    }

    // Calculate highest grade
    const gradeValues: Record<string, number> = {
      V1: 1, V2: 2, V3: 3, V4: 4, V5: 5,
      V6: 6, V7: 7, V8: 8, V9: 9, V10: 10,
    };

    let highestGrade = "N/A";
    if (grades.length > 0) {
      const sentGrades = grades.filter((grade) => grade);
      if (sentGrades.length > 0) {
        highestGrade = sentGrades.reduce((highest, current) => {
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

    const joinDate = new Date(user.metadata.creationTime);

    const initialStats: UserStats = {
      totalRoutesSent,
      highestGrade,
      totalFeedbacks,
      averageStarRating,
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
    const routes: any[] = [];
    routesSnapshot.forEach((doc) => {
      routes.push({ id: doc.id, ...doc.data() });
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
      const feedbacksRef = collection(db, "routes", route.id, "feedbacks");
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
