import { db, auth } from "@/features/data/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  addDoc,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  documentId,
  Timestamp,
} from "firebase/firestore";
import { getCachedRoutes } from "@/features/routes-map/services/RoutesService";

// ========== CACHE CONSTANTS ==========
const USER_CACHE_TTL = 60000; // 1 minute TTL
const FEED_CACHE_TTL = 30000; // 30 seconds TTL for feed
const ROUTES_MAP_CACHE_TTL = 60000; // 1 minute for routes map

// ========== USER CACHE ==========
// Simple in-memory cache for user data to avoid repeated fetches
const userCache = new Map<string, { data: any; timestamp: number }>();

// ========== FEED CACHE ==========
// Cache for feed data to avoid repeated fetches on navigation
interface FeedCacheEntry {
  data: { items: any[]; hasMore: boolean; lastTimestamp: any };
  timestamp: number;
}
const feedCache = new Map<string, FeedCacheEntry>();

// ========== ROUTES MAP CACHE ==========
// Cached routes map for quick lookups
let routesMapCache: { data: Map<string, any> | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

/**
 * Get cached routes map for quick lookups
 * Uses the RoutesService cache internally
 */
async function getCachedRoutesMap(): Promise<Map<string, any>> {
  if (routesMapCache.data && Date.now() - routesMapCache.timestamp < ROUTES_MAP_CACHE_TTL) {
    return routesMapCache.data;
  }
  
  try {
    const routes = await getCachedRoutes();
    const map = new Map<string, any>();
    routes.forEach(route => {
      map.set(route.id, route);
    });
    routesMapCache.data = map;
    routesMapCache.timestamp = Date.now();
    return map;
  } catch (error) {
    console.error("Error getting cached routes map:", error);
    return new Map();
  }
}

/**
 * Clear feed cache - call when new feedback is submitted
 */
export function clearFeedCache(): void {
  feedCache.clear();
}

/**
 * Clear routes map cache
 */
export function clearRoutesMapCache(): void {
  routesMapCache.data = null;
  routesMapCache.timestamp = 0;
}

function getCachedUser(userId: string) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedUser(userId: string, data: any) {
  userCache.set(userId, { data, timestamp: Date.now() });
}

/**
 * Batch fetch users by IDs - prevents N+1 queries
 * Firestore 'in' query supports max 10 items, so we chunk the requests
 */
async function batchFetchUsers(userIds: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  
  if (!userIds || userIds.length === 0) return result;
  
  // Check cache first
  const uncachedIds: string[] = [];
  for (const userId of userIds) {
    const cached = getCachedUser(userId);
    if (cached) {
      result.set(userId, cached);
    } else {
      uncachedIds.push(userId);
    }
  }
  
  // Fetch uncached users in batches of 10 (Firestore limit)
  const chunks: string[][] = [];
  for (let i = 0; i < uncachedIds.length; i += 10) {
    chunks.push(uncachedIds.slice(i, i + 10));
  }
  
  for (const chunk of chunks) {
    try {
      const q = query(collection(db, "users"), where(documentId(), "in", chunk));
      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        result.set(doc.id, userData);
        setCachedUser(doc.id, userData);
      });
    } catch (error) {
      console.error("Error batch fetching users:", error);
    }
  }
  
  return result;
}

