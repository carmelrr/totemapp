/**
 * @fileoverview שירות ניהול משוב מסלולים - Feedback operations for routes
 * @description Feedback Service - handles user feedback and ratings for climbing routes
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    getDoc,
    serverTimestamp,
    getDocs,
    setDoc,
} from "firebase/firestore";
import { db } from "@/features/data/firebase";
import { RouteStatsService } from "./RouteStatsService";
import { UserStatsService } from "./UserStatsService";
import { triggerStatsRefresh } from "@/utils/events/statsRefreshEvent";
import { clearFeedCache } from "@/features/social/socialService";

/**
 * הפניות לאוספי Firestore
 * Firestore collection references
 */
const feedbacksRef = collection(db, "routeFeedbacks");
const routesRef = collection(db, "routes");

/**
 * Service for managing route feedback functionality
 * Migrated from the deprecated routesService.ts
 */
export class FeedbackService {
    /**
     * Subscribe to feedbacks for a specific route
     */
    static subscribeFeedbacksForRoute(
        routeId: string,
        callback: (feedbacks: any[]) => void
    ): () => void {
        const q = query(feedbacksRef, where("routeId", "==", routeId));

        return onSnapshot(
            q,
            (snapshot) => {
                const feedbacks = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                callback(feedbacks);
            },
            (error) => {
                console.error("Error subscribing to route feedbacks:", error);
            }
        );
    }

