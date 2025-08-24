/**
 * @fileoverview שירות ניהול סטטיסטיקות משתמשים - User statistics management
 * @description User Stats Service - handles user statistics and achievements
 */

import {
    collection,
    doc,
    updateDoc,
    getDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/features/data/firebase";

/**
 * שירות ניהול סטטיסטיקות משתמשים הקשורות למסלולים ומשוב
 * Service for managing user statistics related to routes and feedback
 * Extracted from the deprecated routesService.ts
 */
export class UserStatsService {
    private static usersRef = collection(db, "users");

    /**
     * Update user statistics when feedback is added or removed
     */
    static async updateUserStats(
        userId: string,
        feedbackData: {
            starRating: number;
            suggestedGrade?: string;
            isCompleted: boolean;
        },
        operation: "add" | "remove" | "update"
    ): Promise<void> {
        try {
            const userRef = doc(this.usersRef, userId);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                console.warn(`User ${userId} not found for stats update`);
                return;
            }

            const userData = userDoc.data();
            const currentStats = userData.stats || {};

            let newStats = { ...currentStats };

            switch (operation) {
                case "add":
                    newStats = {
                        ...newStats,
                        totalFeedbacks: (currentStats.totalFeedbacks || 0) + 1,
                        totalStarRating: (currentStats.totalStarRating || 0) + feedbackData.starRating,
                        completedRoutes: feedbackData.isCompleted
                            ? (currentStats.completedRoutes || 0) + 1
                            : (currentStats.completedRoutes || 0),
                    };
                    break;

                case "remove":
                    newStats = {
                        ...newStats,
                        totalFeedbacks: Math.max(0, (currentStats.totalFeedbacks || 0) - 1),
                        totalStarRating: Math.max(0, (currentStats.totalStarRating || 0) - feedbackData.starRating),
                        completedRoutes: feedbackData.isCompleted
                            ? Math.max(0, (currentStats.completedRoutes || 0) - 1)
                            : (currentStats.completedRoutes || 0),
                    };
                    break;

                case "update":
                    // For updates, we'd need the old values to properly calculate the difference
                    // For now, just update the timestamp
                    break;
            }

            // Calculate average rating
            if (newStats.totalFeedbacks > 0) {
                newStats.averageRating = newStats.totalStarRating / newStats.totalFeedbacks;
            } else {
                newStats.averageRating = 0;
            }

            await updateDoc(userRef, {
                stats: newStats,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error updating user stats:", error);
            throw error;
        }
    }

    /**
     * Get user statistics
     */
    static async getUserStats(userId: string): Promise<any> {
        try {
            const userRef = doc(this.usersRef, userId);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                return {
                    totalFeedbacks: 0,
                    totalStarRating: 0,
                    averageRating: 0,
                    completedRoutes: 0,
                };
            }

            return userDoc.data().stats || {
                totalFeedbacks: 0,
                totalStarRating: 0,
                averageRating: 0,
                completedRoutes: 0,
            };
        } catch (error) {
            console.error("Error getting user stats:", error);
            throw error;
        }
    }

    /**
     * Get leaderboard data
     */
    static async getLeaderboard(limit = 10): Promise<any[]> {
        try {
            // This would require a more complex query structure
            // For now, return empty array
            console.warn("Leaderboard functionality not yet implemented");
            return [];
        } catch (error) {
            console.error("Error getting leaderboard:", error);
            throw error;
        }
    }

    /**
     * Reset user statistics
     */
    static async resetUserStats(userId: string): Promise<void> {
        try {
            const userRef = doc(this.usersRef, userId);

            await updateDoc(userRef, {
                stats: {
                    totalFeedbacks: 0,
                    totalStarRating: 0,
                    averageRating: 0,
                    completedRoutes: 0,
                },
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error resetting user stats:", error);
            throw error;
        }
    }
}