// Follow/Unfollow users
export async function followUser(currentUserId, targetUserId) {
  try {
    const currentUserRef = doc(db, "users", currentUserId);
    const targetUserRef = doc(db, "users", targetUserId);

    // Check if target user exists first
    const targetUserDoc = await getDoc(targetUserRef);
    if (!targetUserDoc.exists()) {
      throw new Error("User not found");
    }

    // Add to current user's following list (use setDoc with merge to handle missing docs)
    await setDoc(currentUserRef, {
      following: arrayUnion(targetUserId),
    }, { merge: true });

    // Add to target user's followers list
    await setDoc(targetUserRef, {
      followers: arrayUnion(currentUserId),
    }, { merge: true });

    // Create follow notification
    await createNotification(targetUserId, {
      type: "follow",
      fromUserId: currentUserId,
      message: "החל לעקוב אחריך",
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Error following user:", error);
    throw error;
  }
}

export async function unfollowUser(currentUserId, targetUserId) {
  try {
    const currentUserRef = doc(db, "users", currentUserId);
    const targetUserRef = doc(db, "users", targetUserId);

    // Remove from current user's following list (use setDoc with merge to handle missing docs)
    await setDoc(currentUserRef, {
      following: arrayRemove(targetUserId),
    }, { merge: true });

    // Remove from target user's followers list
    await setDoc(targetUserRef, {
      followers: arrayRemove(currentUserId),
    }, { merge: true });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    throw error;
  }
}

// Get user's followers/following - OPTIMIZED with batch fetching
export async function getUserFollowers(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const followers = userDoc.data().followers || [];
    if (followers.length === 0) return [];

    // Use batch fetch instead of N+1 individual queries
    const usersMap = await batchFetchUsers(followers);
    return Array.from(usersMap.values());
  } catch (error) {
    console.error("Error getting followers:", error);
    return [];
  }
}

export async function getUserFollowing(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const following = userDoc.data().following || [];
    if (following.length === 0) return [];

    // Use batch fetch instead of N+1 individual queries
    const usersMap = await batchFetchUsers(following);
    return Array.from(usersMap.values());
  } catch (error) {
    console.error("Error getting following:", error);
    return [];
  }
}

// Search users
export async function searchUsers(searchTerm) {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    const users = [];
    snapshot.forEach((doc) => {
      const userData = doc.data();
      const displayName = userData.displayName || "";
      const email = userData.email || "";

      if (!searchTerm || searchTerm.trim() === "") {
        // If no search term, return all users
        users.push({
          id: doc.id,
          ...userData,
        });
      } else {
        const searchLower = searchTerm.toLowerCase();
        if (displayName.toLowerCase().includes(searchLower) || 
            email.toLowerCase().includes(searchLower)) {
          users.push({
            id: doc.id,
            ...userData,
          });
        }
      }
    });

    // Sort by followers count for better suggestions
    users.sort(
      (a, b) => (b.followers?.length || 0) - (a.followers?.length || 0),
    );

    return users;
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
}

// Get all users - fetches WITHOUT orderBy to include ALL users regardless of field existence
// Sorting is done client-side to ensure no users are excluded
export async function getAllUsers(pageSize = 50, lastDoc = null) {
  try {
    const usersRef = collection(db, "users");
    
    // Fetch all users without orderBy - this ensures users with missing fields are included
    // Firestore orderBy excludes documents where the ordered field is null/undefined
    const snapshot = await getDocs(usersRef);
    
    const users: any[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        displayName: data.displayName || data.email || "משתמש",
        email: data.email || "",
        photoURL: data.photoURL || null,
        ...data,
      });
    });
    
    // Sort alphabetically by displayName for consistent display
    users.sort((a, b) => {
      const nameA = (a.displayName || "").toLowerCase();
      const nameB = (b.displayName || "").toLowerCase();
      return nameA.localeCompare(nameB, "he");
    });
    
    // Implement client-side pagination
    const startIndex = lastDoc ? users.findIndex(u => u.id === lastDoc) + 1 : 0;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);
    const lastVisible = paginatedUsers.length > 0 ? paginatedUsers[paginatedUsers.length - 1].id : null;
    
    return {
      users: paginatedUsers,
      lastDoc: lastVisible,
      hasMore: startIndex + pageSize < users.length,
    };
  } catch (error) {
    console.error("Error getting all users:", error);
    return { users: [], lastDoc: null, hasMore: false };
  }
}

