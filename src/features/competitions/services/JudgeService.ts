/**
 * @fileoverview Judge Service
 * @description Firebase operations for competition judges
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { Judge, JudgePermissions } from '../types';

/**
 * Default judge permissions
 */
const DEFAULT_JUDGE_PERMISSIONS: JudgePermissions = {
  canEnterResults: true,
  canEditResults: true,
  canAddParticipants: true,
  canEditParticipants: false,
  canManageCategories: false,
};

/**
 * Full judge permissions (senior judge)
 */
const FULL_JUDGE_PERMISSIONS: JudgePermissions = {
  canEnterResults: true,
  canEditResults: true,
  canAddParticipants: true,
  canEditParticipants: true,
  canManageCategories: true,
};

/**
 * Service for managing competition judges
 */
export class JudgeService {
  // =============== Judge CRUD ===============

  /**
   * Add a judge to a competition
   * @param competitionId - Competition ID
   * @param userId - User ID of the judge
   * @param displayName - Display name
   * @param addedBy - Admin user ID
   * @param permissions - Optional custom permissions
   */
  static async addJudge(
    competitionId: string,
    userId: string,
    displayName: string,
    addedBy: string,
    email?: string,
    permissions?: Partial<JudgePermissions>
  ): Promise<void> {
    try {
      const judgeRef = doc(
        db,
        'competitions',
        competitionId,
        'judges',
        userId
      );

      const judgeData = {
        competitionId,
        userId,
        displayName,
        email: email || null,
        permissions: {
          ...DEFAULT_JUDGE_PERMISSIONS,
          ...permissions,
        },
        addedBy,
        addedAt: serverTimestamp(),
      };

      await setDoc(judgeRef, judgeData);
      console.log('Judge added:', userId);
    } catch (error) {
      console.error('Error adding judge:', error);
      throw error;
    }
  }

  /**
   * Remove a judge from a competition
   */
  static async removeJudge(
    competitionId: string,
    userId: string
  ): Promise<void> {
    try {
      const judgeRef = doc(
        db,
        'competitions',
        competitionId,
        'judges',
        userId
      );

      await deleteDoc(judgeRef);
      console.log('Judge removed:', userId);
    } catch (error) {
      console.error('Error removing judge:', error);
      throw error;
    }
  }

  /**
   * Update judge permissions
   */
  static async updateJudgePermissions(
    competitionId: string,
    userId: string,
    permissions: Partial<JudgePermissions>
  ): Promise<void> {
    try {
      const judgeRef = doc(
        db,
        'competitions',
        competitionId,
        'judges',
        userId
      );

      const judgeDoc = await getDoc(judgeRef);
      if (!judgeDoc.exists()) {
        throw new Error('Judge not found');
      }

      const currentPermissions = judgeDoc.data().permissions || {};

      await setDoc(
        judgeRef,
        {
          permissions: {
            ...currentPermissions,
            ...permissions,
          },
        },
        { merge: true }
      );

      console.log('Judge permissions updated:', userId);
    } catch (error) {
      console.error('Error updating judge permissions:', error);
      throw error;
    }
  }

  /**
   * Set full permissions for a senior judge
   */
  static async setSeniorJudge(
    competitionId: string,
    userId: string
  ): Promise<void> {
    await this.updateJudgePermissions(competitionId, userId, FULL_JUDGE_PERMISSIONS);
  }

  /**
   * Update judge role (judge/head_judge)
   */
  static async updateJudgeRole(
    competitionId: string,
    judgeId: string,
    role: 'judge' | 'head_judge'
  ): Promise<void> {
    try {
      const judgeRef = doc(
        db,
        'competitions',
        competitionId,
        'judges',
        judgeId
      );

      const isHeadJudge = role === 'head_judge';
      
      await setDoc(
        judgeRef,
        {
          role,
          permissions: isHeadJudge ? FULL_JUDGE_PERMISSIONS : DEFAULT_JUDGE_PERMISSIONS,
        },
        { merge: true }
      );

      console.log('Judge role updated:', judgeId, role);
    } catch (error) {
      console.error('Error updating judge role:', error);
      throw error;
    }
  }

  // =============== Query Operations ===============

