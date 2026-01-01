/**
 * @fileoverview Participant Service
 * @description Firebase operations for competition participants
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { Participant, Category } from '../types';

/**
 * Service for managing competition participants
 */
export class ParticipantService {
  // =============== Participant CRUD ===============

  /**
   * Add a new participant to a competition
   * @param competitionId - Competition ID
   * @param data - Participant data
   * @param registeredBy - Judge/admin user ID (optional if included in data)
   */
  static async addParticipant(
    competitionId: string,
    data: {
      name?: string;
      userName?: string;
      idNumber?: string;
      userId?: string;
      email?: string;
      phone?: string;
      category?: string;
      categoryName?: string;
      registeredBy?: string;
    },
    registeredBy?: string
  ): Promise<string> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const participantName = data.name || data.userName || 'משתתף';
      const registerer = data.registeredBy || registeredBy || 'system';

      const participantData = {
        competitionId,
        name: participantName,
        userName: participantName, // alias for screens
        idNumber: data.idNumber || null,
        userId: data.userId || null,
        email: data.email || null,
        phone: data.phone || null,
        category: data.category || null,
        categoryName: data.categoryName || null,
        status: 'pending', // default status
        registeredAt: serverTimestamp(),
        registeredBy: registerer,
        isActive: true,
      };

      const docRef = await addDoc(participantsRef, participantData);
      console.log('Participant added:', docRef.id);