// Activity Feed - Get feed of followed users' closures and feedbacks
// OPTIMIZED VERSION: Uses caching and efficient queries
// If user doesn't follow anyone, returns top recent feedbacks from all users
export async function getFollowingFeed(userId: string, pageSize = 20, lastTimestamp: string | null = null) {
  try {
    // Check cache for refresh (first page only)
    const cacheKey = `feed_${userId}`;
    if (!lastTimestamp) {
      const cached = feedCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FEED_CACHE_TTL) {
        return cached.data;
      }
    }

    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return { items: [], hasMore: false, lastTimestamp: null };

    const following: string[] = userDoc.data().following || [];
    const showAllUsers = following.length === 0;

    // Time limit: Only show activity from the last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoTimestamp = Timestamp.fromDate(oneWeekAgo);

    // Use cached routes map instead of fetching all routes
    const routesMap = await getCachedRoutesMap();
    
    // Build users map from batch fetch (only for users we need)
    const userIdsToFetch = showAllUsers ? [] : [...following];
    const usersMap = userIdsToFetch.length > 0 ? await batchFetchUsers(userIdsToFetch) : new Map();

    // Helper function to get user photo URL
    const getUserPhotoURL = (feedbackUserId: string, feedbackPhotoURL: string | null): string | null => {
      if (feedbackPhotoURL) return feedbackPhotoURL;
      const userData = usersMap.get(feedbackUserId);
      return userData?.photoURL || null;
    };

    const feedItems: any[] = [];
    const seenIds = new Set<string>();

    // Helper to create feed item
    const createFeedItem = (feedbackDoc: any, feedback: any, routeData: any, feedbackUserId: string) => {
      const uniqueId = `main_${feedbackDoc.id}`;
      if (seenIds.has(uniqueId)) return null;
      seenIds.add(uniqueId);
      
      const createdAt = feedback.createdAt?.toDate?.() || feedback.updatedAt?.toDate?.() || feedback.submittedAt?.toDate?.() || new Date();
      const isCompleted = feedback.closedRoute === true || feedback.isCompleted === true;
      
      return {
        id: uniqueId,
        type: isCompleted ? "closure" : "feedback",
        userId: feedbackUserId,
        userDisplayName: feedback.userDisplayName || "משתמש",
        userPhotoURL: getUserPhotoURL(feedbackUserId, feedback.userPhotoURL),
        routeId: feedback.routeId,
        routeName: routeData.name || "מסלול ללא שם",
        routeNameHe: routeData.nameHe,
        routeNameEn: routeData.nameEn,
        routeGrade: routeData.grade || "N/A",
        routeColor: routeData.color || "#8e44ad",
        routeX: routeData.xNorm,
        routeY: routeData.yNorm,
        feedback: {
          starRating: feedback.starRating,
          suggestedGrade: feedback.suggestedGrade,
          comment: feedback.comment,
          closedRoute: isCompleted,
        },
        createdAt,
      };
    };

    const mainFeedbacksRef = collection(db, "routeFeedbacks");

    if (showAllUsers) {
      // OPTIMIZED: Query with orderBy and limit at Firestore level
      const feedbackQuery = query(
        mainFeedbacksRef,
        where("createdAt", ">=", oneWeekAgoTimestamp),
        orderBy("createdAt", "desc"),
        limit(100) // Fetch more than needed to filter out current user
      );
      const feedbackSnapshot = await getDocs(feedbackQuery);

      feedbackSnapshot.forEach((feedbackDoc) => {
        const feedback = feedbackDoc.data();
        if (feedback.userId === userId) return; // Skip current user
        
        const routeData = routesMap.get(feedback.routeId);
        if (!routeData) return;
        
        const item = createFeedItem(feedbackDoc, feedback, routeData, feedback.userId);
        if (item) feedItems.push(item);
      });
    } else {
      // OPTIMIZED: Use 'in' query to fetch for multiple users at once (max 30 per query)
      const chunks: string[][] = [];
      for (let i = 0; i < following.length; i += 30) {
        chunks.push(following.slice(i, i + 30));
      }

      // Execute queries in parallel
      const queryPromises = chunks.map(async (chunk) => {
        const feedbackQuery = query(
          mainFeedbacksRef,
          where("userId", "in", chunk),
          where("createdAt", ">=", oneWeekAgoTimestamp),
          orderBy("createdAt", "desc"),
          limit(50)
        );
        return getDocs(feedbackQuery);
      });

      const snapshots = await Promise.all(queryPromises);
      
      snapshots.forEach((snapshot) => {
        snapshot.forEach((feedbackDoc) => {
          const feedback = feedbackDoc.data();
          const routeData = routesMap.get(feedback.routeId);
          if (!routeData) return;
          
          const item = createFeedItem(feedbackDoc, feedback, routeData, feedback.userId);
          if (item) feedItems.push(item);
        });
      });
    }

    // Sort by date (newest first) - items should already be sorted, but ensure consistency
    feedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    let filteredItems = feedItems;
    if (lastTimestamp) {
      filteredItems = feedItems.filter(
        (item) => new Date(item.createdAt).getTime() < new Date(lastTimestamp).getTime()
      );
    }

    const paginatedItems = filteredItems.slice(0, pageSize);
    const hasMore = filteredItems.length > pageSize;

    const result = {
      items: paginatedItems,
      hasMore,
      lastTimestamp: paginatedItems.length > 0 ? paginatedItems[paginatedItems.length - 1].createdAt : null,
    };

    // Cache first page results
    if (!lastTimestamp) {
      feedCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return result;
  } catch (error) {
    console.error("Error getting following feed:", error);
    return { items: [], hasMore: false, lastTimestamp: null };
  }
}