    /**
     * Add feedback to a route
     */
    static async addFeedbackToRoute(
        routeId: string,
        feedbackData: {
            userId: string;
            userDisplayName?: string;
            userPhotoURL?: string;
            starRating?: number;
            suggestedGrade?: string;
            comment?: string;
            videoUrl?: string;
            isCompleted: boolean;
            isQuickSend?: boolean;
        }
    ): Promise<void> {
        try {
            console.log("📝 Adding feedback for route:", routeId, "user:", feedbackData.userId);
            
            const feedbackWithMeta = {
                ...feedbackData,
                routeId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // Remove undefined fields — Firestore rejects undefined values
            Object.keys(feedbackWithMeta).forEach(key => {
                if ((feedbackWithMeta as any)[key] === undefined) {
                    delete (feedbackWithMeta as any)[key];
                }
            });

            await addDoc(feedbacksRef, feedbackWithMeta);
            console.log("✅ Feedback added successfully");

            // Clear feed cache so new feedback appears immediately
            clearFeedCache();

            // Update userRoutes for completion filter
            if (feedbackData.isCompleted) {
                try {
                    const userRoutesRef = doc(db, 'userRoutes', feedbackData.userId);
                    const userRoutesDoc = await getDoc(userRoutesRef);
                    const existingRoutes = userRoutesDoc.exists() ? (userRoutesDoc.data().routes || {}) : {};
                    
                    const updatedRoutes = {
                        ...existingRoutes,
                        [routeId]: {
                            ...(existingRoutes[routeId] || {}),
                            status: 'sent',
                            attempts: (existingRoutes[routeId]?.attempts || 0) + 1,
                            lastAttempt: new Date(),
                        }
                    };
                    
                    await setDoc(userRoutesRef, { routes: updatedRoutes }, { merge: true });
                    console.log("✅ UserRoutes updated for completion filter");
                } catch (userRoutesError) {
                    console.warn("⚠️ Could not update userRoutes:", userRoutesError);
                }
            }

            // Update route statistics
            try {
                await RouteStatsService.updateRouteStatistics(routeId);
            } catch (statsError) {
                console.warn("⚠️ Could not update route stats:", statsError);
            }

            // Update user statistics (don't fail if this fails)
            try {
                await UserStatsService.updateUserStats(
                    feedbackData.userId,
                    {
                        starRating: feedbackData.starRating || 0,
                        suggestedGrade: feedbackData.suggestedGrade,
                        isCompleted: feedbackData.isCompleted,
                        isQuickSend: feedbackData.isQuickSend,
                    },
                    "add"
                );
            } catch (userStatsError) {
                console.warn("⚠️ Could not update user stats:", userStatsError);
            }

            // Trigger stats refresh for any listening components (e.g., ProfileScreen)
            triggerStatsRefresh();
        } catch (error) {
            console.error("Error adding feedback:", error);
            throw error;
        }
    }

    /**
     * Update existing feedback
     */
    static async updateFeedback(
        feedbackId: string,
        feedbackData: Partial<{
            starRating: number;
            suggestedGrade: string;
            comment: string;
            videoUrl: string;
            isCompleted: boolean;
            isQuickSend: boolean;
        }>
    ): Promise<void> {
        try {
            const feedbackRef = doc(feedbacksRef, feedbackId);
            const feedbackDoc = await getDoc(feedbackRef);

            if (!feedbackDoc.exists()) {
                throw new Error("Feedback not found");
            }

            const oldFeedback = feedbackDoc.data();
            const wasCompleted = oldFeedback?.isCompleted === true;
            const isNowCompleted = feedbackData.isCompleted;

            // Remove undefined fields — Firestore rejects undefined values
            const cleanedData: Record<string, any> = {
                ...feedbackData,
                updatedAt: serverTimestamp(),
            };
            Object.keys(cleanedData).forEach(key => {
                if (cleanedData[key] === undefined) {
                    delete cleanedData[key];
                }
            });

            await updateDoc(feedbackRef, cleanedData);

            // Handle completion status change
            if (oldFeedback?.routeId && oldFeedback?.userId) {
                // If completion was removed, clean up userRoutes
                if (wasCompleted && isNowCompleted === false) {
                    try {
                        const userRoutesRef = doc(db, 'userRoutes', oldFeedback.userId);
                        const userRoutesDoc = await getDoc(userRoutesRef);
                        if (userRoutesDoc.exists()) {
                            const existingRoutes = userRoutesDoc.data().routes || {};
                            const { [oldFeedback.routeId]: _removed, ...remainingRoutes } = existingRoutes;
                            await setDoc(userRoutesRef, { routes: remainingRoutes }, { merge: true });
                        }
                    } catch (e) {
                        console.warn('⚠️ Could not clean up userRoutes:', e);
                    }
                }
                // If completion was added, add to userRoutes
                if (!wasCompleted && isNowCompleted === true) {
                    try {
                        const userRoutesRef = doc(db, 'userRoutes', oldFeedback.userId);
                        const userRoutesDoc = await getDoc(userRoutesRef);
                        const existingRoutes = userRoutesDoc.exists() ? (userRoutesDoc.data().routes || {}) : {};
                        const updatedRoutes = {
                            ...existingRoutes,
                            [oldFeedback.routeId]: {
                                ...(existingRoutes[oldFeedback.routeId] || {}),
                                status: 'sent',
                                attempts: (existingRoutes[oldFeedback.routeId]?.attempts || 0) + 1,
                                lastAttempt: new Date(),
                            }
                        };
                        await setDoc(userRoutesRef, { routes: updatedRoutes }, { merge: true });
                    } catch (e) {
                        console.warn('⚠️ Could not update userRoutes:', e);
                    }
                }
            }

            // Update route statistics (non-critical — don't fail feedback save)
            if (oldFeedback?.routeId) {
                try {
                    await RouteStatsService.updateRouteStatistics(oldFeedback.routeId);
                } catch (statsError) {
                    console.warn("⚠️ Could not update route stats:", statsError);
                }

                // Update user statistics properly based on completion change
                try {
                    if (wasCompleted && isNowCompleted === false) {
                        // Completion removed — decrement
                        await UserStatsService.updateUserStats(
                            oldFeedback.userId,
                            {
                                starRating: oldFeedback.starRating || 0,
                                suggestedGrade: oldFeedback.suggestedGrade,
                                isCompleted: true,
                                isQuickSend: oldFeedback.isQuickSend,
                            },
                            "remove"
                        );
                    } else if (!wasCompleted && isNowCompleted === true) {
                        // Completion added — increment
                        await UserStatsService.updateUserStats(
                            oldFeedback.userId,
                            {
                                starRating: (feedbackData.starRating ?? oldFeedback.starRating) || 0,
                                suggestedGrade: feedbackData.suggestedGrade ?? oldFeedback.suggestedGrade,
                                isCompleted: true,
                                isQuickSend: feedbackData.isQuickSend ?? oldFeedback.isQuickSend,
                            },
                            "add"
                        );
                    } else if (wasCompleted) {
                        // Completion unchanged but the rating/grade may have
                        // changed (e.g. a quick send was upgraded to a full
                        // rating). Reconcile the rating stats by removing the
                        // old contribution and adding the new one, while
                        // leaving completedRoutes untouched (isCompleted:false).
                        await UserStatsService.updateUserStats(
                            oldFeedback.userId,
                            {
                                starRating: oldFeedback.starRating || 0,
                                suggestedGrade: oldFeedback.suggestedGrade,
                                isCompleted: false,
                                isQuickSend: oldFeedback.isQuickSend,
                            },
                            "remove"
                        );
                        await UserStatsService.updateUserStats(
                            oldFeedback.userId,
                            {
                                starRating: (feedbackData.starRating ?? oldFeedback.starRating) || 0,
                                suggestedGrade: feedbackData.suggestedGrade ?? oldFeedback.suggestedGrade,
                                isCompleted: false,
                                isQuickSend: feedbackData.isQuickSend ?? oldFeedback.isQuickSend,
                            },
                            "add"
                        );
                    }
                } catch (userStatsError) {
                    console.warn("⚠️ Could not update user stats:", userStatsError);
                }

                // Trigger stats refresh for any listening components
                triggerStatsRefresh();
            }
        } catch (error) {
            console.error("Error updating feedback:", error);
            throw error;
        }
    }

    /**
     * Undo a route completion — sets isCompleted to false, updates stats + userRoutes + leaderboard
     */
    static async undoCompletion(feedbackId: string): Promise<void> {
        try {
            const feedbackRef = doc(feedbacksRef, feedbackId);
            const feedbackDoc = await getDoc(feedbackRef);

            if (!feedbackDoc.exists()) {
                throw new Error("Feedback not found");
            }

            const feedback = feedbackDoc.data();
            if (!feedback.isCompleted) {
                console.log('Feedback already not completed, nothing to undo');
                return;
            }

            // Set isCompleted to false
            await updateDoc(feedbackRef, {
                isCompleted: false,
                updatedAt: serverTimestamp(),
            });

            // Remove from userRoutes completion tracking
            if (feedback.userId && feedback.routeId) {
                try {
                    const userRoutesRef = doc(db, 'userRoutes', feedback.userId);
                    const userRoutesDoc = await getDoc(userRoutesRef);
                    if (userRoutesDoc.exists()) {
                        const existingRoutes = userRoutesDoc.data().routes || {};
                        const { [feedback.routeId]: _removed, ...remainingRoutes } = existingRoutes;
                        await setDoc(userRoutesRef, { routes: remainingRoutes }, { merge: true });
                        console.log('✅ Removed route from userRoutes');
                    }
                } catch (e) {
                    console.warn('⚠️ Could not clean up userRoutes:', e);
                }
            }

            // Update route statistics (completionCount will decrease)
            if (feedback.routeId) {
                try {
                    await RouteStatsService.updateRouteStatistics(feedback.routeId);
                } catch (statsError) {
                    console.warn('⚠️ Could not update route stats:', statsError);
                }
            }

            // Update user statistics (decrement completedRoutes)
            if (feedback.userId) {
                try {
                    await UserStatsService.updateUserStats(
                        feedback.userId,
                        {
                            starRating: feedback.starRating,
                            suggestedGrade: feedback.suggestedGrade,
                            isCompleted: true, // was completed, so pass true for remove calculation
                        },
                        "remove"
                    );
                } catch (userStatsError) {
                    console.warn('⚠️ Could not update user stats:', userStatsError);
                }
            }

            // Clear feed cache and trigger refresh
            clearFeedCache();
            triggerStatsRefresh();
        } catch (error) {
            console.error('Error undoing completion:', error);
            throw error;
        }
    }

    /**
     * Delete feedback
     */
    static async deleteFeedback(feedbackId: string): Promise<void> {
        try {
            const feedbackRef = doc(feedbacksRef, feedbackId);
            const feedbackDoc = await getDoc(feedbackRef);

            if (!feedbackDoc.exists()) {
                throw new Error("Feedback not found");
            }

            const feedback = feedbackDoc.data();
            await deleteDoc(feedbackRef);

            // Update route statistics (non-critical — don't fail feedback delete)
            if (feedback?.routeId) {
                try {
                    await RouteStatsService.updateRouteStatistics(feedback.routeId);
                } catch (statsError) {
                    console.warn("⚠️ Could not update route stats:", statsError);
                }

                // Update user statistics (non-critical)
                try {
                    await UserStatsService.updateUserStats(
                        feedback.userId,
                        {
                            starRating: feedback.starRating,
                            suggestedGrade: feedback.suggestedGrade,
                            isCompleted: feedback.isCompleted,
                        },
                        "remove"
                    );
                } catch (userStatsError) {
                    console.warn("⚠️ Could not update user stats:", userStatsError);
                }

                // Trigger stats refresh for any listening components
                triggerStatsRefresh();
            }
        } catch (error) {
            console.error("Error deleting feedback:", error);
            throw error;
        }
    }

    /**
     * Get user's feedback for a specific route
     */
    static async getUserFeedbackForRoute(
        userId: string,
        routeId: string
    ): Promise<any | null> {
        try {
            const q = query(
                feedbacksRef,
                where("userId", "==", userId),
                where("routeId", "==", routeId)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return null;
            }

            // Return the first (should be only) feedback
            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data(),
            };
        } catch (error) {
            console.error("Error getting user feedback:", error);
            return null;
        }
    }