      // Update category participant count if category is set
      if (data.category) {
        await this.updateCategoryCount(competitionId, data.category, 1);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  /**
   * Get all participants for a competition
   */
  static async getParticipants(
    competitionId: string,
    category?: string
  ): Promise<Participant[]> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      let q;
      if (category) {
        q = query(
          participantsRef,
          where('category', '==', category),
          orderBy('registeredAt', 'desc')
        );
      } else {
        q = query(participantsRef, orderBy('registeredAt', 'desc'));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToParticipant(doc));
    } catch (error) {
      console.error('Error getting participants:', error);
      throw error;
    }
  }

  /**
   * Get a participant by ID
   */
  static async getParticipant(
    competitionId: string,
    participantId: string
  ): Promise<Participant | null> {
    try {
      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      return this.mapDocToParticipant(docSnap);
    } catch (error) {
      console.error('Error getting participant:', error);
      throw error;
    }
  }

  /**
   * Update a participant
   */
  static async updateParticipant(
    competitionId: string,
    participantId: string,
    data: Partial<{
      name: string;
      userName: string;
      idNumber: string;
      email: string;
      phone: string;
      category: string;
      categoryName: string;
      status: string;
      isActive: boolean;
    }>
  ): Promise<void> {
    try {
      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      // Handle category change
      if (data.category !== undefined) {
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) {
          const oldCategory = existingDoc.data().category;
          if (oldCategory !== data.category) {
            // Decrement old category count
            if (oldCategory) {
              await this.updateCategoryCount(competitionId, oldCategory, -1);
            }
            // Increment new category count
            if (data.category) {
              await this.updateCategoryCount(competitionId, data.category, 1);
            }
          }
        }
      }

      // Sync name and userName
      if (data.name && !data.userName) {
        data.userName = data.name;
      } else if (data.userName && !data.name) {
        data.name = data.userName;
      }

      await updateDoc(docRef, data);
      console.log('Participant updated:', participantId);
    } catch (error) {
      console.error('Error updating participant:', error);
      throw error;
    }
  }

  /**
   * Update participant status
   */
  static async updateParticipantStatus(
    competitionId: string,
    participantId: string,
    status: 'pending' | 'approved' | 'rejected'
  ): Promise<void> {
    return this.updateParticipant(competitionId, participantId, { status });
  }

  /**
   * Remove a participant (soft delete)
   */
  static async removeParticipant(
    competitionId: string,
    participantId: string
  ): Promise<void> {
    try {
      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      // Get participant to update category count
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const category = docSnap.data().category;
        if (category) {
          await this.updateCategoryCount(competitionId, category, -1);
        }
      }

      await updateDoc(docRef, { isActive: false });
      console.log('Participant removed:', participantId);
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a participant
   */
  static async deleteParticipant(
    competitionId: string,
    participantId: string
  ): Promise<void> {
    try {
      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      // Get participant to update category count
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const category = docSnap.data().category;
        if (category) {
          await this.updateCategoryCount(competitionId, category, -1);
        }
      }

      await deleteDoc(docRef);
      console.log('Participant deleted:', participantId);
    } catch (error) {
      console.error('Error deleting participant:', error);
      throw error;
    }
  }

  // =============== Query Operations ===============

  /**
   * Get all participants for a competition
   */
  static async getAllParticipants(
    competitionId: string,
    includeInactive: boolean = false
  ): Promise<Participant[]> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      let q;
      if (includeInactive) {
        q = query(participantsRef, orderBy('name', 'asc'));
      } else {
        q = query(
          participantsRef,
          where('isActive', '==', true),
          orderBy('name', 'asc')
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToParticipant(doc));
    } catch (error) {
      console.error('Error getting all participants:', error);
      throw error;
    }
  }

  /**
   * Get participants by category
   */
  static async getParticipantsByCategory(
    competitionId: string,
    category: string
  ): Promise<Participant[]> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const q = query(
        participantsRef,
        where('category', '==', category),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToParticipant(doc));
    } catch (error) {
      console.error('Error getting participants by category:', error);
      throw error;
    }
  }

  /**
   * Search participants by name
   */
  static async searchParticipants(
    competitionId: string,
    searchTerm: string
  ): Promise<Participant[]> {
    try {
      // Firebase doesn't support text search, so we fetch all and filter client-side
      const allParticipants = await this.getAllParticipants(competitionId);
      
      const searchLower = searchTerm.toLowerCase();
      return allParticipants.filter(
        p => p.name.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error('Error searching participants:', error);
      throw error;
    }
  }

  /**
   * Find participant by ID number
   */
  static async findByIdNumber(
    competitionId: string,
    idNumber: string
  ): Promise<Participant | null> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const q = query(participantsRef, where('idNumber', '==', idNumber));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      return this.mapDocToParticipant(snapshot.docs[0]);
    } catch (error) {
      console.error('Error finding participant by ID number:', error);
      throw error;
    }
  }

  // =============== Real-time Subscriptions ===============

  /**
   * Subscribe to participants list
   */
  static subscribeToParticipants(
    competitionId: string,
    callback: (participants: Participant[]) => void,
    category?: string
  ): () => void {
    const participantsRef = collection(
      db,
      'competitions',
      competitionId,
      'participants'
    );

    let q;
    if (category) {
      q = query(
        participantsRef,
        where('category', '==', category),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
    } else {
      q = query(
        participantsRef,
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const participants = snapshot.docs.map(doc => this.mapDocToParticipant(doc));
        callback(participants);
      },
      (error) => {
        console.error('Error subscribing to participants:', error);
        callback([]);
      }
    );
  }

  // =============== Category Management ===============

  /**
   * Create a category
   */
  static async createCategory(
    competitionId: string,
    data: {
      name: string;
      description?: string;
      order?: number;
    }
  ): Promise<string> {
    try {
      const categoriesRef = collection(
        db,
        'competitions',
        competitionId,
        'categories'
      );

      const categoryData = {
        competitionId,
        name: data.name,
        description: data.description || '',
        order: data.order || 0,
        participantCount: 0,
      };

      const docRef = await addDoc(categoriesRef, categoryData);
      console.log('Category created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Get all categories for a competition
   */
  static async getCategories(competitionId: string): Promise<Category[]> {
    try {
      const categoriesRef = collection(
        db,
        'competitions',
        competitionId,
        'categories'
      );

      const q = query(categoriesRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        competitionId,
        name: doc.data().name,
        description: doc.data().description,
        order: doc.data().order,
        participantCount: doc.data().participantCount || 0,
      }));
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  /**
   * Update category participant count
   */
  private static async updateCategoryCount(
    competitionId: string,
    categoryId: string,
    delta: number
  ): Promise<void> {
    try {
      const categoryRef = doc(
        db,
        'competitions',
        competitionId,
        'categories',
        categoryId
      );

      const categoryDoc = await getDoc(categoryRef);
      if (categoryDoc.exists()) {
        const currentCount = categoryDoc.data().participantCount || 0;
        await updateDoc(categoryRef, {
          participantCount: Math.max(0, currentCount + delta),
        });
      }
    } catch (error) {
      console.error('Error updating category count:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Delete a category
   */
  static async deleteCategory(
    competitionId: string,
    categoryId: string
  ): Promise<void> {
    try {
      // First, unassign all participants from this category
      const participants = await this.getParticipantsByCategory(
        competitionId,
        categoryId
      );

      const batch = writeBatch(db);
      participants.forEach(p => {
        const docRef = doc(
          db,
          'competitions',
          competitionId,
          'participants',
          p.id
        );
        batch.update(docRef, { category: null, categoryName: null });
      });

      // Delete the category
      const categoryRef = doc(
        db,
        'competitions',
        competitionId,
        'categories',
        categoryId
      );
      batch.delete(categoryRef);

      await batch.commit();
      console.log('Category deleted:', categoryId);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // =============== Bulk Operations ===============

  /**
   * Import participants from a list
   */
  static async importParticipants(
    competitionId: string,
    participants: Array<{
      name: string;
      idNumber?: string;
      category?: string;
      categoryName?: string;
    }>,
    registeredBy: string
  ): Promise<number> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const batch = writeBatch(db);
      let count = 0;

      for (const p of participants) {
        const newDocRef = doc(participantsRef);
        batch.set(newDocRef, {
          competitionId,
          name: p.name,
          idNumber: p.idNumber || null,
          userId: null,
          email: null,
          phone: null,
          category: p.category || null,
          categoryName: p.categoryName || null,
          registeredAt: serverTimestamp(),
          registeredBy,
          isActive: true,
        });
        count++;
      }

      await batch.commit();
      console.log(`Imported ${count} participants`);
      return count;
    } catch (error) {
      console.error('Error importing participants:', error);
      throw error;
    }
  }

  /**
   * Get participant count
   */
  static async getParticipantCount(competitionId: string): Promise<number> {
    try {
      const participants = await this.getAllParticipants(competitionId);
      return participants.length;
    } catch (error) {
      console.error('Error getting participant count:', error);
      return 0;
    }
  }

  // =============== Helper Methods ===============

  /**
   * Map Firestore document to Participant
   */
  private static mapDocToParticipant(docSnap: any): Participant {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      competitionId: data.competitionId,
      name: data.name,
      userName: data.name, // Alias for compatibility
      idNumber: data.idNumber,
      userId: data.userId,
      email: data.email,
      phone: data.phone,
      category: data.category,
      categoryName: data.categoryName,
      status: data.status || 'approved',
      registeredAt: data.registeredAt?.toDate() || new Date(),
      registeredBy: data.registeredBy,
      isActive: data.isActive ?? true,
    };
  }
}