// Get user's activity history (closures and feedbacks)
// OPTIMIZED VERSION: Uses caching and efficient Firestore queries
// onlyActiveRoutes: if true, only show feedbacks for active routes (on the wall now)
export async function getUserHistory(userId: string, pageSize = 20, lastTimestamp: string | null = null, onlyActiveRoutes = false) {
  try {
    // Time limit: Only show activity from the last month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoTimestamp = Timestamp.fromDate(oneMonthAgo);

    // Use cached routes map instead of fetching all routes
    const routesMap = await getCachedRoutesMap();

    // Build active routes set for quick lookup if needed
    const activeRouteIds = new Set<string>();
    if (onlyActiveRoutes) {
      routesMap.forEach((route, id) => {
        const isActive = !route.status || route.status === 'active';
        if (isActive) activeRouteIds.add(id);
      });
    }

    const historyItems: any[] = [];
    const seenFeedbackIds = new Set<string>();

    // Query from the main routeFeedbacks collection with optimized query
    const mainFeedbacksRef = collection(db, "routeFeedbacks");
    const mainFeedbackQuery = query(
      mainFeedbacksRef,
      where("userId", "==", userId),
      where("createdAt", ">=", oneMonthAgoTimestamp),
      orderBy("createdAt", "desc"),
      limit(100) // Fetch enough for pagination
    );
    const mainFeedbackSnapshot = await getDocs(mainFeedbackQuery);

    mainFeedbackSnapshot.forEach((feedbackDoc) => {
      const feedback = feedbackDoc.data();
      const routeId = feedback.routeId;
      const routeData = routesMap.get(routeId);
      
      // Skip if route doesn't exist
      if (!routeData) return;
      
      // If onlyActiveRoutes is true, skip inactive/archived routes
      if (onlyActiveRoutes && !activeRouteIds.has(routeId)) return;
      
      const uniqueId = `main_${feedbackDoc.id}`;
      seenFeedbackIds.add(uniqueId);
      
      const createdAt = feedback.createdAt?.toDate?.() || feedback.updatedAt?.toDate?.() || new Date();
      const isCompleted = feedback.isCompleted === true || feedback.closedRoute === true;
      
      historyItems.push({
        id: uniqueId,
        type: isCompleted ? "closure" : "feedback",
        routeId: routeId,
        routeName: routeData.name || "מסלול ללא שם",
        routeNameHe: routeData.nameHe,
        routeNameEn: routeData.nameEn,
        routeGrade: routeData.grade || "N/A",
        routeColor: routeData.color || "#8e44ad",
        feedback: {
          starRating: feedback.starRating,
          suggestedGrade: feedback.suggestedGrade,
          comment: feedback.comment,
          closedRoute: isCompleted,
        },
        createdAt: createdAt,
        feedbackId: feedbackDoc.id,
        isActiveRoute: !routeData.status || routeData.status === 'active',
      });
    });

    // Items are already sorted from Firestore query
    // Apply pagination
    let filteredItems = historyItems;
    if (lastTimestamp) {
      filteredItems = historyItems.filter(
        (item) => new Date(item.createdAt).getTime() < new Date(lastTimestamp).getTime()
      );
    }

    const paginatedItems = filteredItems.slice(0, pageSize);
    const hasMore = filteredItems.length > pageSize;

    return {
      items: paginatedItems,
      hasMore,
      lastTimestamp: paginatedItems.length > 0 ? paginatedItems[paginatedItems.length - 1].createdAt : null,
    };
  } catch (error) {
    console.error("Error getting user history:", error);
    return { items: [], hasMore: false, lastTimestamp: null };
  }
}

