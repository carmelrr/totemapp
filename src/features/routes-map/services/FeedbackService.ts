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
} from "firebase/firestore";
import { db } from "@/features/data/firebase";
import { RouteStatsService } from "./RouteStatsService";
import { UserStatsService } from "./UserStatsService";
import { triggerStatsRefresh } from "@/utils/events/statsRefreshEvent";

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
            starRating: number;
            suggestedGrade?: string;
            comment?: string;
            isCompleted: boolean;
        }
    ): Promise<void> {
        try {
            const feedbackWithMeta = {
                ...feedbackData,
                routeId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await addDoc(feedbacksRef, feedbackWithMeta);

            // Update route statistics
            await RouteStatsService.updateRouteStatistics(routeId);

            // Update user statistics
            await UserStatsService.updateUserStats(
                feedbackData.userId,
                {
                    starRating: feedbackData.starRating,
                    suggestedGrade: feedbackData.suggestedGrade,
                    isCompleted: feedbackData.isCompleted,
                },
                "add"
            );

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
            isCompleted: boolean;
        }>
    ): Promise<void> {
        try {
            const feedbackRef = doc(feedbacksRef, feedbackId);
            const feedbackDoc = await getDoc(feedbackRef);

            if (!feedbackDoc.exists()) {
                throw new Error("Feedback not found");
            }

            await updateDoc(feedbackRef, {
                ...feedbackData,
                updatedAt: serverTimestamp(),
            });

            // Update route statistics
            const feedback = feedbackDoc.data();
            if (feedback?.routeId) {
                await RouteStatsService.updateRouteStatistics(feedback.routeId);

                // Update user statistics
                await UserStatsService.updateUserStats(
                    feedback.userId,
                    {
                        starRating: feedback.starRating,
                        suggestedGrade: feedback.suggestedGrade,
                        isCompleted: feedback.isCompleted,
                    },
                    "update"
                );

                // Trigger stats refresh for any listening components
                triggerStatsRefresh();
            }
        } catch (error) {
            console.error("Error updating feedback:", error);
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

            // Update route statistics
            if (feedback?.routeId) {
                await RouteStatsService.updateRouteStatistics(feedback.routeId);

                // Update user statistics
                await UserStatsService.updateUserStats(
                    feedback.userId,
                    {
                        starRating: feedback.starRating,
                        suggestedGrade: feedback.suggestedGrade,
                        isCompleted: feedback.isCompleted,
                    },
                    "remove"
                );

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
     * IMPORTANT: Only count grades from users who completed the route
     */
    static calculateSmartAverageGrade(route: any, feedbacks: any[]): string | null {
        if (!feedbacks || feedbacks.length === 0) return null;

        // Filter only completed feedbacks
        const completedFeedbacks = feedbacks.filter(f => f.isCompleted);
        
        if (completedFeedbacks.length === 0) return null;

        const gradeValues = completedFeedbacks
            .map(f => f.suggestedGrade)
            .filter(grade => grade && typeof grade === 'string')
            .map(grade => this.gradeToNumericValue(grade))
            .filter(value => value !== null);

        if (gradeValues.length === 0) return null;

        const average = gradeValues.reduce((sum, val) => sum + val!, 0) / gradeValues.length;
        return this.numericValueToGrade(Math.round(average));
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