  /**
   * Get all judges for a competition
   */
  static async getJudges(competitionId: string): Promise<Judge[]> {
    try {
      const judgesRef = collection(
        db,
        'competitions',
        competitionId,
        'judges'
      );

      const q = query(judgesRef, orderBy('addedAt', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => this.mapDocToJudge(doc));
    } catch (error) {
      console.error('Error getting judges:', error);
      throw error;
    }
  }

  /**
   * Get a specific judge
   */
  static async getJudge(
    competitionId: string,
    userId: string
  ): Promise<Judge | null> {
    try {
      const judgeRef = doc(
        db,
        'competitions',
        competitionId,
        'judges',
        userId
      );

      const judgeDoc = await getDoc(judgeRef);
      if (!judgeDoc.exists()) return null;

      return this.mapDocToJudge(judgeDoc);
    } catch (error) {
      console.error('Error getting judge:', error);
      throw error;
    }
  }

  /**
   * Check if a user is a judge for a competition
   */
  static async isJudge(
    competitionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const judge = await this.getJudge(competitionId, userId);
      return judge !== null;
    } catch (error) {
      console.error('Error checking judge status:', error);
      return false;
    }
  }

  /**
   * Get judge permissions for a user
   */
  static async getJudgePermissions(
    competitionId: string,
    userId: string
  ): Promise<JudgePermissions | null> {
    try {
      const judge = await this.getJudge(competitionId, userId);
      return judge?.permissions || null;
    } catch (error) {
      console.error('Error getting judge permissions:', error);
      return null;
    }
  }

  /**
   * Check if user can enter results
   */
  static async canEnterResults(
    competitionId: string,
    userId: string
  ): Promise<boolean> {
    const permissions = await this.getJudgePermissions(competitionId, userId);
    return permissions?.canEnterResults ?? false;
  }

  /**
   * Check if user can edit results
   */
  static async canEditResults(
    competitionId: string,
    userId: string
  ): Promise<boolean> {
    const permissions = await this.getJudgePermissions(competitionId, userId);
    return permissions?.canEditResults ?? false;
  }

  /**
   * Check if user can add participants
   */
  static async canAddParticipants(
    competitionId: string,
    userId: string
  ): Promise<boolean> {
    const permissions = await this.getJudgePermissions(competitionId, userId);
    return permissions?.canAddParticipants ?? false;
  }

  // =============== Real-time Subscriptions ===============

  /**
   * Subscribe to judges list
   */
  static subscribeToJudges(
    competitionId: string,
    callback: (judges: Judge[]) => void
  ): () => void {
    const judgesRef = collection(
      db,
      'competitions',
      competitionId,
      'judges'
    );

    const q = query(judgesRef, orderBy('addedAt', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const judges = snapshot.docs.map(doc => this.mapDocToJudge(doc));
        callback(judges);
      },
      (error) => {
        console.error('Error subscribing to judges:', error);
        callback([]);
      }
    );
  }

  // =============== Competition-wide Judge Queries ===============

  /**
   * Get all competitions where user is a judge
   */
  static async getCompetitionsAsJudge(userId: string): Promise<string[]> {
    try {
      // Note: This requires a collection group query
      // For now, we'll need to check each competition individually
      // or store judge assignments in a separate top-level collection
      console.warn('getCompetitionsAsJudge requires collection group query');
      return [];
    } catch (error) {
      console.error('Error getting competitions as judge:', error);
      return [];
    }
  }

  // =============== Helper Methods ===============

  /**
   * Map Firestore document to Judge
   */
  private static mapDocToJudge(docSnap: any): Judge {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      competitionId: data.competitionId,
      userId: data.userId || docSnap.id,
      displayName: data.displayName,
      userName: data.displayName, // Alias for compatibility
      email: data.email,
      role: data.role || 'judge',
      permissions: {
        ...DEFAULT_JUDGE_PERMISSIONS,
        ...data.permissions,
      },
      addedBy: data.addedBy,
      addedAt: data.addedAt?.toDate() || new Date(),
    };
  }
}

export { DEFAULT_JUDGE_PERMISSIONS, FULL_JUDGE_PERMISSIONS };
