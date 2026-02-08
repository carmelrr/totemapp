// src/features/spraywall/routesService.ts
// Firebase functions for spray wall routes

import { db, auth } from "@/features/data/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  DocumentData,
  QuerySnapshot,
  writeBatch,
  getDoc,
  collectionGroup,
  setDoc,
} from "firebase/firestore";
import { SprayRoute, Hold, SprayRouteFeedback } from "./types";

// V-Scale grades for calculations
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

/**
 * Add a new route to a wall
 */
export async function addRoute(payload: {
  wallId: string;
  name: string;
  grade: string;
  holds: Hold[];
  createdBy?: string | null;
  creatorName?: string;
}): Promise<string> {
  const { wallId, name, grade, holds, createdBy, creatorName } = payload;

  console.log('🔵 [addRoute] Starting to add route...');
  console.log('🔵 [addRoute] Current auth user:', auth.currentUser?.uid);
  console.log('🔵 [addRoute] createdBy from payload:', createdBy);

  // Verify user is authenticated
  if (!auth.currentUser) {
    console.error('❌ [addRoute] No authenticated user!');
    throw new Error('יש להתחבר כדי להוסיף מסלול');
  }

  const routeData = {
    wallId,
    name,
    grade,
    holds,
    createdAt: serverTimestamp(),
    createdBy: createdBy ?? auth.currentUser.uid,
    creatorName: creatorName ?? null,
    // Initialize statistics
    averageStarRating: 0,
    calculatedGrade: grade,
    feedbackCount: 0,
    topsCount: 0,
  };

  console.log('🔵 [addRoute] Route data to save:', { ...routeData, holds: `${holds.length} holds` });

  try {
    const docRef = await addDoc(collection(db, "sprayRoutes"), routeData);
    console.log('✅ [addRoute] Route added successfully:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('❌ [addRoute] Error adding route:', error.code, error.message);
    throw error;
  }
}

/**
 * Get all routes for a specific wall (one-time fetch)
 */
export async function getRoutesForWall(wallId: string): Promise<SprayRoute[]> {
  const q = query(
    collection(db, "sprayRoutes"),
    where("wallId", "==", wallId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  const routes: SprayRoute[] = [];
  snapshot.forEach((d) => {
    routes.push({ id: d.id, ...(d.data() as DocumentData) } as SprayRoute);
  });
  return routes;
}

/**
 * Listen to routes for a specific wall (real-time)
 */
export function listenToRoutesForWall(
  wallId: string,
  callback: (routes: SprayRoute[]) => void
) {
  console.log('🔍 [sprayRoutesService] Setting up listener for sprayRoutes, wallId:', wallId);
  const q = query(
    collection(db, "sprayRoutes"),
    where("wallId", "==", wallId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot: QuerySnapshot) => {
    console.log('✅ [sprayRoutesService] Got sprayRoutes snapshot, count:', snapshot.size);
    const routes: SprayRoute[] = [];
    snapshot.forEach((d) => {
      routes.push({ id: d.id, ...(d.data() as DocumentData) } as SprayRoute);
    });
    callback(routes);
  }, (err) => {
    console.error('❌ [sprayRoutesService] Firebase Error on sprayRoutes:', err.code, err.message);
  });
}

/**
 * Update a route
 */
export async function updateRoute(
  routeId: string,
  updates: Partial<Omit<SprayRoute, "id">>
): Promise<void> {
  console.log('🟠 [updateRoute] Updating route:', routeId, 'with:', updates);
  const docRef = doc(db, "sprayRoutes", routeId);
  try {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    console.log('✅ [updateRoute] Route updated successfully');
  } catch (error) {
    console.error('❌ [updateRoute] Error updating route:', error);
    throw error;
  }
}

/**
 * Delete a route
 */
export async function deleteRoute(routeId: string): Promise<void> {
  const docRef = doc(db, "sprayRoutes", routeId);
  await deleteDoc(docRef);
}

/**
 * Delete all routes for a specific wall (when wall image changes)
 */
export async function deleteAllRoutesForWall(wallId: string): Promise<void> {
  const q = query(
    collection(db, "sprayRoutes"),
    where("wallId", "==", wallId)
  );
  const snapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  snapshot.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
    // Also delete all feedbacks for this route
    const feedbacksRef = collection(db, "sprayRoutes", docSnapshot.id, "feedbacks");
    // Note: We'll handle feedbacks deletion in a separate step if needed
  });
  
  await batch.commit();
  console.log(`Deleted ${snapshot.size} routes for wall ${wallId}`);
}

// ============= FEEDBACK FUNCTIONS =============

/**
 * Add or update feedback for a route
 * Also creates a record in sprayRouteSends collection for easy querying
 */
export async function addFeedbackToRoute(
  routeId: string,
  feedback: {
    userId: string;
    userDisplayName: string;
    userPhotoURL?: string;
    starRating: number;
    suggestedGrade: string;
    comment: string;
    videoUrl?: string;
  }
): Promise<string> {
  console.log('🔵 [addFeedbackToRoute] Starting...', { routeId, userId: feedback.userId });
  
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  
  // Remove undefined fields to avoid Firebase errors
  const cleanedFeedback: Record<string, any> = {};
  Object.entries(feedback).forEach(([key, value]) => {
    if (value !== undefined) {
      cleanedFeedback[key] = value;
    }
  });
  
  console.log('🔵 [addFeedbackToRoute] Cleaned feedback:', cleanedFeedback);
  
  // Check if user already has feedback
  console.log('🔵 [addFeedbackToRoute] Checking for existing feedback...');
  const existingQuery = query(feedbacksRef, where("userId", "==", feedback.userId));
  const existingSnap = await getDocs(existingQuery);
  console.log('🔵 [addFeedbackToRoute] Existing feedback found:', !existingSnap.empty);
  
  if (!existingSnap.empty) {
    // Update existing feedback
    const existingDoc = existingSnap.docs[0];
    console.log('🔵 [addFeedbackToRoute] Updating existing feedback:', existingDoc.id);
    try {
      await updateDoc(existingDoc.ref, {
        ...cleanedFeedback,
        updatedAt: serverTimestamp(),
      });
      console.log('✅ [addFeedbackToRoute] Feedback updated successfully');
    } catch (error) {
      console.error('❌ [addFeedbackToRoute] Error updating feedback:', error);
      throw error;
    }
    
    console.log('🔵 [addFeedbackToRoute] Recalculating route stats...');
    try {
      await recalculateRouteStats(routeId);
      console.log('✅ [addFeedbackToRoute] Route stats recalculated');
    } catch (error) {
      console.error('❌ [addFeedbackToRoute] Error recalculating stats:', error);
      throw error;
    }
    return existingDoc.id;
  }
  
  // Add new feedback
  console.log('🔵 [addFeedbackToRoute] Adding new feedback...');
  
  // Debug: Check current auth state
  const currentUser = auth.currentUser;
  console.log('🔵 [addFeedbackToRoute] Current auth user:', currentUser?.uid);
  console.log('🔵 [addFeedbackToRoute] Feedback userId:', feedback.userId);
  console.log('🔵 [addFeedbackToRoute] Auth matches feedback?:', currentUser?.uid === feedback.userId);
  
  const dataToSave = {
    ...cleanedFeedback,
    routeId,
    createdAt: serverTimestamp(),
  };
  console.log('🔵 [addFeedbackToRoute] Data to save:', JSON.stringify(dataToSave, null, 2));
  
  let docRef;
  try {
    docRef = await addDoc(feedbacksRef, dataToSave);
    console.log('✅ [addFeedbackToRoute] Feedback added successfully:', docRef.id);
    
    // Also create a record in sprayRouteSends for easy completion filtering
    const sendId = `${routeId}_${feedback.userId}`;
    const sendRef = doc(db, 'sprayRouteSends', sendId);
    await setDoc(sendRef, {
      routeId,
      userId: feedback.userId,
      createdAt: serverTimestamp(),
    });
    console.log('✅ [addFeedbackToRoute] Send record created:', sendId);
  } catch (error) {
    console.error('❌ [addFeedbackToRoute] Error adding feedback:', error);
    throw error;
  }
  
  // Recalculate route statistics
  console.log('🔵 [addFeedbackToRoute] Recalculating route stats...');
  try {
    await recalculateRouteStats(routeId);
    console.log('✅ [addFeedbackToRoute] Route stats recalculated');
  } catch (error) {
    console.error('❌ [addFeedbackToRoute] Error recalculating stats:', error);
    throw error;
  }
  
  return docRef.id;
}

/**
 * Get user's feedback for a specific route
 */
export async function getUserFeedbackForRoute(
  userId: string,
  routeId: string
): Promise<SprayRouteFeedback | null> {
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  const q = query(feedbacksRef, where("userId", "==", userId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as SprayRouteFeedback;
}

/**
 * Get all feedbacks for a route
 */
export async function getFeedbacksForRoute(routeId: string): Promise<SprayRouteFeedback[]> {
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  const q = query(feedbacksRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SprayRouteFeedback[];
}

/**
 * Listen to feedbacks for a route (real-time)
 */
export function listenToFeedbacksForRoute(
  routeId: string,
  callback: (feedbacks: SprayRouteFeedback[]) => void
) {
  console.log('🔍 [listenToFeedbacksForRoute] Setting up listener for route:', routeId);
  
  if (!routeId) {
    console.warn('⚠️ [listenToFeedbacksForRoute] No routeId provided, returning empty array');
    callback([]);
    return () => {};
  }
  
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  const q = query(feedbacksRef, orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    console.log('✅ [listenToFeedbacksForRoute] Got feedbacks snapshot, count:', snapshot.size);
    const feedbacks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SprayRouteFeedback[];
    callback(feedbacks);
  }, (error) => {
    console.error('❌ [listenToFeedbacksForRoute] Firebase Error:', error.code, error.message);
    // Return empty array on error to prevent UI breaking
    callback([]);
  });
}

/**
 * Recalculate route statistics based on feedbacks
 */
async function recalculateRouteStats(routeId: string): Promise<void> {
  console.log('🟡 [recalculateRouteStats] Starting for route:', routeId);
  
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  const snapshot = await getDocs(feedbacksRef);
  console.log('🟡 [recalculateRouteStats] Feedbacks count:', snapshot.size);
  
  if (snapshot.empty) {
    console.log('🟡 [recalculateRouteStats] No feedbacks, resetting stats...');
    try {
      await updateRoute(routeId, {
        averageStarRating: 0,
        feedbackCount: 0,
        topsCount: 0,
      });
      console.log('✅ [recalculateRouteStats] Stats reset successfully');
    } catch (error) {
      console.error('❌ [recalculateRouteStats] Error resetting stats:', error);
      throw error;
    }
    return;
  }
  
  let totalStars = 0;
  const gradeVotes: Record<string, number> = {};
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    totalStars += data.starRating || 0;
    
    const grade = data.suggestedGrade;
    if (grade) {
      gradeVotes[grade] = (gradeVotes[grade] || 0) + 1;
    }
  });
  
  const feedbackCount = snapshot.size;
  const averageStarRating = totalStars / feedbackCount;
  
  // Calculate consensus grade (most voted)
  let calculatedGrade: string | undefined;
  let maxVotes = 0;
  
  for (const [grade, votes] of Object.entries(gradeVotes)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      calculatedGrade = grade;
    }
  }
  
  const statsToUpdate = {
    averageStarRating: Math.round(averageStarRating * 10) / 10,
    feedbackCount,
    topsCount: feedbackCount,
    calculatedGrade,
  };
  console.log('🟡 [recalculateRouteStats] Updating route with stats:', statsToUpdate);
  
  try {
    await updateRoute(routeId, statsToUpdate);
    console.log('✅ [recalculateRouteStats] Stats updated successfully');
  } catch (error) {
    console.error('❌ [recalculateRouteStats] Error updating stats:', error);
    throw error;
  }
}

/**
 * Listen to all routes the user has given feedback on (considered as "completed")
 * Uses the sprayRouteSends collection for simple querying
 */
export function listenToUserFeedbackRoutes(
  userId: string,
  callback: (routeIds: Set<string>) => void
): () => void {
  console.log('🔍 [listenToUserFeedbackRoutes] Setting up listener for userId:', userId);
  
  const sendsQuery = query(
    collection(db, 'sprayRouteSends'),
    where('userId', '==', userId)
  );
  
  return onSnapshot(
    sendsQuery,
    (snapshot) => {
      console.log('✅ [listenToUserFeedbackRoutes] Got snapshot, docs count:', snapshot.size);
      const routeIds = new Set<string>();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.routeId) {
          routeIds.add(data.routeId);
        }
      });
      console.log('✅ [listenToUserFeedbackRoutes] Route IDs:', Array.from(routeIds));
      callback(routeIds);
    },
    (error) => {
      console.error('❌ [listenToUserFeedbackRoutes] Error:', error.code, error.message);
      callback(new Set<string>());
    }
  );
}
