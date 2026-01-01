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
} from "firebase/firestore";

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

// Get user's followers/following
export async function getUserFollowers(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const followers = userDoc.data().followers || [];
    const followersData = [];

    for (const followerId of followers) {
      const followerDoc = await getDoc(doc(db, "users", followerId));
      if (followerDoc.exists()) {
        followersData.push({
          id: followerId,
          ...followerDoc.data(),
        });
      }
    }

    return followersData;
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
    const followingData = [];

    for (const followingId of following) {
      const followingDoc = await getDoc(doc(db, "users", followingId));
      if (followingDoc.exists()) {
        followingData.push({
          id: followingId,
          ...followingDoc.data(),
        });
      }
    }

    return followingData;
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
export async function getFollowingFeed(userId, pageSize = 20, lastTimestamp = null) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return { items: [], hasMore: false };

    const following = userDoc.data().following || [];
    if (following.length === 0) return { items: [], hasMore: false };

    const feedItems = [];

    // Get feedbacks from followed users
    const routesRef = collection(db, "routes");
    const routesSnapshot = await getDocs(routesRef);

    for (const routeDoc of routesSnapshot.docs) {
      const routeData = routeDoc.data();
      const feedbacksRef = collection(db, "routes", routeDoc.id, "feedbacks");
      
      // Query feedbacks for all followed users
      for (const followedUserId of following) {
        const userFeedbackQuery = query(
          feedbacksRef,
          where("userId", "==", followedUserId),
        );
        const feedbackSnapshot = await getDocs(userFeedbackQuery);

        feedbackSnapshot.forEach((feedbackDoc) => {
          const feedback = feedbackDoc.data();
          const createdAt = feedback.submittedAt?.toDate?.() || feedback.submittedAt || new Date();
          
          feedItems.push({
            id: `${routeDoc.id}_${feedbackDoc.id}`,
            type: feedback.closedRoute ? "closure" : "feedback",
            userId: followedUserId,
            userDisplayName: feedback.userDisplayName || "משתמש",
            userPhotoURL: feedback.userPhotoURL || null,
            routeId: routeDoc.id,
            routeName: routeData.name || "מסלול ללא שם",
            routeGrade: routeData.grade || "N/A",
            routeColor: routeData.color || "#8e44ad",
            feedback: {
              starRating: feedback.starRating,
              suggestedGrade: feedback.suggestedGrade,
              comment: feedback.comment,
              closedRoute: feedback.closedRoute,
            },
            createdAt: createdAt,
          });
        });
      }
    }

    // Sort by date (newest first)
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

    return {
      items: paginatedItems,
      hasMore,
      lastTimestamp: paginatedItems.length > 0 ? paginatedItems[paginatedItems.length - 1].createdAt : null,
    };
  } catch (error) {
    console.error("Error getting following feed:", error);
    return { items: [], hasMore: false };
  }
}

