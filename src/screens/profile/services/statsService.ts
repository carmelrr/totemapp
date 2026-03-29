import { auth, db } from "@/features/data/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { getCachedRoutes } from "@/features/routes-map/services/RoutesService";
import type { UserStats, GradeStatsMap, ProgressHistory, MonthlyProgress, Milestone } from "../types";
import { GRADE_GROUPS, gradeIndex, GRADE_ORDER } from "@/features/statistics/constants";

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
// OPTIMIZED: Uses cached routes
async function calculateAllTimeStats(userId: string): Promise<{
  totalRoutesSent: number;
  highestGrade: string;
  totalFeedbacks: number;
  averageStarRating: number;
}> {
  try {
    // Use cached routes instead of fetching all routes
    const routes = await getCachedRoutes();
    const routesMap = new Map<string, any>();
    routes.forEach(route => {
      routesMap.set(route.id, route);
    });
    
    // מחפשים פידבקים באוסף routeFeedbacks (לא subcollection)
    const feedbacksRef = collection(db, "routeFeedbacks");
    const userFeedbackQuery = query(
      feedbacksRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(500) // Limit for performance
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
// OPTIMIZED: Uses cached routes
// מסלול נחשב "על הקיר" אם status === 'active' או אם אין לו status (ברירת מחדל)
async function calculateActiveRoutesCompletionPercentage(userId: string): Promise<number> {
  try {
    // Use cached routes instead of fetching all routes
    const allRoutes = await getCachedRoutes();
    
    // סנן מסלולים פעילים (status === 'active' או status לא קיים/undefined)
    const activeRoutes = allRoutes.filter(route => {
      return !route.status || route.status === 'active';
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
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(500) // Limit for performance
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
    // Use cached routes instead of fetching all routes
    const routes = await getCachedRoutes();
    const routesMap = new Map<string, any>();
    routes.forEach(route => {
      routesMap.set(route.id, route);
    });

    // מחפשים פידבקים באוסף routeFeedbacks (לא subcollection)
    const feedbacksRef = collection(db, "routeFeedbacks");
    const userFeedbackQuery = query(
      feedbacksRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(500) // Limit for performance
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
    // Use cached routes instead of fetching all routes
    const allRoutes = await getCachedRoutes();

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
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(500) // Limit for performance
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

/**
 * Subscribe to real-time updates for a user's stats
 * Listens to changes in routeFeedbacks collection
 * @param userId The user ID to subscribe to
 * @param onStatsChange Callback when stats change
 * @param onError Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToUserStats(
  userId: string,
  onStatsChange: (stats: UserStats) => void,
  onError?: (error: Error) => void
): () => void {
  const feedbacksRef = collection(db, "routeFeedbacks");
  const userFeedbackQuery = query(
    feedbacksRef,
    where("userId", "==", userId)
  );
  
  return onSnapshot(
    userFeedbackQuery,
    async () => {
      try {
        // Recalculate stats when feedbacks change
        const stats = await fetchOtherUserStats(userId);
        onStatsChange(stats);
      } catch (error) {
        console.error("Error recalculating stats:", error);
        onError?.(error as Error);
      }
    },
    (error) => {
      console.error("Error in stats subscription:", error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to real-time grade stats updates
 * @param userId The user ID to subscribe to
 * @param onGradeStatsChange Callback when grade stats change
 * @param onError Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToGradeStats(
  userId: string,
  onGradeStatsChange: (data: { routes: any[], gradeStats: GradeStatsMap }) => void,
  onError?: (error: Error) => void
): () => void {
  const feedbacksRef = collection(db, "routeFeedbacks");
  const userFeedbackQuery = query(
    feedbacksRef,
    where("userId", "==", userId)
  );
  
  return onSnapshot(
    userFeedbackQuery,
    async () => {
      try {
        // Recalculate grade stats when feedbacks change
        const gradeData = await calculateGradeStats(userId);
        onGradeStatsChange(gradeData);
      } catch (error) {
        console.error("Error recalculating grade stats:", error);
        onError?.(error as Error);
      }
    },
    (error) => {
      console.error("Error in grade stats subscription:", error);
      onError?.(error);
    }
  );
}

// === Progress History (Personal Timeline) ===

function getGradeGroup(grade: string): 'easy' | 'medium' | 'hard' | 'elite' {
  if (GRADE_GROUPS.easy.includes(grade)) return 'easy';
  if (GRADE_GROUPS.medium.includes(grade)) return 'medium';
  if (GRADE_GROUPS.hard.includes(grade)) return 'hard';
  return 'elite';
}

export async function fetchProgressHistory(userId: string): Promise<ProgressHistory> {
  try {
    const routes = await getCachedRoutes();
    const routesMap = new Map<string, any>();
    routes.forEach(route => routesMap.set(route.id, route));

    // === Source 1: routeFeedbacks (rich records with createdAt) ===
    const feedbacksRef = collection(db, "routeFeedbacks");
    const userFeedbackQuery = query(
      feedbacksRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(500)
    );
    const snapshot = await getDocs(userFeedbackQuery);

    const completions: { date: Date; grade: string }[] = [];
    const feedbackRouteIds = new Set<string>();

    snapshot.forEach((feedbackDoc) => {
      const data = feedbackDoc.data();
      const isCompleted = data.isCompleted === true || data.closedRoute === true;
      if (!isCompleted) return;

      const routeData = routesMap.get(data.routeId);
      const grade = routeData?.grade || 'VB';
      const date = data.createdAt?.toDate?.() ?? (data.createdAt ? new Date(data.createdAt) : null);
      if (!date) return;

      feedbackRouteIds.add(data.routeId);
      completions.push({ date, grade });
    });

    // === Source 2: userRoutes (lightweight status — catches completions without feedback) ===
    try {
      const userRoutesDoc = await getDoc(doc(db, "userRoutes", userId));
      if (userRoutesDoc.exists()) {
        const userRoutesData = userRoutesDoc.data()?.routes || {};
        for (const [routeId, routeInfo] of Object.entries(userRoutesData)) {
          const info = routeInfo as any;
          const isSent = info.status === 'sent' || info.status === 'flashed';
          if (!isSent) continue;
          // Skip if already counted from routeFeedbacks
          if (feedbackRouteIds.has(routeId)) continue;

          const routeData = routesMap.get(routeId);
          const grade = routeData?.grade || 'VB';
          // Use lastAttempt as the completion date, fall back to route createdAt
          const date = info.lastAttempt?.toDate?.()
            ?? (info.lastAttempt ? new Date(info.lastAttempt) : null)
            ?? (routeData?.createdAt?.toDate?.() ?? null);
          if (!date) continue;

          completions.push({ date, grade });
        }
      }
    } catch (err) {
      console.warn("[ProgressHistory] Could not read userRoutes, using feedbacks only:", err);
    }

    if (completions.length === 0) {
      return { monthlyData: [], milestones: [] };
    }

    // Sort all completions chronologically after merging both sources
    completions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group by month
    const monthMap = new Map<string, { easy: number; medium: number; hard: number; elite: number; grades: string[] }>();

    for (const c of completions) {
      const key = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { easy: 0, medium: 0, hard: 0, elite: 0, grades: [] });
      }
      const bucket = monthMap.get(key)!;
      const group = getGradeGroup(c.grade);
      bucket[group]++;
      bucket.grades.push(c.grade);
    }

    // Build monthly data sorted chronologically
    const sortedMonths = [...monthMap.keys()].sort();
    let cumulativeTotal = 0;
    const monthlyData: MonthlyProgress[] = sortedMonths.map((month) => {
      const bucket = monthMap.get(month)!;
      const totalSends = bucket.easy + bucket.medium + bucket.hard + bucket.elite;
      cumulativeTotal += totalSends;

      // Find highest grade this month
      let highestGrade = 'VB';
      for (const g of bucket.grades) {
        if (gradeIndex(g) > gradeIndex(highestGrade)) {
          highestGrade = g;
        }
      }

      return {
        month,
        easy: bucket.easy,
        medium: bucket.medium,
        hard: bucket.hard,
        elite: bucket.elite,
        highestGrade,
        totalSends,
        cumulativeTotal,
      };
    });

    // Build milestones — first time each grade group was reached
    const firstByGroup: Record<string, { grade: string; date: Date }> = {};
    for (const c of completions) {
      const group = getGradeGroup(c.grade);
      if (!firstByGroup[group]) {
        firstByGroup[group] = { grade: c.grade, date: c.date };
      } else {
        // Track highest grade first-seen per group
        if (gradeIndex(c.grade) > gradeIndex(firstByGroup[group].grade)) {
          // Don't overwrite the date — we want the first in the group
        }
      }
    }

    // Also track first time each individual grade was reached
    const firstByGrade: Record<string, Date> = {};
    for (const c of completions) {
      if (!firstByGrade[c.grade]) {
        firstByGrade[c.grade] = c.date;
      }
    }

    // Build milestone list from significant grade firsts
    const milestones: Milestone[] = [];
    const significantGrades = GRADE_ORDER.filter(g => !GRADE_GROUPS.easy.includes(g)); // V3+
    for (const grade of significantGrades) {
      if (firstByGrade[grade]) {
        milestones.push({
          grade,
          date: firstByGrade[grade],
          label: grade,
        });
      }
    }

    return { monthlyData, milestones };
  } catch (error) {
    console.error("Error fetching progress history:", error);
    return { monthlyData: [], milestones: [] };
  }
}
