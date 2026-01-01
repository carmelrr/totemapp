/**
 * @fileoverview Results Service
 * @description Firebase operations for competition results and scoring
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import {
  RouteResult,
  ParticipantResult,
  LeaderboardEntry,
  CompetitionRoute,
} from '../types';
import {
  calculateRoutePoints,
  calculateTopNPoints,
  NATIONAL_LEAGUE_SCORING,
} from '../constants';

/**
 * Service for managing competition results
 */
export class ResultsService {
  // =============== Result Entry ===============

  /**
   * Enter or update a route result for a participant
   * @param competitionId - Competition ID
   * @param participantId - Participant ID
   * @param routeNumber - Route number (1-30)
   * @param result - Route result data
   * @param enteredBy - Judge user ID
   */
  static async enterRouteResult(
    competitionId: string,
    participantId: string,
    routeNumber: number,
    result: {
      routeId: string;
      completed: boolean;
      attempts: number;
      grade: string;
    },
    enteredBy: string
  ): Promise<void> {
    try {
      // Calculate points
      const points = result.completed
        ? calculateRoutePoints(result.grade, result.attempts)
        : 0;

      const routeResult: RouteResult = {
        routeNumber,
        routeId: result.routeId,
        completed: result.completed,
        attempts: result.attempts,
        points,
        enteredBy,
        enteredAt: new Date(),
      };

      // Get or create participant result document
      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );
      
      const resultDoc = await getDoc(resultRef);
      
      if (resultDoc.exists()) {
        // Update existing result
        const existingData = resultDoc.data();
        const routes = existingData.routes || {};
        routes[routeNumber] = routeResult;

        // Recalculate totals
        const { totalPoints, top7Points, routesCompleted } = this.calculateTotals(routes);

        await updateDoc(resultRef, {
          routes,
          totalPoints,
          top7Points,
          routesCompleted,
          lastUpdated: serverTimestamp(),
        });
      } else {
        // Create new result document
        const routes: Record<number, RouteResult> = {
          [routeNumber]: routeResult,
        };

        const { totalPoints, top7Points, routesCompleted } = this.calculateTotals(routes);

        // Get participant name
        const participantRef = doc(
          db,
          'competitions',
          competitionId,
          'participants',
          participantId
        );
        const participantDoc = await getDoc(participantRef);
        const participantData = participantDoc.data() || {};

        await setDoc(resultRef, {
          competitionId,
          participantId,
          participantName: participantData.name || 'Unknown',
          category: participantData.category || null,
          categoryName: participantData.categoryName || null,
          routes,
          totalPoints,
          top7Points,
          routesCompleted,
          lastUpdated: serverTimestamp(),
        });
      }

      console.log(`Result entered: Route ${routeNumber} for participant ${participantId}`);
    } catch (error) {
      console.error('Error entering route result:', error);
      throw error;
    }
  }

  /**
   * Delete a route result
   */
  static async deleteRouteResult(
    competitionId: string,
    participantId: string,
    routeNumber: number
  ): Promise<void> {
    try {
      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );

      const resultDoc = await getDoc(resultRef);
      if (!resultDoc.exists()) return;

      const existingData = resultDoc.data();
      const routes = { ...existingData.routes };
      delete routes[routeNumber];

      const { totalPoints, top7Points, routesCompleted } = this.calculateTotals(routes);

      await updateDoc(resultRef, {
        routes,
        totalPoints,
        top7Points,
        routesCompleted,
        lastUpdated: serverTimestamp(),
      });

      console.log(`Result deleted: Route ${routeNumber} for participant ${participantId}`);
    } catch (error) {
      console.error('Error deleting route result:', error);
      throw error;
    }
  }

  /**
   * Remove a route result by routeId (alias for deleteRouteResult)
   */
  static async removeRouteResult(
    competitionId: string,
    participantId: string,
    routeId: string
  ): Promise<void> {
    try {
      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );

      const resultDoc = await getDoc(resultRef);
      if (!resultDoc.exists()) return;

      const existingData = resultDoc.data();
      const routes = { ...existingData.routes };
      
      // Find route by routeId and delete
      for (const [key, value] of Object.entries(routes)) {
        if ((value as any).routeId === routeId) {
          delete routes[key];
          break;
        }
      }

      const { totalPoints, top7Points, routesCompleted } = this.calculateTotals(routes);

      await updateDoc(resultRef, {
        routes,
        totalPoints,
        top7Points,
        routesCompleted,
        lastUpdated: serverTimestamp(),
      });

      console.log(`Result removed: Route ${routeId} for participant ${participantId}`);
    } catch (error) {
      console.error('Error removing route result:', error);
      throw error;
    }
  }

  // =============== Get Results ===============

  /**
   * Get all results for a participant
   */
  static async getParticipantResult(
    competitionId: string,
    participantId: string
  ): Promise<ParticipantResult | null> {
    try {
      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );

      const resultDoc = await getDoc(resultRef);
      if (!resultDoc.exists()) return null;

      return this.mapDocToResult(resultDoc);
    } catch (error) {
      console.error('Error getting participant result:', error);
      throw error;
    }
  }

  /**
   * Get all results for a competition
   */
  static async getAllResults(
    competitionId: string
  ): Promise<ParticipantResult[]> {
    try {
      const resultsRef = collection(
        db,
        'competitions',
        competitionId,
        'results'
      );

      const q = query(resultsRef, orderBy('top7Points', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc, index) => ({
        ...this.mapDocToResult(doc),
        rank: index + 1,
      }));
    } catch (error) {
      console.error('Error getting all results:', error);
      throw error;
    }
  }

  /**
   * Get results by category
   */
  static async getResultsByCategory(
    competitionId: string,
    category: string
  ): Promise<ParticipantResult[]> {
    try {
      const resultsRef = collection(
        db,
        'competitions',
        competitionId,
        'results'
      );

      const q = query(
        resultsRef,
        where('category', '==', category),
        orderBy('top7Points', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc, index) => ({
        ...this.mapDocToResult(doc),
        categoryRank: index + 1,
      }));
    } catch (error) {
      console.error('Error getting results by category:', error);
      throw error;
    }
  }

  // =============== Leaderboard ===============

  /**
   * Get leaderboard entries
   */
  static async getLeaderboard(
    competitionId: string,
    category?: string,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    try {
      const results = category
        ? await this.getResultsByCategory(competitionId, category)
        : await this.getAllResults(competitionId);

      return results.slice(0, limit).map((result, index) => ({
        rank: category ? result.categoryRank || index + 1 : result.rank || index + 1,
        participantId: result.participantId,
        participantName: result.participantName,
        userId: undefined, // Would need to join with participants
        points: result.top7Points,
        routesCompleted: result.routesCompleted,
        category: result.category,
        categoryName: result.categoryName,
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Subscribe to leaderboard updates
   */
  static subscribeToLeaderboard(
    competitionId: string,
    callback: (entries: LeaderboardEntry[]) => void,
    category?: string
  ): () => void {
    const resultsRef = collection(
      db,
      'competitions',
      competitionId,
      'results'
    );

    let q;
    if (category) {
      q = query(
        resultsRef,
        where('category', '==', category),
        orderBy('top7Points', 'desc')
      );
    } else {
      q = query(resultsRef, orderBy('top7Points', 'desc'));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const entries: LeaderboardEntry[] = snapshot.docs.map((doc, index) => {
          const data = doc.data();
          return {
            rank: index + 1,
            participantId: doc.id,
            participantName: data.participantName || 'Unknown',
            points: data.top7Points || 0,
            routesCompleted: data.routesCompleted || 0,
            category: data.category,
            categoryName: data.categoryName,
          };
        });
        callback(entries);
      },
      (error) => {
        console.error('Error subscribing to leaderboard:', error);
        callback([]);
      }
    );
  }

  /**
   * Subscribe to a participant's results
   */
  static subscribeToParticipantResult(
    competitionId: string,
    participantId: string,
    callback: (result: ParticipantResult | null) => void
  ): () => void {
    const resultRef = doc(
      db,
      'competitions',
      competitionId,
      'results',
      participantId
    );

    return onSnapshot(
      resultRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(this.mapDocToResult(snapshot));
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error subscribing to participant result:', error);
        callback(null);
      }
    );
  }

  // =============== Batch Operations ===============

  /**
   * Recalculate all rankings for a competition
   */
  static async recalculateRankings(competitionId: string): Promise<void> {
    try {
      const results = await this.getAllResults(competitionId);
      const batch = writeBatch(db);

      // Overall rankings
      results.forEach((result, index) => {
        const resultRef = doc(
          db,
          'competitions',
          competitionId,
          'results',
          result.participantId
        );
        batch.update(resultRef, { rank: index + 1 });
      });

      // Category rankings
      const categories = [...new Set(results.map(r => r.category).filter(Boolean))];
      
      for (const category of categories) {
        const categoryResults = results
          .filter(r => r.category === category)
          .sort((a, b) => b.top7Points - a.top7Points);

        categoryResults.forEach((result, index) => {
          const resultRef = doc(
            db,
            'competitions',
            competitionId,
            'results',
            result.participantId
          );
          batch.update(resultRef, { categoryRank: index + 1 });
        });
      }

      await batch.commit();
      console.log('Rankings recalculated for competition:', competitionId);
    } catch (error) {
      console.error('Error recalculating rankings:', error);
      throw error;
    }
  }

  /**
   * Clear all results for a competition
   */
  static async clearAllResults(competitionId: string): Promise<void> {
    try {
      const resultsRef = collection(
        db,
        'competitions',
        competitionId,
        'results'
      );

      const snapshot = await getDocs(resultsRef);
      const batch = writeBatch(db);

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('All results cleared for competition:', competitionId);
    } catch (error) {
      console.error('Error clearing results:', error);
      throw error;
    }
  }

  // =============== Helper Methods ===============

  /**
   * Calculate totals from route results
   */
  private static calculateTotals(routes: Record<number, RouteResult>): {
    totalPoints: number;
    top7Points: number;
    routesCompleted: number;
  } {
    const completedRoutes = Object.values(routes).filter(r => r.completed);
    const allPoints = completedRoutes.map(r => r.points);
    
    return {
      totalPoints: allPoints.reduce((sum, p) => sum + p, 0),
      top7Points: calculateTopNPoints(allPoints, 7),
      routesCompleted: completedRoutes.length,
    };
  }

  /**
   * Map Firestore document to ParticipantResult
   */
  private static mapDocToResult(docSnap: any): ParticipantResult {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      competitionId: data.competitionId,
      participantId: docSnap.id,
      participantName: data.participantName || 'Unknown',
      category: data.category,
      categoryName: data.categoryName,
      routes: data.routes || {},
      routesCompleted: data.routesCompleted || 0,
      totalPoints: data.totalPoints || 0,
      top7Points: data.top7Points || 0,
      rank: data.rank,
      categoryRank: data.categoryRank,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    };
  }
}
