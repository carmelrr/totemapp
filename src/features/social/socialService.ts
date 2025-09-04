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
} from "firebase/firestore";

// Follow/Unfollow users
export async function followUser(currentUserId, targetUserId) {
  try {
    const currentUserRef = doc(db, "users", currentUserId);
    const targetUserRef = doc(db, "users", targetUserId);

    // Add to current user's following list
    await updateDoc(currentUserRef, {
      following: arrayUnion(targetUserId),
    });

    // Add to target user's followers list
    await updateDoc(targetUserRef, {
      followers: arrayUnion(currentUserId),
    });

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

    // Remove from current user's following list
    await updateDoc(currentUserRef, {
      following: arrayRemove(targetUserId),
    });

    // Remove from target user's followers list
    await updateDoc(targetUserRef, {
      followers: arrayRemove(currentUserId),
    });
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

      if (!searchTerm || searchTerm.trim() === "") {
        // If no search term, return all users (can be limited later)
        users.push({
          id: doc.id,
          ...userData,
        });
      } else if (displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
        users.push({
          id: doc.id,
          ...userData,
        });
      }
    });

    // Sort by followers count for better suggestions when no search term
    if (!searchTerm || searchTerm.trim() === "") {
      users.sort(
        (a, b) => (b.followers?.length || 0) - (a.followers?.length || 0),
      );
      return users.slice(0, 10); // Return top 10 users
    }

    return users;
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
}

// Activity Feed
export async function getUserActivityFeed(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const following = userDoc.data().following || [];
    following.push(userId); // Include own activities

    const activities = [];

    // Get recent feedbacks from followed users
    for (const followedUserId of following) {
      const routesRef = collection(db, "routes");
      const routesSnapshot = await getDocs(routesRef);

      for (const routeDoc of routesSnapshot.docs) {
        const feedbacksRef = collection(db, "routes", routeDoc.id, "feedbacks");
        const userFeedbackQuery = query(
          feedbacksRef,
          where("userId", "==", followedUserId),
        );
        const feedbackSnapshot = await getDocs(userFeedbackQuery);

        feedbackSnapshot.forEach((feedbackDoc) => {
          const feedback = feedbackDoc.data();
          activities.push({
            id: `${routeDoc.id}_${feedbackDoc.id}`,
            type: "route_feedback",
            userId: followedUserId,
            userDisplayName: feedback.userDisplayName,
            routeId: routeDoc.id,
            routeGrade: routeDoc.data().grade,
            feedback: feedback,
            createdAt: feedback.submittedAt,
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
