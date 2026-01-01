/**
 * @fileoverview Competition Service
 * @description Firebase operations for competition management
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
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
  Competition,
  CompetitionCreateData,
  CompetitionUpdateData,
  CompetitionStatus,
  CompetitionFormat,
} from '../types';
import { getDefaultSettingsForFormat } from '../constants';

// Collection reference
const competitionsRef = collection(db, 'competitions');

/**
 * Service for managing competitions
 */
export class CompetitionService {
  // =============== CRUD Operations ===============

  /**
   * Create a new competition
   * @param data - Competition data
   * @param createdBy - User ID (optional if included in data)
   */
  static async createCompetition(
    data: CompetitionCreateData & { createdBy?: string; categories?: any[] },
    createdBy?: string
  ): Promise<string> {
    try {
      const creatorId = data.createdBy || createdBy;
      if (!creatorId) {
        throw new Error('createdBy is required');
      }
      
      const defaultSettings = getDefaultSettingsForFormat(data.format);
      
      const competitionData = {
        name: data.name,
        description: data.description || '',
        format: data.format,
        status: 'draft' as CompetitionStatus,
        startDate: Timestamp.fromDate(data.startDate),
        endDate: Timestamp.fromDate(data.endDate),
        settings: {
          ...defaultSettings,
          ...data.settings,
        },
        categories: data.categories || [],
        wallImageUrl: data.wallImageUrl || null,
        createdBy: creatorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(competitionsRef, competitionData);
      console.log('Competition created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating competition:', error);
      throw error;
    }
  }

  /**
   * Get a competition by ID
   */
  static async getCompetition(competitionId: string): Promise<Competition | null> {
    try {
      const docRef = doc(competitionsRef, competitionId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapDocToCompetition(docSnap);
    } catch (error) {
      console.error('Error getting competition:', error);
      throw error;
    }
  }

  /**
   * Update a competition
   */
  static async updateCompetition(
    competitionId: string,
    data: CompetitionUpdateData
  ): Promise<void> {
    try {
      const docRef = doc(competitionsRef, competitionId);
      
      const updateData: any = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      // Convert dates to Timestamps
      if (data.startDate) {
        updateData.startDate = Timestamp.fromDate(data.startDate);
      }
      if (data.endDate) {
        updateData.endDate = Timestamp.fromDate(data.endDate);
      }

      await updateDoc(docRef, updateData);
      console.log('Competition updated:', competitionId);
    } catch (error) {
      console.error('Error updating competition:', error);
      throw error;
    }
  }

  /**
   * Delete a competition (and all sub-collections)
   */
  static async deleteCompetition(competitionId: string): Promise<void> {
    try {
      // Note: In production, use Cloud Functions to delete sub-collections
      const docRef = doc(competitionsRef, competitionId);
      await deleteDoc(docRef);
      console.log('Competition deleted:', competitionId);
    } catch (error) {
      console.error('Error deleting competition:', error);
      throw error;
    }
  }

  // =============== Status Management ===============

  /**
   * Start a competition (change status to active)
   */
  static async startCompetition(competitionId: string): Promise<void> {
    await this.updateCompetition(competitionId, {
      status: 'active',
    });
  }

  /**
   * Close entries for a competition
   */
  static async closeCompetition(competitionId: string): Promise<void> {
    await this.updateCompetition(competitionId, {
      status: 'closed',
    });
  }

  /**
   * Complete a competition
   */
  static async completeCompetition(competitionId: string): Promise<void> {
    await this.updateCompetition(competitionId, {
      status: 'completed',
    });
  }

  /**
   * Update competition status directly
   */
  static async updateCompetitionStatus(
    competitionId: string,
    status: CompetitionStatus
  ): Promise<void> {
    await this.updateCompetition(competitionId, { status });
  }

  /**
   * Reopen a competition for entries
   */
  static async reopenCompetition(competitionId: string): Promise<void> {
    await this.updateCompetition(competitionId, {
      status: 'active',
    });
  }

  // =============== Query Operations ===============

  /**
   * Get all competitions
   */
  static async getAllCompetitions(): Promise<Competition[]> {
    try {
      const q = query(competitionsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToCompetition(doc));
    } catch (error) {
      console.error('Error getting all competitions:', error);
      throw error;
    }
  }

  /**
   * Get active competitions
   */
  static async getActiveCompetitions(): Promise<Competition[]> {
    try {
      const q = query(
        competitionsRef,
        where('status', '==', 'active'),
        orderBy('startDate', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToCompetition(doc));
    } catch (error) {
      console.error('Error getting active competitions:', error);
      throw error;
    }
  }

  /**
   * Get competitions by status
   */
  static async getCompetitionsByStatus(
    status: CompetitionStatus
  ): Promise<Competition[]> {
    try {
      const q = query(
        competitionsRef,
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToCompetition(doc));
    } catch (error) {
      console.error('Error getting competitions by status:', error);
      throw error;
    }
  }

  /**
   * Get competitions by format
   */
  static async getCompetitionsByFormat(
    format: CompetitionFormat
  ): Promise<Competition[]> {
    try {
      const q = query(
        competitionsRef,
        where('format', '==', format),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToCompetition(doc));
    } catch (error) {
      console.error('Error getting competitions by format:', error);
      throw error;
    }
  }

  // =============== Real-time Subscriptions ===============

  /**
   * Subscribe to a single competition
   */
  static subscribeToCompetition(
    competitionId: string,
    callback: (competition: Competition | null) => void
  ): () => void {
    const docRef = doc(competitionsRef, competitionId);

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(this.mapDocToCompetition(snapshot));
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error subscribing to competition:', error);
        callback(null);
      }
    );
  }

  /**
   * Subscribe to active competitions
   */
  static subscribeToActiveCompetitions(
    callback: (competitions: Competition[]) => void
  ): () => void {
    const q = query(
      competitionsRef,
      where('status', '==', 'active'),
      orderBy('startDate', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const competitions = snapshot.docs.map(doc => this.mapDocToCompetition(doc));
        callback(competitions);
      },
      (error) => {
        console.error('Error subscribing to active competitions:', error);
        callback([]);
      }
    );
  }

  /**
   * Subscribe to all competitions
   */
  static subscribeToAllCompetitions(
    callback: (competitions: Competition[]) => void
  ): () => void {
    const q = query(competitionsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const competitions = snapshot.docs.map(doc => this.mapDocToCompetition(doc));
        callback(competitions);
      },
      (error) => {
        console.error('Error subscribing to competitions:', error);
        callback([]);
      }
    );
  }

  // =============== Helper Methods ===============

  /**
   * Map Firestore document to Competition type
   */
  private static mapDocToCompetition(docSnap: any): Competition {
    const data = docSnap.data();
    
    return {
      id: docSnap.id,
      name: data.name,
      description: data.description,
      format: data.format,
      status: data.status,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || new Date(),
      rounds: data.rounds || [],
      settings: data.settings,
      wallImageUrl: data.wallImageUrl,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  /**
   * Check if competition is currently active
   */
  static isCompetitionActive(competition: Competition): boolean {
    const now = new Date();
    return (
      competition.status === 'active' &&
      now >= competition.startDate &&
      now <= competition.endDate
    );
  }

  /**
   * Get remaining time for competition
   */
  static getRemainingTime(competition: Competition): {
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } {
    const now = new Date();
    const endTime = competition.endDate;
    const diff = endTime.getTime() - now.getTime();

    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, isExpired: false };
  }
}