    /**
     * Update route statistics based on current feedbacks
     */
    private static async updateRouteStatistics(routeId: string): Promise<void> {
        try {
            const q = query(feedbacksRef, where("routeId", "==", routeId));
            const snapshot = await getDocs(q);

            const feedbacks = snapshot.docs.map(doc => doc.data());

            // Calculate statistics
            const averageStarRating = this.calculateAverageStarRating(feedbacks);
            const completionCount = feedbacks.filter(f => f.isCompleted).length;
            const feedbackCount = feedbacks.length;
            const calculatedGrade = this.calculateSmartAverageGrade(null, feedbacks);

            // Update route document
            const routeRef = doc(routesRef, routeId);
            await updateDoc(routeRef, {
                averageStarRating,
                completionCount,
                feedbackCount,
                calculatedGrade,
            });
        } catch (error) {
            console.error("Error updating route statistics:", error);
        }
    }

    /**
     * Calculate average star rating from feedbacks
     * IMPORTANT: Only count ratings from users who completed the route
     */
    static calculateAverageStarRating(feedbacks: any[]): number {
        if (!feedbacks || feedbacks.length === 0) return 0;

        // Filter only completed feedbacks
        const completedFeedbacks = feedbacks.filter(f => f.isCompleted);
        
        if (completedFeedbacks.length === 0) return 0;

        const validRatings = completedFeedbacks
            .map(f => f.starRating)
            .filter(rating => typeof rating === 'number' && rating >= 1 && rating <= 5);

        if (validRatings.length === 0) return 0;

        const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
        return Math.round((sum / validRatings.length) * 10) / 10; // Round to 1 decimal
    }

