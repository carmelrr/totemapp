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
import { getColorTranslationKey } from '../utils/colors';
import { getColorSettingSync, initializeColorSettings } from './ColorSettingsService';
import { he as heTranslations } from '@/features/language/translations/he';
import { en as enTranslations } from '@/features/language/translations/en';

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
            // Get the original route to get its original grade
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
                // No feedbacks, set default values - use original grade
                await this.updateRouteDoc(routeId, {
                    averageStarRating: 0,
                    feedbackCount: 0,
                    completionCount: 0,
                    calculatedGrade: originalGrade || null,
                    gradeDistribution: {},
                });
                return;
            }

            // Calculate statistics using business logic utility
            // Pass original grade so it's included when <6 feedbacks
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

    /**
     * Recalculate statistics for ALL routes
     * Useful when the calculation logic changes
     */
    static async recalculateAllRoutes(): Promise<{ success: number; failed: number }> {
        try {
            const routesSnapshot = await getDocs(this.routesRef);
            let success = 0;
            let failed = 0;

            for (const routeDoc of routesSnapshot.docs) {
                try {
                    await this.updateRouteStatistics(routeDoc.id);
                    success++;
                    console.log(`Recalculated stats for route ${routeDoc.id}`);
                } catch (error) {
                    failed++;
                    console.error(`Failed to recalculate route ${routeDoc.id}:`, error);
                }
            }

            console.log(`Recalculation complete: ${success} success, ${failed} failed`);
            return { success, failed };
        } catch (error) {
            console.error("Error recalculating all routes:", error);
            throw error;
        }
    }

    /**
     * Recalculate route names for ALL routes
     * Adds nameHe and nameEn based on color and grade
     * @param forceUpdate - if true, updates all routes even if they already have names
     */
    static async recalculateAllRouteNames(forceUpdate: boolean = false): Promise<{ success: number; failed: number; skipped: number }> {
        try {
            // Initialize color settings first
            await initializeColorSettings();
            
            const routesSnapshot = await getDocs(this.routesRef);
            let success = 0;
            let failed = 0;
            let skipped = 0;

            for (const routeDoc of routesSnapshot.docs) {
                try {
                    const routeData = routeDoc.data();
                    
                    // Skip if already has both names (unless forceUpdate is true)
                    if (!forceUpdate && routeData.nameHe && routeData.nameEn) {
                        skipped++;
                        continue;
                    }
                    
                    const color = routeData.color;
                    const grade = routeData.grade;
                    
                    if (!color || !grade) {
                        skipped++;
                        continue;
                    }
                    
                    // Get color names
                    const colorKey = getColorTranslationKey(color);
                    let colorNameHe: string;
                    let colorNameEn: string;
                    
                    // Check for custom color setting
                    const customSetting = getColorSettingSync(color);
                    if (customSetting) {
                        colorNameHe = customSetting.nameHe;
                        colorNameEn = customSetting.nameEn;
                    } else if (routeData.colorNameHe && routeData.colorNameEn) {
                        // Use existing custom color names on the route
                        colorNameHe = routeData.colorNameHe;
                        colorNameEn = routeData.colorNameEn;
                    } else {
                        // Get from translations
                        colorNameHe = heTranslations.colors[colorKey as keyof typeof heTranslations.colors] || colorKey;
                        colorNameEn = enTranslations.colors[colorKey as keyof typeof enTranslations.colors] || colorKey;
                    }
                    
                    const nameHe = `${colorNameHe} ${grade}`;
                    const nameEn = `${colorNameEn} ${grade}`;
                    
                    // Update the route
                    await updateDoc(doc(this.routesRef, routeDoc.id), {
                        nameHe,
                        nameEn,
                        updatedAt: serverTimestamp(),
                    });
                    
                    success++;
                    console.log(`Updated names for route ${routeDoc.id}: ${nameHe} / ${nameEn}`);
                } catch (error) {
                    failed++;
                    console.error(`Failed to update names for route ${routeDoc.id}:`, error);
                }
            }

            console.log(`Route names recalculation complete: ${success} success, ${failed} failed, ${skipped} skipped`);
            return { success, failed, skipped };
        } catch (error) {
            console.error("Error recalculating all route names:", error);
            throw error;
        }
    }
}
