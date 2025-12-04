// src/features/spraywall/routesService.ts
// Firebase functions for spray wall routes

import { db } from "@/features/data/firebase";
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

  const docRef = await addDoc(collection(db, "sprayRoutes"), {
    wallId,
    name,
    grade,
    holds,
    createdAt: serverTimestamp(),
    createdBy: createdBy ?? null,
    creatorName: creatorName ?? null,
    // Initialize statistics
    averageStarRating: 0,
    calculatedGrade: grade,
    feedbackCount: 0,
    topsCount: 0,
  });

  return docRef.id;
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
  const q = query(
    collection(db, "sprayRoutes"),
    where("wallId", "==", wallId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot: QuerySnapshot) => {
    const routes: SprayRoute[] = [];
    snapshot.forEach((d) => {
      routes.push({ id: d.id, ...(d.data() as DocumentData) } as SprayRoute);
    });
    callback(routes);
  });
}

/**
 * Update a route
 */
export async function updateRoute(
  routeId: string,
  updates: Partial<Omit<SprayRoute, "id">>
): Promise<void> {
  const docRef = doc(db, "sprayRoutes", routeId);
  await updateDoc(docRef, updates);
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
 */
export async function addFeedbackToRoute(
  routeId: string,
  feedback: {
    userId: string;
    userDisplayName: string;
    starRating: number;
    suggestedGrade: string;
    comment: string;
  }
): Promise<string> {
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  
  // Check if user already has feedback
  const existingQuery = query(feedbacksRef, where("userId", "==", feedback.userId));
  const existingSnap = await getDocs(existingQuery);
  
  if (!existingSnap.empty) {
    // Update existing feedback
    const existingDoc = existingSnap.docs[0];
    await updateDoc(existingDoc.ref, {
      ...feedback,
      updatedAt: serverTimestamp(),
    });
    await recalculateRouteStats(routeId);
    return existingDoc.id;
  }
  
  // Add new feedback
  const docRef = await addDoc(feedbacksRef, {
    ...feedback,
    routeId,
    createdAt: serverTimestamp(),
  });
  
  // Recalculate route statistics
  await recalculateRouteStats(routeId);
  
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
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  const q = query(feedbacksRef, orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const feedbacks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SprayRouteFeedback[];
    callback(feedbacks);
  });
}

/**
 * Recalculate route statistics based on feedbacks
 */
async function recalculateRouteStats(routeId: string): Promise<void> {
  const feedbacksRef = collection(db, "sprayRoutes", routeId, "feedbacks");
  const snapshot = await getDocs(feedbacksRef);
  
  if (snapshot.empty) {
    await updateRoute(routeId, {
      averageStarRating: 0,
      feedbackCount: 0,
      topsCount: 0,
    });
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
  
  await updateRoute(routeId, {
    averageStarRating: Math.round(averageStarRating * 10) / 10,
    feedbackCount,
    topsCount: feedbackCount, // Each feedback = one top
    calculatedGrade,
  });
}