    /**
     * Calculate smart average grade from feedbacks
     * IMPORTANT: Includes the original route grade in the average calculation
     * Uses 0.2 rounding threshold: 5.8 -> 6, 5.2 -> 5
     */
    static calculateSmartAverageGrade(route: any, feedbacks: any[]): string | null {
        const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18'];
        const originalGrade = route?.grade;
        
        // Filter only completed feedbacks
        const completedFeedbacks = (feedbacks || []).filter(f => f.isCompleted);

        // Collect all grade indices - including original grade
        const allGradeIndices: number[] = [];
        
        // Add original grade to the calculation (counts as 1 vote)
        if (originalGrade && V_GRADES.includes(originalGrade)) {
            allGradeIndices.push(V_GRADES.indexOf(originalGrade));
        }
        
        // Add all community feedback grades
        completedFeedbacks.forEach(f => {
            if (f.suggestedGrade && V_GRADES.includes(f.suggestedGrade)) {
                allGradeIndices.push(V_GRADES.indexOf(f.suggestedGrade));
            }
        });
        
        if (allGradeIndices.length === 0) return originalGrade || null;
        
        // Calculate average index
        const averageIndex = allGradeIndices.reduce((sum, idx) => sum + idx, 0) / allGradeIndices.length;
        
        // Round with 0.8 threshold: only round UP if fraction >= 0.8
        const fraction = averageIndex - Math.floor(averageIndex);
        const roundedIndex = fraction >= 0.8 ? Math.ceil(averageIndex) : Math.floor(averageIndex);
        
        // Clamp to valid range
        const clampedIndex = Math.max(0, Math.min(roundedIndex, V_GRADES.length - 1));
        return V_GRADES[clampedIndex];
    }

    /**
     * Convert V-grade to numeric value for calculations
     */
    private static gradeToNumericValue(grade: string): number | null {
        if (!grade || typeof grade !== 'string') return null;

        const match = grade.match(/^V(\d+)$/);
        if (!match) return null;

        return parseInt(match[1], 10);
    }

    /**
     * Convert numeric value back to V-grade
     */
    private static numericValueToGrade(value: number): string {
        return `V${value}`;
    }

    /**
     * Migrate feedbacks with display name (for backwards compatibility)
     */
    static async migrateFeedbacksWithDisplayName(): Promise<void> {
        // This function can be implemented if needed for data migration
        console.log("migrateFeedbacksWithDisplayName - not implemented in new service");
    }
}