// Get user's activity history (closures and feedbacks)
// onlyActiveRoutes: if true, only show feedbacks for active routes (on the wall now)
export async function getUserHistory(userId, pageSize = 20, lastTimestamp = null, onlyActiveRoutes = false) {
  try {
    const historyItems = [];
    const seenFeedbackIds = new Set<string>(); // Avoid duplicates

    // Get all routes first to have route data for lookups
    const routesRef = collection(db, "routes");
    const routesSnapshot = await getDocs(routesRef);
    
    // Build a map of route data for quick lookup
    const routesMap = new Map();
    routesSnapshot.docs.forEach(doc => {
      routesMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // 1. Query from the main routeFeedbacks collection (new way)
    const mainFeedbacksRef = collection(db, "routeFeedbacks");
    const mainFeedbackQuery = query(
      mainFeedbacksRef,
      where("userId", "==", userId)
    );
    const mainFeedbackSnapshot = await getDocs(mainFeedbackQuery);

    mainFeedbackSnapshot.forEach((feedbackDoc) => {
      const feedback = feedbackDoc.data();
      const routeId = feedback.routeId;
      const routeData = routesMap.get(routeId);
      
      // Skip if route doesn't exist
      if (!routeData) return;
      
      // If onlyActiveRoutes is true, skip inactive/archived routes
      if (onlyActiveRoutes) {
        const isActive = !routeData.status || routeData.status === 'active';
        if (!isActive) return;
      }
      
      const uniqueId = `main_${feedbackDoc.id}`;
      seenFeedbackIds.add(uniqueId);
      
      const createdAt = feedback.createdAt?.toDate?.() || feedback.updatedAt?.toDate?.() || new Date();
      const isCompleted = feedback.isCompleted === true || feedback.closedRoute === true;
      
      historyItems.push({
        id: uniqueId,
        type: isCompleted ? "closure" : "feedback",
        routeId: routeId,
        routeName: routeData.name || "מסלול ללא שם",
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

    // 2. Also query from subcollections (legacy way) for backwards compatibility
    for (const routeDoc of routesSnapshot.docs) {
      const routeData = routeDoc.data();
      
      // If onlyActiveRoutes is true, skip inactive/archived routes
      if (onlyActiveRoutes) {
        const isActive = !routeData.status || routeData.status === 'active';
        if (!isActive) continue;
      }
      
      const subcollectionFeedbacksRef = collection(db, "routes", routeDoc.id, "feedbacks");
      const userFeedbackQuery = query(
        subcollectionFeedbacksRef,
        where("userId", "==", userId),
      );
      const feedbackSnapshot = await getDocs(userFeedbackQuery);

      feedbackSnapshot.forEach((feedbackDoc) => {
        const uniqueId = `sub_${routeDoc.id}_${feedbackDoc.id}`;
        
        // Skip if we already have this from main collection
        if (seenFeedbackIds.has(uniqueId)) return;
        seenFeedbackIds.add(uniqueId);
        
        const feedback = feedbackDoc.data();
        const createdAt = feedback.submittedAt?.toDate?.() || feedback.submittedAt || new Date();
        
        historyItems.push({
          id: uniqueId,
          type: feedback.closedRoute ? "closure" : "feedback",
          routeId: routeDoc.id,
          routeName: routeData.name || "מסלול ללא שם",
          routeGrade: routeData.grade || "N/A",
          routeColor: routeData.color || "#8e44ad",
          feedback: {
            starRating: feedback.starRating,
            suggestedGrade: feedback.suggestedGrade,
            comment: feedback.comment,
            closedRoute: feedback.closedRoute,
          },
          createdAt: createdAt,
          feedbackId: feedbackDoc.id,
          isActiveRoute: !routeData.status || routeData.status === 'active',
        });
      });
    }

    // Sort by date (newest first)
    historyItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
    return { items: [], hasMore: false };
  }
}

// Activity Feed (legacy - keeping for backwards compatibility)
// Updated to query from both main routeFeedbacks collection and legacy subcollections
export async function getUserActivityFeed(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const following = userDoc.data().following || [];
    following.push(userId); // Include own activities

    const activities = [];
    const seenIds = new Set<string>();

    // Build a map of route data for quick lookup
    const routesRef = collection(db, "routes");
    const routesSnapshot = await getDocs(routesRef);
    const routesMap = new Map();
    routesSnapshot.docs.forEach(doc => {
      routesMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // 1. Query from main routeFeedbacks collection (new way)
    for (const followedUserId of following) {
      const mainFeedbacksRef = collection(db, "routeFeedbacks");
      const feedbackQuery = query(
        mainFeedbacksRef,
        where("userId", "==", followedUserId)
      );
      const feedbackSnapshot = await getDocs(feedbackQuery);

      feedbackSnapshot.forEach((feedbackDoc) => {
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
          userId: followedUserId,
          userDisplayName: feedback.userDisplayName,
          routeId: routeId,
          routeGrade: routeData.grade,
          routeName: routeData.name,
          routeColor: routeData.color,
          feedback: {
            ...feedback,
            closedRoute: isCompleted,
          },
          createdAt: feedback.createdAt?.toDate?.() || feedback.updatedAt?.toDate?.() || new Date(),
        });
      });
    }

    // 2. Query from legacy subcollections for backwards compatibility
    for (const followedUserId of following) {
      for (const routeDoc of routesSnapshot.docs) {
        const feedbacksRef = collection(db, "routes", routeDoc.id, "feedbacks");
        const userFeedbackQuery = query(
          feedbacksRef,
          where("userId", "==", followedUserId),
        );
        const feedbackSnapshot = await getDocs(userFeedbackQuery);

        feedbackSnapshot.forEach((feedbackDoc) => {
          const uniqueId = `sub_${routeDoc.id}_${feedbackDoc.id}`;
          if (seenIds.has(uniqueId)) return;
          seenIds.add(uniqueId);
          
          const feedback = feedbackDoc.data();
          activities.push({
            id: uniqueId,
            type: feedback.closedRoute ? "route_closure" : "route_feedback",
            userId: followedUserId,
            userDisplayName: feedback.userDisplayName,
            routeId: routeDoc.id,
            routeGrade: routeDoc.data().grade,
            routeName: routeDoc.data().name,
            routeColor: routeDoc.data().color,
            feedback: feedback,
            createdAt: feedback.submittedAt?.toDate?.() || feedback.submittedAt || new Date(),
          });
        });
      }
    }

    // Sort by date (newest first)
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