// Activity Feed (legacy - keeping for backwards compatibility)
// OPTIMIZED VERSION: Uses caching and batch queries
export async function getUserActivityFeed(userId: string) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const following: string[] = userDoc.data().following || [];
    const allUserIds = [...following, userId]; // Include own activities

    // Use cached routes map
    const routesMap = await getCachedRoutesMap();

    // Time limit for efficiency
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoTimestamp = Timestamp.fromDate(oneWeekAgo);

    const activities: any[] = [];
    const seenIds = new Set<string>();

    // Batch query users in chunks of 30 (Firestore 'in' limit)
    const mainFeedbacksRef = collection(db, "routeFeedbacks");
    const chunks: string[][] = [];
    for (let i = 0; i < allUserIds.length; i += 30) {
      chunks.push(allUserIds.slice(i, i + 30));
    }

    // Execute queries in parallel
    const queryPromises = chunks.map(async (chunk) => {
      const feedbackQuery = query(
        mainFeedbacksRef,
        where("userId", "in", chunk),
        where("createdAt", ">=", oneWeekAgoTimestamp),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      return getDocs(feedbackQuery);
    });

    const snapshots = await Promise.all(queryPromises);

    snapshots.forEach((snapshot) => {
      snapshot.forEach((feedbackDoc) => {
        const feedback = feedbackDoc.data();
        const routeId = feedback.routeId;
        const routeData = routesMap.get(routeId);
        
        if (!routeData) return;
        
        const uniqueId = `main_${feedbackDoc.id}`;
        if (seenIds.has(uniqueId)) return;
        seenIds.add(uniqueId);
        
        const isCompleted = feedback.isCompleted === true || feedback.closedRoute === true;
        
        activities.push({
          id: uniqueId,
          type: isCompleted ? "route_closure" : "route_feedback",
          userId: feedback.userId,
          userDisplayName: feedback.userDisplayName,
          routeId: routeId,
          routeGrade: routeData.grade,
          routeName: routeData.name,
          routeNameHe: routeData.nameHe,
          routeNameEn: routeData.nameEn,
          routeColor: routeData.color,
          feedback: {
            ...feedback,
            closedRoute: isCompleted,
          },
          createdAt: feedback.createdAt?.toDate?.() || feedback.updatedAt?.toDate?.() || new Date(),
        });
      });
    });

    // Sort by date (newest first) - should already be sorted
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return activities.slice(0, 50); // Return latest 50 activities
  } catch (error) {
    console.error("Error getting activity feed:", error);
    return [];
  }
}

