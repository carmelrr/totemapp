/**
 * @fileoverview שירות סטטיסטיקות לפאנל הניהול - Admin Statistics Service
 * @description Aggregates wall data for the admin statistics dashboard
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import type {
  RouteOverview,
  TopRoute,
  GradeDistributionEntry,
  UserEngagement,
  SprayWallStats,
  ActivityPatterns,
  CompetitionOverview,
  RatingDistribution,
  CommunityRoutesOverview,
} from '../types/statistics';

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class StatisticsService {
  private static routesRef = collection(db, 'routes');
  private static feedbacksRef = collection(db, 'routeFeedbacks');
  private static usersRef = collection(db, 'users');
  private static sprayRoutesRef = collection(db, 'sprayRoutes');
  private static communityRoutesRef = collection(db, 'communityRoutes');
  private static competitionsRef = collection(db, 'competitions');
  private static communityRouteSendsRef = collection(db, 'communityRouteSends');

  /**
   * סקירת מסלולים כללית - Route overview stats
   */
  static async getRouteOverview(): Promise<RouteOverview> {
    try {
      const snapshot = await getDocs(this.routesRef);
      let totalActive = 0;
      let totalArchived = 0;
      let totalDraft = 0;
      let totalRating = 0;
      let ratingCount = 0;
      let totalFeedbacks = 0;
      let totalCompletions = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'active') totalActive++;
        else if (data.status === 'archived') totalArchived++;
        else if (data.status === 'draft') totalDraft++;

        if (data.averageStarRating && data.averageStarRating > 0) {
          totalRating += data.averageStarRating;
          ratingCount++;
        }
        totalFeedbacks += data.feedbackCount || 0;
        totalCompletions += data.completionCount || 0;
      });

      return {
        totalActive,
        totalArchived,
        totalDraft,
        averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
        totalFeedbacks,
        totalCompletions,
      };
    } catch (error) {
      console.error('Error getting route overview:', error);
      return { totalActive: 0, totalArchived: 0, totalDraft: 0, averageRating: 0, totalFeedbacks: 0, totalCompletions: 0 };
    }
  }

  /**
   * מסלולים פופולריים ביותר - Top routes by completion count
   */
  static async getTopRoutes(count: number = 5): Promise<TopRoute[]> {
    try {
      const q = query(
        this.routesRef,
        where('status', '==', 'active'),
        orderBy('completionCount', 'desc'),
        limit(count),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || '',
          nameHe: d.nameHe,
          nameEn: d.nameEn,
          grade: d.grade || '',
          color: d.color || '#999',
          completionCount: d.completionCount || 0,
          averageStarRating: d.averageStarRating || 0,
          feedbackCount: d.feedbackCount || 0,
        };
      });
    } catch (error) {
      console.error('Error getting top routes:', error);
      return [];
    }
  }

  /**
   * מסלולים עם דירוג נמוך - Lowest rated routes (min 3 feedbacks)
   */
  static async getLowestRatedRoutes(count: number = 3): Promise<TopRoute[]> {
    try {
      const q = query(
        this.routesRef,
        where('status', '==', 'active'),
        where('feedbackCount', '>=', 3),
        orderBy('feedbackCount'),
        orderBy('averageStarRating', 'asc'),
      );
      const snapshot = await getDocs(q);
      // Sort client-side since Firestore compound ordering is limited
      const routes = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || '',
          nameHe: d.nameHe,
          nameEn: d.nameEn,
          grade: d.grade || '',
          color: d.color || '#999',
          completionCount: d.completionCount || 0,
          averageStarRating: d.averageStarRating || 0,
          feedbackCount: d.feedbackCount || 0,
        };
      });
      routes.sort((a, b) => a.averageStarRating - b.averageStarRating);
      return routes.slice(0, count);
    } catch (error) {
      console.error('Error getting lowest rated routes:', error);
      return [];
    }
  }

  /**
   * התפלגות דרגות - Grade distribution of active routes
   */
  static async getGradeDistribution(): Promise<GradeDistributionEntry[]> {
    try {
      const q = query(this.routesRef, where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      const distribution: Record<string, number> = {};

      snapshot.docs.forEach((doc) => {
        const grade = doc.data().grade || 'Unknown';
        distribution[grade] = (distribution[grade] || 0) + 1;
      });

      // Sort by grade order
      const gradeOrder = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
      return Object.entries(distribution)
        .sort(([a], [b]) => {
          const idxA = gradeOrder.indexOf(a);
          const idxB = gradeOrder.indexOf(b);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        })
        .map(([grade, count]) => ({ grade, count }));
    } catch (error) {
      console.error('Error getting grade distribution:', error);
      return [];
    }
  }

  /**
   * מעורבות משתמשים - User engagement stats
   */
  static async getUserEngagement(): Promise<UserEngagement> {
    try {
      // Count total users
      const usersCountSnap = await getCountFromServer(this.usersRef);
      const totalUsers = usersCountSnap.data().count;

      // Get users with route completions from userRoutes collection
      const userRoutesRef = collection(db, 'userRoutes');
      const userRoutesSnap = await getDocs(userRoutesRef);
      
      let usersWithCompletions = 0;
      let totalSends = 0;
      let totalFlashes = 0;

      userRoutesSnap.docs.forEach((doc) => {
        const data = doc.data();
        let hasCompletion = false;
        // userRoutes documents have route statuses as fields
        Object.values(data).forEach((val: any) => {
          if (val && typeof val === 'object' && val.status) {
            if (val.status === 'sent') {
              totalSends++;
              hasCompletion = true;
            } else if (val.status === 'flashed') {
              totalFlashes++;
              hasCompletion = true;
            }
          }
        });
        if (hasCompletion) usersWithCompletions++;
      });

      const totalCompleted = totalSends + totalFlashes;
      return {
        totalUsers,
        usersWithCompletions,
        totalSends,
        totalFlashes,
        flashRate: totalCompleted > 0 ? (totalFlashes / totalCompleted) * 100 : 0,
      };
    } catch (error) {
      console.error('Error getting user engagement:', error);
      return { totalUsers: 0, usersWithCompletions: 0, totalSends: 0, totalFlashes: 0, flashRate: 0 };
    }
  }

  /**
   * סטטיסטיקות ספריי וואל - Spray wall stats
   */
  static async getSprayWallStats(): Promise<SprayWallStats> {
    try {
      const snapshot = await getDocs(this.sprayRoutesRef);
      let totalRating = 0;
      let ratingCount = 0;
      let totalFeedbacks = 0;

      const routes = snapshot.docs.map((doc) => {
        const d = doc.data();
        if (d.averageStarRating && d.averageStarRating > 0) {
          totalRating += d.averageStarRating;
          ratingCount++;
        }
        totalFeedbacks += d.feedbackCount || 0;
        return {
          id: doc.id,
          name: d.name || '',
          grade: d.grade || '',
          topsCount: d.topsCount || 0,
          averageStarRating: d.averageStarRating || 0,
        };
      });

      routes.sort((a, b) => b.topsCount - a.topsCount);

      return {
        totalSprayRoutes: snapshot.size,
        averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
        totalFeedbacks,
        topSprayRoutes: routes.slice(0, 3),
      };
    } catch (error) {
      console.error('Error getting spray wall stats:', error);
      return { totalSprayRoutes: 0, averageRating: 0, totalFeedbacks: 0, topSprayRoutes: [] };
    }
  }

  /**
   * דפוסי פעילות - Activity patterns from feedback timestamps
   */
  static async getActivityPatterns(language: 'he' | 'en' = 'he'): Promise<ActivityPatterns> {
    try {
      const snapshot = await getDocs(this.feedbacksRef);
      const hourCounts: Record<number, number> = {};
      const dayCounts: Record<number, number> = {};

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt;
        if (!createdAt) return;

        const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        const hour = date.getHours();
        const day = date.getDay();

        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });

      const dayNames = language === 'he' ? DAY_NAMES_HE : DAY_NAMES_EN;

      const peakHours = Object.entries(hourCounts)
        .map(([h, count]) => ({ hour: parseInt(h), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const peakDays = Object.entries(dayCounts)
        .map(([d, count]) => ({ day: parseInt(d), dayName: dayNames[parseInt(d)], count }))
        .sort((a, b) => b.count - a.count);

      return { peakHours, peakDays };
    } catch (error) {
      console.error('Error getting activity patterns:', error);
      return { peakHours: [], peakDays: [] };
    }
  }

  /**
   * סקירת תחרויות - Competition overview
   */
  static async getCompetitionOverview(): Promise<CompetitionOverview> {
    try {
      const snapshot = await getDocs(this.competitionsRef);
      let activeCompetitions = 0;
      let totalParticipants = 0;

      for (const compDoc of snapshot.docs) {
        const data = compDoc.data();
        if (data.status === 'active' || data.status === 'upcoming') {
          activeCompetitions++;
        }
        // Count participants in subcollection
        const participantsRef = collection(db, 'competitions', compDoc.id, 'participants');
        const participantsSnap = await getCountFromServer(participantsRef);
        totalParticipants += participantsSnap.data().count;
      }

      return {
        totalCompetitions: snapshot.size,
        activeCompetitions,
        totalParticipants,
      };
    } catch (error) {
      console.error('Error getting competition overview:', error);
      return { totalCompetitions: 0, activeCompetitions: 0, totalParticipants: 0 };
    }
  }

  /**
   * התפלגות דירוגים - Star rating distribution
   */
  static async getRatingDistribution(): Promise<RatingDistribution> {
    try {
      const snapshot = await getDocs(this.feedbacksRef);
      const stars: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      snapshot.docs.forEach((doc) => {
        const rating = doc.data().starRating;
        if (rating >= 1 && rating <= 5) {
          stars[Math.round(rating)] = (stars[Math.round(rating)] || 0) + 1;
        }
      });

      return {
        stars: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: stars[r] })),
        totalFeedbacks: snapshot.size,
      };
    } catch (error) {
      console.error('Error getting rating distribution:', error);
      return { stars: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 })), totalFeedbacks: 0 };
    }
  }

  /**
   * סקירת מסלולי קהילה - Community routes overview
   */
  static async getCommunityRoutesOverview(): Promise<CommunityRoutesOverview> {
    try {
      const snapshot = await getDocs(this.communityRoutesRef);
      let totalRating = 0;
      let ratingCount = 0;

      snapshot.docs.forEach((doc) => {
        const d = doc.data();
        if (d.averageStarRating && d.averageStarRating > 0) {
          totalRating += d.averageStarRating;
          ratingCount++;
        }
      });

      // Count sends
      const sendsCountSnap = await getCountFromServer(this.communityRouteSendsRef);

      return {
        totalRoutes: snapshot.size,
        averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
        totalSends: sendsCountSnap.data().count,
      };
    } catch (error) {
      console.error('Error getting community routes overview:', error);
      return { totalRoutes: 0, averageRating: 0, totalSends: 0 };
    }
  }
}
