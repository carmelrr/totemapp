import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/features/data/firebase";

const routesRef = collection(db, "routes");

export function subscribeToRoutes(callback) {
  return onSnapshot(
    routesRef,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const routeData = {
          id: doc.id,
          ...doc.data(),
        };
        return routeData;
      });
      callback(data);
    },
    (error) => {
      // Error handling
    },
  );
}

export function addRoute(route) {
  // Add default values for statistics
  const routeWithDefaults = {
    ...route,
    averageStarRating: 0,
    feedbackCount: 0,
    completionCount: 0,
    calculatedGrade: null,
  };

  return addDoc(routesRef, routeWithDefaults);
}

export function updateRoute(id, data) {
  return updateDoc(doc(db, "routes", id), data);
}

export async function deleteRoute(id) {
  try {
    // First delete all feedbacks for this route
    await deleteFeedbacksForRoute(id);
    // Then delete the route itself
    return deleteDoc(doc(db, "routes", id));
  } catch (error) {
    throw error;
  }
}

// Feedback functions
export async function addFeedbackToRoute(routeId, feedbackObj) {
  try {
    const feedbacksRef = collection(db, "routes", routeId, "feedbacks");
    const result = await addDoc(feedbacksRef, {
      ...feedbackObj,
      submittedAt: new Date(),
      routeId: routeId,
    });

    // Update route averages after adding feedback
    await updateRouteAverages(routeId);

    // Update user stats
    await updateUserStats(feedbackObj.userId, feedbackObj, "add");

    return result;
  } catch (error) {
    throw error;
  }
}

export async function getFeedbacksForRoute(routeId) {
  try {
    const feedbacksRef = collection(db, "routes", routeId, "feedbacks");
    const snapshot = await getDocs(feedbacksRef);

    const feedbacks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return feedbacks;
  } catch (error) {
    throw error;
  }
}

export function subscribeFeedbacksForRoute(routeId, callback) {
  const feedbacksRef = collection(db, "routes", routeId, "feedbacks");
  return onSnapshot(
    feedbacksRef,
    (snapshot) => {
      const feedbacks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(feedbacks);
    },
    (error) => {
      // Error handling
    },
  );
}

export async function deleteFeedbacksForRoute(routeId) {
  try {
    const feedbacksRef = collection(db, "routes", routeId, "feedbacks");
    const snapshot = await getDocs(feedbacksRef);

    const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Update route averages after deleting all feedbacks
    await updateRouteAverages(routeId);
  } catch (error) {
    throw error;
  }
}

export async function deleteFeedback(routeId, feedbackId) {
  try {
    const feedbackRef = doc(db, "routes", routeId, "feedbacks", feedbackId);

    // Get the feedback data before deletion to update user stats
    const feedbackDoc = await getDoc(feedbackRef);
    const feedbackData = feedbackDoc.exists() ? feedbackDoc.data() : null;

    const result = await deleteDoc(feedbackRef);

    // Update route averages after deleting feedback
    await updateRouteAverages(routeId);

    // Update user stats (recalculate for accuracy)
    if (feedbackData && feedbackData.userId) {
      await updateUserStats(feedbackData.userId, feedbackData, "update");
    }

    return result;
  } catch (error) {
    throw error;
  }
}

export async function updateFeedback(routeId, feedbackId, data) {
  try {
    const feedbackRef = doc(db, "routes", routeId, "feedbacks", feedbackId);
    const result = await updateDoc(feedbackRef, data);

    // Update route averages after updating feedback
    await updateRouteAverages(routeId);

    // Update user stats (recalculate for accuracy)
    await updateUserStats(data.userId, data, "update");

    return result;
  } catch (error) {
    throw error;
  }
}

