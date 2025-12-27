/**
 * @fileoverview שירות ניהול סטטיסטיקות מסלולים - Route statistics management
 * @description Route Stats Service - handles calculations and updates for route statistics
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
} from 'firebase/firestore';

import { db } from '@/features/data/firebase';
import { calculateRouteStats, calculateDifficultyConsensus, type FeedbackData } from '@/utils/businessLogic/routeCalculations';

/**
 * שירות ניהול סטטיסטיקות מסלולים וחישובים
 * Service for managing route statistics and calculations
 * Extracted from the deprecated routesService.ts
 */
export class RouteStatsService {
    private static routesRef = collection(db, "routes");
    private static feedbacksRef = collection(db, "routeFeedbacks");

    /**
     * Calculate and update route statistics based on feedback
     */
    static async updateRouteStatistics(routeId: string): Promise<void> {
        try {
            // Get route document to get original grade
            const routeRef = doc(this.routesRef, routeId);
            const routeDoc = await getDoc(routeRef);
            const originalGrade = routeDoc.exists() ? routeDoc.data()?.grade : undefined;

            // Get all feedbacks for this route
            const feedbackQuery = query(
                this.feedbacksRef,
                where("routeId", "==", routeId)
            );
            const feedbackSnapshot = await getDocs(feedbackQuery);
            const feedbacks = feedbackSnapshot.docs.map(doc => doc.data());

            if (feedbacks.length === 0) {
                // No feedbacks, set default values
                await this.updateRouteDoc(routeId, {
                    averageStarRating: 0,
                    feedbackCount: 0,
                    completionCount: 0,
                    calculatedGrade: null,
                    gradeDistribution: {},
                });
                return;
            }

            // Calculate statistics using business logic utility
            // Pass originalGrade to enable ±1 validation
            const typedFeedbacks: FeedbackData[] = feedbacks.map(fb => ({
                starRating: fb.starRating || 0,
                suggestedGrade: fb.suggestedGrade,
                isCompleted: fb.isCompleted || false,
            }));
            const stats = calculateRouteStats(typedFeedbacks, originalGrade);

            // Update route document
            await this.updateRouteDoc(routeId, stats);
        } catch (error) {
            console.error("Error updating route statistics:", error);
            throw error;
        }
    }

    /**
     * Update route document with new statistics
     */
    private static async updateRouteDoc(routeId: string, stats: any): Promise<void> {
        const routeRef = doc(this.routesRef, routeId);

        await updateDoc(routeRef, {
            ...stats,
            updatedAt: serverTimestamp(),
        });
    }

    /**
     * Get route statistics
     */
    static async getRouteStats(routeId: string): Promise<any> {
        try {
            const routeRef = doc(this.routesRef, routeId);
            const routeDoc = await getDoc(routeRef);

            if (!routeDoc.exists()) {
                throw new Error(`Route ${routeId} not found`);
            }

            const data = routeDoc.data();
            return {
                averageStarRating: data.averageStarRating || 0,
                feedbackCount: data.feedbackCount || 0,
                completionCount: data.completionCount || 0,
                calculatedGrade: data.calculatedGrade || null,
                gradeDistribution: data.gradeDistribution || {},
            };
        } catch (error) {
            console.error("Error getting route stats:", error);
            throw error;
        }
    }

    /**
     * Get popular routes based on feedback
     */
    static async getPopularRoutes(limit = 10): Promise<any[]> {
        try {
            // This would require a composite query or different data structure
            // For now, return empty array
            console.warn("Popular routes functionality requires proper indexing");
            return [];
        } catch (error) {
            console.error("Error getting popular routes:", error);
            throw error;
        }
    }

    /**
     * Get route difficulty analysis
     */
    static async getRouteDifficultyAnalysis(routeId: string): Promise<any> {
        try {
            const feedbackQuery = query(
                this.feedbacksRef,
                where("routeId", "==", routeId)
            );
            const feedbackSnapshot = await getDocs(feedbackQuery);
            const feedbacks = feedbackSnapshot.docs.map(doc => doc.data());

            if (feedbacks.length === 0) {
                return {
                    suggestedGrades: {},
                    averageDifficulty: null,
                    consensus: null,
                };
            }

            // Grade analysis
            const gradeDistribution: Record<string, number> = {};
            feedbacks.forEach(fb => {
                if (fb.suggestedGrade) {
                    gradeDistribution[fb.suggestedGrade] = (gradeDistribution[fb.suggestedGrade] || 0) + 1;
                }
            });

            // Calculate consensus (percentage of most common grade)
            let consensus = 0;
            let mostCommonGrade = null;
            if (Object.keys(gradeDistribution).length > 0) {
                const [grade, count] = Object.entries(gradeDistribution)
                    .reduce(([maxGrade, maxCount], [grade, count]) =>
                        count > maxCount ? [grade, count] : [maxGrade, maxCount]
                    );
                mostCommonGrade = grade;
                consensus = (count / feedbacks.length) * 100;
            }

            return {
                suggestedGrades: gradeDistribution,
                averageDifficulty: mostCommonGrade,
                consensus: Math.round(consensus),
                totalFeedbacks: feedbacks.length,
            };
        } catch (error) {
            console.error("Error getting route difficulty analysis:", error);
            throw error;
        }
    }
}