// Achievements system
export async function checkAndAwardAchievements(userId, feedbackData) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    const currentAchievements = userData.achievements || [];
    const stats = userData.stats || {};

    const newAchievements = [];

    // First Route Achievement
    if (
      stats.totalRoutesSent === 1 &&
      !currentAchievements.includes("first_route")
    ) {
      newAchievements.push({
        id: "first_route",
        title: "המסלול הראשון",
        description: "סגרת את המסלול הראשון שלך!",
        icon: "🎯",
        earnedAt: new Date(),
      });
    }

    // Route milestones
    const routeMilestones = [5, 10, 25, 50, 100];
    for (const milestone of routeMilestones) {
      const achievementId = `routes_${milestone}`;
      if (
        stats.totalRoutesSent >= milestone &&
        !currentAchievements.includes(achievementId)
      ) {
        newAchievements.push({
          id: achievementId,
          title: `${milestone} מסלולים`,
          description: `סגרת ${milestone} מסלולים!`,
          icon:
            milestone >= 100
              ? "🏆"
              : milestone >= 50
                ? "🥇"
                : milestone >= 25
                  ? "🥈"
                  : "🥉",
          earnedAt: new Date(),
        });
      }
    }

    // Grade achievements
    if (feedbackData.closedRoute && feedbackData.suggestedGrade) {
      const gradeValues = {
        V1: 1,
        V2: 2,
        V3: 3,
        V4: 4,
        V5: 5,
        V6: 6,
        V7: 7,
        V8: 8,
        V9: 9,
        V10: 10,
      };
      const gradeValue = gradeValues[feedbackData.suggestedGrade];

      if (gradeValue >= 5 && !currentAchievements.includes("v5_climber")) {
        newAchievements.push({
          id: "v5_climber",
          title: "מטפס V5",
          description: "סגרת מסלול V5 ומעלה!",
          icon: "💪",
          earnedAt: new Date(),
        });
      }

      if (
        gradeValue >= 8 &&
        !currentAchievements.includes("advanced_climber")
      ) {
        newAchievements.push({
          id: "advanced_climber",
          title: "מטפס מתקדם",
          description: "סגרת מסלול V8 ומעלה!",
          icon: "🔥",
          earnedAt: new Date(),
        });
      }
    }

    // Save new achievements
    if (newAchievements.length > 0) {
      const allAchievements = [
        ...currentAchievements,
        ...newAchievements.map((a) => a.id),
      ];
      await updateDoc(doc(db, "users", userId), {
        achievements: allAchievements,
        achievementDetails: arrayUnion(...newAchievements),
      });

      // Create achievement notifications
      for (const achievement of newAchievements) {
        await createNotification(userId, {
          type: "achievement",
          achievement: achievement,
          message: `🎉 הישג חדש: ${achievement.title}`,
          createdAt: new Date(),
        });
      }
    }

    return newAchievements;
  } catch (error) {
    console.error("Error checking achievements:", error);
    return [];
  }
}

// Leaderboards
export async function getLeaderboard(type = "routes", timeframe = "all") {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    const users = [];
    snapshot.forEach((doc) => {
      const userData = doc.data();
      const stats = userData.stats || {};

      users.push({
        id: doc.id,
        displayName: userData.displayName || "משתמש",
        photoURL: userData.photoURL,
        stats: stats,
      });
    });

    // Sort based on type
    switch (type) {
      case "routes":
        users.sort(
          (a, b) =>
            (b.stats.totalRoutesSent || 0) - (a.stats.totalRoutesSent || 0),
        );
        break;
      case "feedbacks":
        users.sort(
          (a, b) =>
            (b.stats.totalFeedbacks || 0) - (a.stats.totalFeedbacks || 0),
        );
        break;
      case "rating":
        users.sort(
          (a, b) =>
            (b.stats.averageStarRating || 0) - (a.stats.averageStarRating || 0),
        );
        break;
    }

    return users.slice(0, 20); // Top 20
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    return [];
  }
}

// Notifications
export async function createNotification(userId, notificationData) {
  try {
    const notificationsRef = collection(db, "users", userId, "notifications");
    await addDoc(notificationsRef, notificationData);
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

export async function getUserNotifications(userId) {
  try {
    const notificationsRef = collection(db, "users", userId, "notifications");
    const q = query(notificationsRef, orderBy("createdAt", "desc"), limit(50));
    const snapshot = await getDocs(q);

    const notifications = [];
    snapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return notifications;
  } catch (error) {
    console.error("Error getting notifications:", error);
    return [];
  }
}

// Tag friends in feedback
export async function tagUsersInFeedback(
  feedbackId,
  routeId,
  taggedUserIds,
  message,
) {
  try {
    for (const userId of taggedUserIds) {
      await createNotification(userId, {
        type: "tag",
        fromUserId: auth.currentUser.uid,
        routeId: routeId,
        feedbackId: feedbackId,
        message: `תויגת בפידבק: ${message}`,
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error tagging users:", error);
  }
}

// ==================== ADMIN FUNCTIONS ====================

// Promote user to admin
export async function promoteToAdmin(targetUserId: string) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("User not authenticated");

    // Verify current user is admin
    const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!currentUserDoc.exists() || !currentUserDoc.data()?.isAdmin) {
      throw new Error("Not authorized - you must be an admin");
    }

    // Update target user to admin
    await updateDoc(doc(db, "users", targetUserId), {
      isAdmin: true,
      promotedBy: currentUser.uid,
      promotedAt: new Date(),
    });

    // Create notification for the promoted user
    await createNotification(targetUserId, {
      type: "admin_promotion",
      fromUserId: currentUser.uid,
      message: "קודמת לאדמין!",
      createdAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error("Error promoting user to admin:", error);
    throw error;
  }
}

// Remove admin privileges
export async function removeAdminPrivileges(targetUserId: string) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("User not authenticated");

    // Verify current user is admin
    const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!currentUserDoc.exists() || !currentUserDoc.data()?.isAdmin) {
      throw new Error("Not authorized - you must be an admin");
    }

    // Remove admin status from target user
    await updateDoc(doc(db, "users", targetUserId), {
      isAdmin: false,
      adminRemovedBy: currentUser.uid,
      adminRemovedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error("Error removing admin privileges:", error);
    throw error;
  }
}

// Delete feedback (admin only)
export async function deleteFeedback(routeId: string, feedbackId: string) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("User not authenticated");

    // Verify current user is admin
    const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!currentUserDoc.exists() || !currentUserDoc.data()?.isAdmin) {
      throw new Error("Not authorized - you must be an admin");
    }

    // Delete the feedback
    const feedbackRef = doc(db, "routes", routeId, "feedbacks", feedbackId);
    await deleteDoc(feedbackRef);

    return true;
  } catch (error) {
    console.error("Error deleting feedback:", error);
    throw error;
  }
}