// Function to migrate existing feedbacks to include displayName for specific user
export async function migrateFeedbacksWithDisplayName(userId = null) {
  try {
    const routesRef = collection(db, "routes");
    const routesSnapshot = await getDocs(routesRef);

    const batchPromises = [];

    for (const routeDoc of routesSnapshot.docs) {
      const feedbacksRef = collection(db, "routes", routeDoc.id, "feedbacks");

      // If userId is provided, filter only that user's feedbacks
      let feedbacksSnapshot;
      if (userId) {
        const userFeedbackQuery = query(
          feedbacksRef,
          where("userId", "==", userId),
        );
        feedbacksSnapshot = await getDocs(userFeedbackQuery);
      } else {
        feedbacksSnapshot = await getDocs(feedbacksRef);
      }

      for (const feedbackDoc of feedbacksSnapshot.docs) {
        const feedback = feedbackDoc.data();

        try {
          // Get user profile to get displayName
          const userDoc = await getDoc(doc(db, "users", feedback.userId));
          let displayName = feedback.userEmail;

          if (userDoc.exists()) {
            const userData = userDoc.data();
            displayName = userData.displayName || feedback.userEmail;
          }

          // Always update feedback with current displayName (in case it changed)
          const feedbackRef = doc(
            db,
            "routes",
            routeDoc.id,
            "feedbacks",
            feedbackDoc.id,
          );
          batchPromises.push(
            updateDoc(feedbackRef, {
              userDisplayName: displayName,
            }),
          );
        } catch (error) {
          console.error("Error updating feedback:", error);
        }
      }
    }

    await Promise.all(batchPromises);
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

export async function getUserFeedbackForRoute(routeId, userId) {
  try {
    const feedbacksRef = collection(db, "routes", routeId, "feedbacks");
    const q = query(feedbacksRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    throw error;
  }
}

// Helper function to calculate smart average grade (ignoring outliers)
export function calculateSmartAverageGrade(route, feedbacks) {
  if (!feedbacks || feedbacks.length === 0) return null;

  const originalGradeNum = parseGradeToNumber(route.grade);
  if (originalGradeNum === null) return null;

  // Filter out outliers (more than 2 grades away from original)
  const validFeedbacks = feedbacks.filter((feedback) => {
    const suggestedGradeNum = parseGradeToNumber(feedback.suggestedGrade);
    if (suggestedGradeNum === null) return false;

    const difference = Math.abs(suggestedGradeNum - originalGradeNum);
    return difference <= 2;
  });

  if (validFeedbacks.length === 0) return null;

  const totalGrade = validFeedbacks.reduce((sum, feedback) => {
    return sum + parseGradeToNumber(feedback.suggestedGrade);
  }, 0);

  const averageGradeNum = totalGrade / validFeedbacks.length;
  return parseNumberToGrade(Math.round(averageGradeNum));
}

// Helper functions to convert grades to numbers and back
function parseGradeToNumber(grade) {
  if (typeof grade !== "string") return null;

  const match = grade.match(/^V?(\d+)$/);
  if (!match) return null;

  return parseInt(match[1], 10);
}

function parseNumberToGrade(num) {
  return `V${num}`;
}

// Calculate average star rating from feedbacks
export function calculateAverageStarRating(feedbacks) {
  if (!feedbacks || feedbacks.length === 0) return 0;

  const validRatings = feedbacks.filter(
    (feedback) =>
      feedback.starRating &&
      feedback.starRating >= 1 &&
      feedback.starRating <= 5,
  );

  if (validRatings.length === 0) return 0;

  const totalStars = validRatings.reduce(
    (sum, feedback) => sum + feedback.starRating,
    0,
  );
  return Math.round((totalStars / validRatings.length) * 10) / 10; // Round to 1 decimal place
}

// Update route with calculated averages
export async function updateRouteAverages(routeId) {
  try {
    // Get route data
    const routeRef = doc(db, "routes", routeId);
    const routeDoc = await getDoc(routeRef);

    if (!routeDoc.exists()) return;

    const route = { id: routeId, ...routeDoc.data() };

    // Get all feedbacks for this route
    const feedbacks = await getFeedbacksForRoute(routeId);

    // Calculate averages and counts
    const averageStarRating = calculateAverageStarRating(feedbacks);
    const smartAverageGrade = calculateSmartAverageGrade(route, feedbacks);
    const completionCount = feedbacks.filter((f) => f && f.closedRoute).length;

    // Update route with new averages and counts
    const updateData = {
      averageStarRating,
      feedbackCount: feedbacks.length,
      completionCount,
    };

    // Only update grade if we have a valid smart average
    if (smartAverageGrade) {
      updateData.calculatedGrade = smartAverageGrade;
    }

    await updateDoc(routeRef, updateData);
  } catch (error) {
    throw error;
  }
}

// Get display grade (calculated grade if available, otherwise original)
export function getDisplayGrade(route) {
  if (!route) return "";
  const grade = route.calculatedGrade || route.grade;
  return grade ? String(grade) : "";
}

// Get display star rating
export function getDisplayStarRating(route) {
  return route.averageStarRating || 0;
}

// Get completion count (number of people who closed the route)
export function getCompletionCount(route) {
  return route.completionCount || 0;
}

// Update user statistics after feedback operations
export async function updateUserStats(userId, feedbackData, operation = "add") {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return; // User document doesn't exist
    }

    const userData = userDoc.data();
    const currentStats = userData.stats || {
      totalRoutesSent: 0,
      highestGrade: "N/A",
      totalFeedbacks: 0,
      averageStarRating: 0,
      allStarRatings: [],
    };

    // Update stats based on operation
    if (operation === "add") {
      // Increment total feedbacks
      currentStats.totalFeedbacks += 1;

      // Update routes sent count
      if (feedbackData.closedRoute) {
        currentStats.totalRoutesSent += 1;
      }

      // Update star ratings
      if (feedbackData.starRating) {
        currentStats.allStarRatings = currentStats.allStarRatings || [];
        currentStats.allStarRatings.push(feedbackData.starRating);

        // Recalculate average
        const sum = currentStats.allStarRatings.reduce(
          (acc, rating) => acc + rating,
          0,
        );
        currentStats.averageStarRating =
          sum / currentStats.allStarRatings.length;
      }

      // Update highest grade
      if (feedbackData.suggestedGrade) {
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

        if (
          currentStats.highestGrade === "N/A" ||
          (gradeValues[feedbackData.suggestedGrade] || 0) >
            (gradeValues[currentStats.highestGrade] || 0)
        ) {
          currentStats.highestGrade = feedbackData.suggestedGrade;
        }
      }
    } else if (operation === "update") {
      // For updates, we need to recalculate from all user feedbacks
      // This is more complex but ensures accuracy
      await recalculateUserStats(userId);
      return;
    }

    // Save updated stats
    await updateDoc(userDocRef, {
      stats: currentStats,
    });
  } catch (error) {
    console.error("Error updating user stats:", error);
  }
}

// Recalculate user stats from all feedbacks (used for updates/deletes)
async function recalculateUserStats(userId) {
  try {
    const routesQuery = query(collection(db, "routes"));
    const routesSnapshot = await getDocs(routesQuery);

    let totalRoutesSent = 0;
    let totalFeedbacks = 0;
    let starRatings = [];
    let grades = [];

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
        ? starRatings.reduce((sum, rating) => sum + rating, 0) /
          starRatings.length
        : 0;

    // Save recalculated stats
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      stats: {
        totalRoutesSent,
        highestGrade,
        totalFeedbacks,
        averageStarRating,
        allStarRatings: starRatings,
      },
    });
  } catch (error) {
    console.error("Error recalculating user stats:", error);
  }
}
