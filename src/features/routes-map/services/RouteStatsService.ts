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
    setDoc,
    collectionGroup,
    writeBatch,
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

    /**
     * Sync spray route sends - create records in sprayRouteSends collection
     * for all existing feedbacks in sprayRoutes/{routeId}/feedbacks
     * This is needed for the completion filter to work correctly
     */
    static async syncSprayRouteSends(): Promise<{ success: number; failed: number }> {
        try {
            console.log('🔄 [syncSprayRouteSends] Starting sync...');
            
            // Get all spray routes
            const sprayRoutesRef = collection(db, 'sprayRoutes');
            const sprayRoutesSnapshot = await getDocs(sprayRoutesRef);
            
            let success = 0;
            let failed = 0;
            
            for (const routeDoc of sprayRoutesSnapshot.docs) {
                try {
                    const routeId = routeDoc.id;
                    
                    // Get all feedbacks for this route
                    const feedbacksRef = collection(db, 'sprayRoutes', routeId, 'feedbacks');
                    const feedbacksSnapshot = await getDocs(feedbacksRef);
                    
                    for (const feedbackDoc of feedbacksSnapshot.docs) {
                        const feedbackData = feedbackDoc.data();
                        const userId = feedbackData.userId;
                        
                        if (userId) {
                            // Create send record
                            const sendId = `${routeId}_${userId}`;
                            const sendRef = doc(db, 'sprayRouteSends', sendId);
                            
                            await setDoc(sendRef, {
                                routeId,
                                userId,
                                createdAt: feedbackData.createdAt || serverTimestamp(),
                            }, { merge: true });
                            
                            success++;
                        }
                    }
                    
                    console.log(`✅ [syncSprayRouteSends] Synced route ${routeId}: ${feedbacksSnapshot.size} feedbacks`);
                } catch (error) {
                    failed++;
                    console.error(`❌ [syncSprayRouteSends] Failed to sync route ${routeDoc.id}:`, error);
                }
            }
            
            console.log(`🔄 [syncSprayRouteSends] Complete: ${success} success, ${failed} failed`);
            return { success, failed };
        } catch (error) {
            console.error('❌ [syncSprayRouteSends] Error:', error);
            throw error;
        }
    }

    /**
     * Sync community route sends - verify communityRouteSends collection
     * is in sync with actual sent status
     */
    static async syncCommunityRouteSends(): Promise<{ success: number; failed: number }> {
        try {
            console.log('🔄 [syncCommunityRouteSends] Starting sync...');
            
            // Community routes sends are already stored correctly
            // Just log the current count
            const sendsRef = collection(db, 'communityRouteSends');
            const sendsSnapshot = await getDocs(sendsRef);
            
            console.log(`✅ [syncCommunityRouteSends] Found ${sendsSnapshot.size} existing send records`);
            
            return { success: sendsSnapshot.size, failed: 0 };
        } catch (error) {
            console.error('❌ [syncCommunityRouteSends] Error:', error);
            throw error;
        }
    }

    /**
     * Sync route feedbacks to userRoutes collection
     * Creates/updates entries in userRoutes for routes that have feedback with isCompleted=true
     * This enables the completion filter on the Routes Map screen
     */
    static async syncRouteFeedbacksToUserRoutes(): Promise<{ success: number; failed: number }> {
        try {
            console.log('🔄 [syncRouteFeedbacksToUserRoutes] Starting sync...');
            
            // Get all feedbacks that are marked as completed
            const feedbacksSnapshot = await getDocs(this.feedbacksRef);
            
            let success = 0;
            let failed = 0;
            
            // Group feedbacks by userId
            const userFeedbacks: Record<string, { routeId: string; createdAt: any }[]> = {};
            
            feedbacksSnapshot.docs.forEach((feedbackDoc) => {
                const data = feedbackDoc.data();
                // Check if feedback indicates completion
                if (data.userId && data.routeId && data.isCompleted) {
                    if (!userFeedbacks[data.userId]) {
                        userFeedbacks[data.userId] = [];
                    }
                    userFeedbacks[data.userId].push({
                        routeId: data.routeId,
                        createdAt: data.createdAt,
                    });
                }
            });
            
            console.log(`🔄 [syncRouteFeedbacksToUserRoutes] Found ${Object.keys(userFeedbacks).length} users with completed routes`);
            
            // Update userRoutes for each user
            for (const [userId, feedbacks] of Object.entries(userFeedbacks)) {
                try {
                    const userRoutesRef = doc(db, 'userRoutes', userId);
                    const userRoutesDoc = await getDoc(userRoutesRef);
                    const existingRoutes = userRoutesDoc.exists() ? (userRoutesDoc.data().routes || {}) : {};
                    
                    let updated = false;
                    const updatedRoutes = { ...existingRoutes };
                    
                    for (const feedback of feedbacks) {
                        // Only add if not already marked as sent/flashed
                        if (!existingRoutes[feedback.routeId] || 
                            (existingRoutes[feedback.routeId].status !== 'sent' && 
                             existingRoutes[feedback.routeId].status !== 'flashed')) {
                            updatedRoutes[feedback.routeId] = {
                                ...(existingRoutes[feedback.routeId] || {}),
                                status: 'sent',
                                attempts: (existingRoutes[feedback.routeId]?.attempts || 0) + 1,
                                lastAttempt: feedback.createdAt || new Date(),
                            };
                            updated = true;
                            success++;
                        }
                    }
                    
                    if (updated) {
                        await setDoc(userRoutesRef, { routes: updatedRoutes }, { merge: true });
                        console.log(`✅ [syncRouteFeedbacksToUserRoutes] Updated user ${userId}: ${feedbacks.length} routes`);
                    }
                } catch (error) {
                    failed++;
                    console.error(`❌ [syncRouteFeedbacksToUserRoutes] Failed to update user ${userId}:`, error);
                }
            }
            
            console.log(`🔄 [syncRouteFeedbacksToUserRoutes] Complete: ${success} routes synced, ${failed} failed`);
            return { success, failed };
        } catch (error) {
            console.error('❌ [syncRouteFeedbacksToUserRoutes] Error:', error);
            throw error;
        }
    }

    /**
     * Reset all-time points by deleting routeFeedbacks for non-active (archived) routes.
     * After this operation, "all time" points will equal "on wall" points for all users.
     * Points from routes currently on the wall are preserved.
     */
    static async resetAllTimePoints(): Promise<{ deleted: number; kept: number; failed: number }> {
        try {
            console.log('🔄 [resetAllTimePoints] Starting reset...');

            // Step 1: Get all routes and identify active ones
            const routesSnapshot = await getDocs(this.routesRef);
            const activeRouteIds = new Set<string>();
            routesSnapshot.forEach((routeDoc) => {
                const data = routeDoc.data();
                const isActive = !data.status || data.status === 'active';
                if (isActive) {
                    activeRouteIds.add(routeDoc.id);
                }
            });
            console.log(`📊 [resetAllTimePoints] Found ${activeRouteIds.size} active routes out of ${routesSnapshot.size} total`);

            // Step 2: Get all routeFeedbacks
            const feedbacksSnapshot = await getDocs(this.feedbacksRef);
            console.log(`📊 [resetAllTimePoints] Found ${feedbacksSnapshot.size} total feedbacks`);

            // Step 3: Identify feedbacks to delete (for non-active routes)
            const feedbacksToDelete: string[] = [];
            let kept = 0;

            feedbacksSnapshot.forEach((feedbackDoc) => {
                const data = feedbackDoc.data();
                if (!activeRouteIds.has(data.routeId)) {
                    feedbacksToDelete.push(feedbackDoc.id);
                } else {
                    kept++;
                }
            });

            console.log(`🗑️ [resetAllTimePoints] Will delete ${feedbacksToDelete.length} feedbacks, keeping ${kept}`);

            // Step 4: Delete in batches of 500 (Firestore limit)
            let deleted = 0;
            let failed = 0;
            const BATCH_SIZE = 500;

            for (let i = 0; i < feedbacksToDelete.length; i += BATCH_SIZE) {
                const batchIds = feedbacksToDelete.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);

                for (const feedbackId of batchIds) {
                    batch.delete(doc(this.feedbacksRef, feedbackId));
                }

                try {
                    await batch.commit();
                    deleted += batchIds.length;
                    console.log(`✅ [resetAllTimePoints] Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchIds.length} feedbacks`);
                } catch (error) {
                    failed += batchIds.length;
                    console.error(`❌ [resetAllTimePoints] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
                }
            }

            console.log(`🔄 [resetAllTimePoints] Complete: ${deleted} deleted, ${kept} kept, ${failed} failed`);
            return { deleted, kept, failed };
        } catch (error) {
            console.error('❌ [resetAllTimePoints] Error:', error);
            throw error;
        }
    }
}