// Check if user is admin
export async function checkUserIsAdmin(userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return false;
    return userDoc.data()?.isAdmin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Subscribe to real-time updates for a user's followers and following
 * @param userId The user ID to subscribe to
 * @param onFollowersChange Callback when followers change
 * @param onFollowingChange Callback when following change
 * @param onError Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToUserSocial(
  userId: string,
  onFollowersChange: (followers: any[]) => void,
  onFollowingChange: (following: any[]) => void,
  onError?: (error: Error) => void
): () => void {
  const userRef = doc(db, "users", userId);
  
  return onSnapshot(
    userRef,
    async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const followerIds = userData.followers || [];
        const followingIds = userData.following || [];
        
        // Fetch follower details
        const followersData: any[] = [];
        for (const followerId of followerIds) {
          try {
            const followerDoc = await getDoc(doc(db, "users", followerId));
            if (followerDoc.exists()) {
              followersData.push({
                id: followerId,
                ...followerDoc.data(),
              });
            }
          } catch (e) {
            // Skip failed fetches
          }
        }
        onFollowersChange(followersData);
        
        // Fetch following details
        const followingData: any[] = [];
        for (const followingId of followingIds) {
          try {
            const followingDoc = await getDoc(doc(db, "users", followingId));
            if (followingDoc.exists()) {
              followingData.push({
                id: followingId,
                ...followingDoc.data(),
              });
            }
          } catch (e) {
            // Skip failed fetches
          }
        }
        onFollowingChange(followingData);
      } else {
        onFollowersChange([]);
        onFollowingChange([]);
      }
    },
    (error) => {
      console.error('Error subscribing to user social:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to real-time updates for user profile data
 * @param userId The user ID to subscribe to
 * @param onProfileChange Callback when profile data changes
 * @param onError Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToUserProfile(
  userId: string,
  onProfileChange: (profile: any) => void,
  onError?: (error: Error) => void
): () => void {
  const userRef = doc(db, "users", userId);
  
  return onSnapshot(
    userRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onProfileChange({
          id: docSnap.id,
          ...docSnap.data(),
        });
      } else {
        onProfileChange(null);
      }
    },
    (error) => {
      console.error('Error subscribing to user profile:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to real-time leaderboard updates
 * @param onLeaderboardChange Callback when leaderboard changes
 * @param onError Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToLeaderboard(
  onLeaderboardChange: (users: any[]) => void,
  onError?: (error: Error) => void
): () => void {
  const usersRef = collection(db, "users");
  
  return onSnapshot(
    usersRef,
    (snapshot) => {
      const users: any[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        users.push({
          id: docSnap.id,
          displayName: data.displayName || 'משתמש',
          email: data.email || '',
          photoURL: data.photoURL || null,
          followers: data.followers || [],
          following: data.following || [],
          ...data,
        });
      });
      
      onLeaderboardChange(users);
    },
    (error) => {
      console.error('Error subscribing to leaderboard:', error);
      onError?.(error);
    }
  );
}
