/**
 * @fileoverview Rankings Service - User rankings and leaderboards
 * @description Following TopLogger's ranked_users endpoint pattern
 * Computes and manages user rankings by various metrics
 */

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { 
    RankedUser, 
    GymRankings, 
    RankingType, 
    ClimbsType, 
    RankingPeriod,
    GRADE_ORDER 
} from '@/types/models';

/**
 * Rankings Service - computes user rankings similar to TopLogger's API
 * Endpoint pattern: GET /v1/gyms/{gymId}/ranked_users.json?climbs_type=boulders&ranking_type=grade
 */
export class RankingsService {
    private static readonly USERS_COLLECTION = 'users';
    private static readonly ROUTES_COLLECTION = 'routes';
    private static readonly FEEDBACKS_COLLECTION = 'routeFeedbacks';
    private static readonly RANKINGS_CACHE_COLLECTION = 'rankingsCache';

    /**
     * Get ranked users by grade (highest completed grade)
     * Similar to TopLogger's ranking_type=grade
     */
    static async getRankedUsersByGrade(
        options: {
            climbsType?: ClimbsType;
            period?: RankingPeriod;
            limitCount?: number;
        } = {}
    ): Promise<RankedUser[]> {
        const { climbsType = 'boulders', period = 'all-time', limitCount = 50 } = options;

        try {
            // Get all users with their highest completed grade
            const usersRef = collection(db, this.USERS_COLLECTION);
            const usersSnapshot = await getDocs(usersRef);

            const rankedUsers: RankedUser[] = [];

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const stats = userData.stats || {};

                // Only include users with climbing stats
                if (stats.totalRoutesSent > 0 || stats.highestGrade) {
                    rankedUsers.push({
                        rank: 0, // Will be computed after sorting
                        userId: userDoc.id,
                        displayName: userData.displayName || 'Anonymous',
                        photoURL: userData.photoURL,
                        score: this.gradeToNumeric(stats.highestGrade),
                        maxGrade: stats.highestGrade || 'V0',
                        routesCompleted: stats.totalRoutesSent || 0,
                        points: this.calculatePoints(stats),
                        flashRate: stats.flashRate,
                        averageAttempts: stats.averageAttempts,
                    });
                }
            }

            // Sort by grade (highest first)
            rankedUsers.sort((a, b) => b.score - a.score);

            // Assign ranks (handling ties)
            let currentRank = 1;
            let previousScore = -1;
            rankedUsers.forEach((user, index) => {
                if (user.score !== previousScore) {
                    currentRank = index + 1;
                }
                user.rank = currentRank;
                previousScore = user.score;
            });

            return rankedUsers.slice(0, limitCount);
        } catch (error) {
            console.error('[RankingsService] Error getting rankings by grade:', error);
            throw error;
        }
    }

    /**
     * Get ranked users by volume (total routes completed)
     * Similar to TopLogger's ranking_type=count
     */
    static async getRankedUsersByVolume(
        options: {
            climbsType?: ClimbsType;
            period?: RankingPeriod;
            limitCount?: number;
        } = {}
    ): Promise<RankedUser[]> {
        const { limitCount = 50 } = options;

        try {
            const usersRef = collection(db, this.USERS_COLLECTION);
            const usersSnapshot = await getDocs(usersRef);

            const rankedUsers: RankedUser[] = [];

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const stats = userData.stats || {};

                if (stats.totalRoutesSent > 0) {
                    rankedUsers.push({
                        rank: 0,
                        userId: userDoc.id,
                        displayName: userData.displayName || 'Anonymous',
                        photoURL: userData.photoURL,
                        score: stats.totalRoutesSent,
                        maxGrade: stats.highestGrade || 'V0',
                        routesCompleted: stats.totalRoutesSent || 0,
                        points: this.calculatePoints(stats),
                    });
                }
            }

            // Sort by volume (highest first)
            rankedUsers.sort((a, b) => b.routesCompleted - a.routesCompleted);

            // Assign ranks
            let currentRank = 1;
            let previousScore = -1;
            rankedUsers.forEach((user, index) => {
                if (user.routesCompleted !== previousScore) {
                    currentRank = index + 1;
                }
                user.rank = currentRank;
                previousScore = user.routesCompleted;
            });

            return rankedUsers.slice(0, limitCount);
        } catch (error) {
            console.error('[RankingsService] Error getting rankings by volume:', error);
            throw error;
        }
    }

    /**
     * Get ranked users by points (weighted score)
     * Higher grades = more points per send
     */
    static async getRankedUsersByPoints(
        options: {
            climbsType?: ClimbsType;
            period?: RankingPeriod;
            limitCount?: number;
        } = {}
    ): Promise<RankedUser[]> {
        const { limitCount = 50 } = options;

        try {
            const usersRef = collection(db, this.USERS_COLLECTION);
            const usersSnapshot = await getDocs(usersRef);

            const rankedUsers: RankedUser[] = [];

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const stats = userData.stats || {};
                const points = this.calculatePoints(stats);

                if (points > 0) {
                    rankedUsers.push({
                        rank: 0,
                        userId: userDoc.id,
                        displayName: userData.displayName || 'Anonymous',
                        photoURL: userData.photoURL,
                        score: points,
                        maxGrade: stats.highestGrade || 'V0',
                        routesCompleted: stats.totalRoutesSent || 0,
                        points,
                    });
                }
            }

            // Sort by points (highest first)
            rankedUsers.sort((a, b) => b.points - a.points);

            // Assign ranks
            let currentRank = 1;
            let previousPoints = -1;
            rankedUsers.forEach((user, index) => {
                if (user.points !== previousPoints) {
                    currentRank = index + 1;
                }
                user.rank = currentRank;
                previousPoints = user.points;
            });

            return rankedUsers.slice(0, limitCount);
        } catch (error) {
            console.error('[RankingsService] Error getting rankings by points:', error);
            throw error;
        }
    }

    /**
     * Get user's rank for a specific ranking type
     */
    static async getUserRank(
        userId: string,
        rankingType: RankingType = 'grade'
    ): Promise<{ rank: number; total: number; percentile: number } | null> {
        try {
            let rankedUsers: RankedUser[];

            switch (rankingType) {
                case 'grade':
                    rankedUsers = await this.getRankedUsersByGrade({ limitCount: 1000 });
                    break;
                case 'volume':
                    rankedUsers = await this.getRankedUsersByVolume({ limitCount: 1000 });
                    break;
                case 'points':
                    rankedUsers = await this.getRankedUsersByPoints({ limitCount: 1000 });
                    break;
                default:
                    rankedUsers = await this.getRankedUsersByGrade({ limitCount: 1000 });
            }

            const userRanking = rankedUsers.find(u => u.userId === userId);
            if (!userRanking) return null;

            const total = rankedUsers.length;
            const percentile = Math.round(((total - userRanking.rank + 1) / total) * 100);

            return {
                rank: userRanking.rank,
                total,
                percentile,
            };
        } catch (error) {
            console.error('[RankingsService] Error getting user rank:', error);
            return null;
        }
    }

    /**
     * Get full gym rankings (cached result)
     * Similar to TopLogger's /gyms/{gymId}/ranked_users endpoint
     */
    static async getGymRankings(
        gymId: string,
        options: {
            rankingType?: RankingType;
            climbsType?: ClimbsType;
            period?: RankingPeriod;
        } = {}
    ): Promise<GymRankings> {
        const { 
            rankingType = 'grade', 
            climbsType = 'boulders',
            period = 'all-time'
        } = options;

        try {
            let users: RankedUser[];

            switch (rankingType) {
                case 'grade':
                    users = await this.getRankedUsersByGrade({ climbsType, period });
                    break;
                case 'volume':
                    users = await this.getRankedUsersByVolume({ climbsType, period });
                    break;
                case 'points':
                    users = await this.getRankedUsersByPoints({ climbsType, period });
                    break;
                default:
                    users = await this.getRankedUsersByGrade({ climbsType, period });
            }

            return {
                gymId,
                rankingType,
                climbsType,
                period,
                users,
                lastUpdated: new Date(),
            };
        } catch (error) {
            console.error('[RankingsService] Error getting gym rankings:', error);
            throw error;
        }
    }

    // ============================================
    // Helper Methods
    // ============================================

    /**
     * Convert grade string to numeric value for comparison
     */
    private static gradeToNumeric(grade: string | undefined): number {
        if (!grade) return 0;
        return GRADE_ORDER[grade.toUpperCase()] ?? 0;
    }

    /**
     * Calculate points based on user stats
     * Higher grades = exponentially more points
     */
    private static calculatePoints(stats: any): number {
        if (!stats) return 0;

        let points = 0;
        
        // Base points from routes completed
        points += (stats.totalRoutesSent || 0) * 10;

        // Bonus points for highest grade
        const gradeValue = this.gradeToNumeric(stats.highestGrade);
        points += gradeValue * gradeValue * 5; // Exponential bonus

        // Bonus for flash rate
        if (stats.flashRate) {
            points += stats.flashRate * 50;
        }

        return Math.round(points);
    }

    /**
     * Get grade distribution for a user
     */
    static async getUserGradeDistribution(userId: string): Promise<Record<string, number>> {
        try {
            const feedbacksRef = collection(db, this.FEEDBACKS_COLLECTION);
            const q = query(
                feedbacksRef,
                where('userId', '==', userId),
                where('closedRoute', '==', true)
            );
            
            const snapshot = await getDocs(q);
            const distribution: Record<string, number> = {};

            // Get route grades for each feedback
            for (const feedbackDoc of snapshot.docs) {
                const feedbackData = feedbackDoc.data();
                const routeId = feedbackData.routeId;
                
                // Get route grade
                const routeRef = doc(db, this.ROUTES_COLLECTION, routeId);
                const routeSnap = await getDoc(routeRef);
                
                if (routeSnap.exists()) {
                    const grade = routeSnap.data().grade || 'V0';
                    distribution[grade] = (distribution[grade] || 0) + 1;
                }
            }

            return distribution;
        } catch (error) {
            console.error('[RankingsService] Error getting grade distribution:', error);
            return {};
        }
    }
}
