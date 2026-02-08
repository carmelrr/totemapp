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
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { Participant, Category, Gender, SkillLevel } from '../types';
import { auth } from '@/features/data/firebase';
import { getUserRoles } from '@/features/roles/rolesService';

/**
 * Check if user has permission to manage participants
 * Only Head Judges and Admins can manage participants
 */
async function checkManageParticipantsPermission(userId: string): Promise<void> {
  const userRoles = await getUserRoles(userId);
  
  const hasPermission = userRoles.includes('admin') || 
                       userRoles.includes('head_judge');
  
  if (!hasPermission) {
    throw new Error('Not authorized to manage participants. Only head judges and admins can manage participants.');
  }
}

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
      gender?: Gender;
      birthYear?: number;
      skillLevel?: SkillLevel;
      category?: string;
      categoryName?: string;
      registeredBy?: string;
    },
    registeredBy?: string
  ): Promise<string> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkManageParticipantsPermission(currentUser.uid);

      // Check for existing participant (including inactive ones)
      // Priority: userId > idNumber > email
      // If found inactive - reactivate; if found active - throw error
      let existingParticipant: Participant | null = null;
      
      if (data.userId) {
        existingParticipant = await this.getParticipantByUserId(competitionId, data.userId);
      }
      
      if (!existingParticipant && data.idNumber) {
        existingParticipant = await this.findByIdNumber(competitionId, data.idNumber);
      }
      
      if (!existingParticipant && data.email) {
        existingParticipant = await this.findByEmail(competitionId, data.email);
      }

      // If participant exists
      if (existingParticipant) {
        if (existingParticipant.isActive) {
          // Already active - throw error
          throw new Error('משתתף זה כבר רשום לתחרות זו');
        } else {
          // Inactive - reactivate instead of creating new
          await this.reactivateParticipant(competitionId, existingParticipant.id, data);
          return existingParticipant.id;
        }
      }

      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const participantName = data.name || data.userName || 'משתתף';
      const registerer = data.registeredBy || registeredBy || 'system';

      // Auto-assign category if not specified but gender/birthYear provided
      let assignedCategory = data.category;
      let assignedCategoryName = data.categoryName;
      
      if (!assignedCategory && (data.gender || data.birthYear)) {
        const categories = await this.getCategories(competitionId);
        const matchedCategory = this.findMatchingCategory(categories, {
          gender: data.gender,
          birthYear: data.birthYear,
          skillLevel: data.skillLevel,
        });
        if (matchedCategory) {
          assignedCategory = matchedCategory.id;
          assignedCategoryName = matchedCategory.name;
        }
      }

      const participantData = {
        competitionId,
        name: participantName,
        userName: participantName, // alias for screens
        idNumber: data.idNumber || null,
        userId: data.userId || null,
        email: data.email || null,
        phone: data.phone || null,
        photoURL: data.photoURL || null,
        gender: data.gender || null,
        birthYear: data.birthYear || null,
        skillLevel: data.skillLevel || null,
        category: assignedCategory || null,
        categoryName: assignedCategoryName || null,
        status: 'pending', // default status
        registeredAt: serverTimestamp(),
        registeredBy: registerer,
        isActive: true,
      };

      const docRef = await addDoc(participantsRef, participantData);
      console.log('Participant added:', docRef.id);

      // Update category participant count if category is set
      if (assignedCategory) {
        await this.updateCategoryCount(competitionId, assignedCategory, 1);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  /**
   * Get all active participants for a competition
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
          where('isActive', '==', true),
          orderBy('registeredAt', 'desc')
        );
      } else {
        q = query(
          participantsRef,
          where('isActive', '==', true),
          orderBy('registeredAt', 'desc')
        );
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
      category: string | null;
      categoryName: string | null;
      status: string;
      isActive: boolean;
    }>
  ): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkManageParticipantsPermission(currentUser.uid);

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
            
            // CRITICAL: Also update the result document's category for correct scoring
            // The participant's userId is stored in the participant document
            const participantData = existingDoc.data();
            const userId = participantData.userId || participantId;
            const resultRef = doc(
              db,
              'competitions',
              competitionId,
              'results',
              userId
            );
            const resultDoc = await getDoc(resultRef);
            if (resultDoc.exists()) {
              await updateDoc(resultRef, {
                category: data.category,
                categoryName: data.categoryName || null,
              });
              console.log(`[updateParticipant] Synced category to result document: ${userId} -> ${data.category}`);
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

      // Filter out undefined values - Firebase doesn't accept undefined
      // null is allowed (used to clear fields like category)
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      await updateDoc(docRef, cleanData);
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
   * Also deletes all their results/scores from the competition
   */
  static async removeParticipant(
    competitionId: string,
    participantId: string
  ): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkManageParticipantsPermission(currentUser.uid);

      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      // Get participant to update category count and get userId
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        console.log('Participant not found:', participantId);
        return;
      }
      
      const participantData = docSnap.data();
      const category = participantData.category;
      
      // Update category count
      if (category) {
        await this.updateCategoryCount(competitionId, category, -1);
      }
      
      // Delete the participant's results document (uses userId as document ID)
      const userId = participantData.userId || participantId;
      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        userId
      );
      const resultDoc = await getDoc(resultRef);
      if (resultDoc.exists()) {
        await deleteDoc(resultRef);
        console.log(`Deleted results for participant: ${userId}`);
      }

      // Soft delete the participant
      await updateDoc(docRef, { isActive: false });
      console.log('Participant removed:', participantId);
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  /**
   * Reactivate an inactive participant
   * Used when trying to add a participant that was previously removed
   */
  static async reactivateParticipant(
    competitionId: string,
    participantId: string,
    data?: {
      name?: string;
      userName?: string;
      category?: string;
      categoryName?: string;
      registeredBy?: string;
    }
  ): Promise<void> {
    try {
      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      const updateData: any = {
        isActive: true,
        status: 'pending',
        registeredAt: serverTimestamp(),
      };

      // Update name if provided
      if (data?.name) {
        updateData.name = data.name;
        updateData.userName = data.name;
      }

      // Update category if provided
      if (data?.category) {
        updateData.category = data.category;
        updateData.categoryName = data.categoryName;
      }

      if (data?.registeredBy) {
        updateData.registeredBy = data.registeredBy;
      }

      await updateDoc(docRef, updateData);
      
      // Update category count
      if (data?.category) {
        await this.updateCategoryCount(competitionId, data.category, 1);
      }

      console.log('Participant reactivated:', participantId);
    } catch (error) {
      console.error('Error reactivating participant:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a participant
   * Also deletes all their results/scores from the competition
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

      // Get participant to update category count and get userId
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const participantData = docSnap.data();
        const category = participantData.category;
        if (category) {
          await this.updateCategoryCount(competitionId, category, -1);
        }
        
        // Delete the participant's results document (uses userId as document ID)
        const userId = participantData.userId || participantId;
        const resultRef = doc(
          db,
          'competitions',
          competitionId,
          'results',
          userId
        );
        const resultDoc = await getDoc(resultRef);
        if (resultDoc.exists()) {
          await deleteDoc(resultRef);
          console.log(`Deleted results for participant: ${userId}`);
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

  /**
   * Find participant by email
   */
  static async findByEmail(
    competitionId: string,
    email: string
  ): Promise<Participant | null> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const q = query(participantsRef, where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      return this.mapDocToParticipant(snapshot.docs[0]);
    } catch (error) {
      console.error('Error finding participant by email:', error);
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
      gender?: Gender;
      minAge?: number;
      maxAge?: number;
      skillLevels?: SkillLevel[];
      order?: number;
      routePrefix?: string;
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
        gender: data.gender || null,
        minAge: data.minAge ?? null,
        maxAge: data.maxAge ?? null,
        skillLevels: data.skillLevels || null,
        order: data.order || 0,
        participantCount: 0,
        routePrefix: data.routePrefix || null,
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
   * Update an existing category
   */
  static async updateCategory(
    competitionId: string,
    categoryId: string,
    data: {
      name?: string;
      description?: string;
      gender?: Gender | null;
      minAge?: number | null;
      maxAge?: number | null;
      skillLevels?: SkillLevel[] | null;
      order?: number;
      routePrefix?: string | null;
    }
  ): Promise<void> {
    try {
      const categoryRef = doc(
        db,
        'competitions',
        competitionId,
        'categories',
        categoryId
      );

      // Clean up undefined values
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.gender !== undefined) updateData.gender = data.gender;
      if (data.minAge !== undefined) updateData.minAge = data.minAge;
      if (data.maxAge !== undefined) updateData.maxAge = data.maxAge;
      if (data.skillLevels !== undefined) updateData.skillLevels = data.skillLevels;
      if (data.order !== undefined) updateData.order = data.order;
      if (data.routePrefix !== undefined) updateData.routePrefix = data.routePrefix;

      await updateDoc(categoryRef, updateData);
      console.log('Category updated:', categoryId);
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Auto-assign categories to all participants without a category
   * Returns the number of participants that were assigned
   */
  static async autoAssignCategories(competitionId: string): Promise<{ assigned: number; skipped: number }> {
    try {
      const categories = await this.getCategories(competitionId);
      if (categories.length === 0) {
        throw new Error('אין קטגוריות בתחרות. צור קטגוריות קודם.');
      }

      // Get all active participants without a category
      const allParticipants = await this.getAllParticipants(competitionId, false);
      const unassignedParticipants = allParticipants.filter(p => !p.category && p.isActive);

      let assigned = 0;
      let skipped = 0;
      const batch = writeBatch(db);
      const categoryCountUpdates: Map<string, number> = new Map();

      for (const participant of unassignedParticipants) {
        const matchedCategory = this.findMatchingCategory(categories, {
          gender: participant.gender,
          birthYear: participant.birthYear,
          skillLevel: participant.skillLevel,
        });

        if (matchedCategory) {
          const docRef = doc(
            db,
            'competitions',
            competitionId,
            'participants',
            participant.id
          );
          batch.update(docRef, {
            category: matchedCategory.id,
            categoryName: matchedCategory.name,
          });
          
          // Track category count updates
          const currentCount = categoryCountUpdates.get(matchedCategory.id) || 0;
          categoryCountUpdates.set(matchedCategory.id, currentCount + 1);
          assigned++;
        } else {
          skipped++;
        }
      }

      await batch.commit();

      // Update category counts
      for (const [categoryId, count] of categoryCountUpdates) {
        await this.updateCategoryCount(competitionId, categoryId, count);
      }

      console.log(`Auto-assigned ${assigned} participants, skipped ${skipped}`);
      return { assigned, skipped };
    } catch (error) {
      console.error('Error auto-assigning categories:', error);
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

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          competitionId,
          name: data.name,
          description: data.description,
          gender: data.gender || undefined,
          minAge: data.minAge ?? undefined,
          maxAge: data.maxAge ?? undefined,
          // Legacy support: keep minBirthYear/maxBirthYear for old data
          minBirthYear: data.minBirthYear || undefined,
          maxBirthYear: data.maxBirthYear || undefined,
          skillLevels: data.skillLevels || undefined,
          order: data.order,
          participantCount: data.participantCount || 0,
          routePrefix: data.routePrefix || undefined,
        };
      });
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
      gender: data.gender,
      birthYear: data.birthYear,
      skillLevel: data.skillLevel,
      category: data.category,
      categoryName: data.categoryName,
      status: data.status || 'approved',
      registeredAt: data.registeredAt?.toDate() || new Date(),
      registeredBy: data.registeredBy,
      isActive: data.isActive ?? true,
    };
  }

  /**
   * Find matching category for a participant based on their demographics
   * @param categories - Available categories for the competition
   * @param participant - Participant demographic data
   * @returns Matching category or null if no match
   */
  /**
   * Calculate age based on birth year (year-based, not exact date)
   * The participant is considered to be (currentYear - birthYear) years old
   * even if their birthday hasn't occurred yet this year.
   * @param birthYear - Year of birth
   * @returns Age in years
   */
  static calculateAgeFromBirthYear(birthYear: number): number {
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  }

  static findMatchingCategory(
    categories: Category[],
    participant: {
      gender?: Gender;
      birthYear?: number;
      skillLevel?: SkillLevel;
    }
  ): Category | null {
    if (!categories || categories.length === 0) {
      return null;
    }

    // Sort categories by order for priority matching
    const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

    for (const category of sortedCategories) {
      // Check gender match
      if (category.gender && participant.gender && category.gender !== participant.gender) {
        continue;
      }

      // Check age range (based on year, not exact birthday)
      // Age is calculated as: currentYear - birthYear
      if (participant.birthYear) {
        const participantAge = this.calculateAgeFromBirthYear(participant.birthYear);
        
        // minAge: participant must be at least this age
        if (category.minAge !== undefined && category.minAge !== null && participantAge < category.minAge) {
          continue;
        }
        // maxAge: participant must be at most this age
        if (category.maxAge !== undefined && category.maxAge !== null && participantAge > category.maxAge) {
          continue;
        }
        
        // Legacy support: check birth year range if minAge/maxAge not set
        if (category.minAge === undefined && category.maxAge === undefined) {
          // minBirthYear: participant must be born >= this year (younger or same age)
          if (category.minBirthYear && participant.birthYear < category.minBirthYear) {
            continue;
          }
          // maxBirthYear: participant must be born <= this year (older or same age)
          if (category.maxBirthYear && participant.birthYear > category.maxBirthYear) {
            continue;
          }
        }
      }

      // Check skill level
      if (category.skillLevels && category.skillLevels.length > 0 && participant.skillLevel) {
        if (!category.skillLevels.includes(participant.skillLevel)) {
          continue;
        }
      }

      // Check pro category override
      if (category.isProCategory) {
        if (!participant.skillLevel || !['advanced', 'pro'].includes(participant.skillLevel)) {
          continue;
        }
      }

      // All conditions passed - this is the matching category
      return category;
    }

    return null;
  }

  // =============== Self-Registration Methods (for Totemtition) ===============

  /**
   * Self-register for a competition (Totemtition format)
   * User registers themselves - status starts as 'pending_approval'
   * @param competitionId - Competition ID
   * @param userId - User ID registering
   * @param userData - User data for registration
   */
  static async selfRegister(
    competitionId: string,
    userId: string,
    userData: {
      displayName: string;
      email?: string;
      phone?: string;
      photoURL?: string;
      gender?: Gender;
      birthYear?: number;
      skillLevel?: SkillLevel;
      category?: string;
      categoryName?: string;
    }
  ): Promise<string> {
    try {
      // Check if registration is open for this competition
      const competitionRef = doc(db, 'competitions', competitionId);
      const competitionSnap = await getDoc(competitionRef);
      
      if (!competitionSnap.exists()) {
        throw new Error('Competition not found');
      }
      
      const competition = competitionSnap.data();
      
      // Check if registration is open
      if (competition.registrationStatus !== 'open') {
        throw new Error('Registration is closed for this competition');
      }

      // Check if user is already registered (including inactive)
      const existing = await this.getParticipantByUserId(competitionId, userId);
      if (existing) {
        if (existing.isActive) {
          throw new Error('You are already registered for this competition');
        } else {
          // Reactivate inactive participant
          await this.reactivateParticipant(competitionId, existing.id, {
            name: userData.displayName,
            category: userData.category,
            categoryName: userData.categoryName,
            registeredBy: userId,
          });
          return existing.id;
        }
      }

      // Auto-assign category if not specified but gender/birthYear provided
      let assignedCategory = userData.category;
      let assignedCategoryName = userData.categoryName;
      
      if (!assignedCategory && (userData.gender || userData.birthYear)) {
        const categories = await this.getCategories(competitionId);
        const matchedCategory = this.findMatchingCategory(categories, {
          gender: userData.gender,
          birthYear: userData.birthYear,
          skillLevel: userData.skillLevel,
        });
        if (matchedCategory) {
          assignedCategory = matchedCategory.id;
          assignedCategoryName = matchedCategory.name;
        }
      }

      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const participantData = {
        competitionId,
        name: userData.displayName,
        userName: userData.displayName,
        idNumber: null,
        userId: userId,
        email: userData.email || null,
        phone: userData.phone || null,
        photoURL: userData.photoURL || null,
        gender: userData.gender || null,
        birthYear: userData.birthYear || null,
        skillLevel: userData.skillLevel || null,
        category: assignedCategory || null,
        categoryName: assignedCategoryName || null,
        status: 'pending_approval', // Needs admin/head judge approval
        registeredAt: serverTimestamp(),
        registeredBy: userId, // Self-registered
        isActive: true,
      };

      const docRef = await addDoc(participantsRef, participantData);
      console.log('Self-registration submitted:', docRef.id);

      // Update category count if assigned
      if (assignedCategory) {
        await this.updateCategoryCount(competitionId, assignedCategory, 1);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error self-registering:', error);
      throw error;
    }
  }

  /**
   * Get participant by user ID
   * If multiple records exist for the same userId, returns the active one (or first inactive)
   * and cleans up duplicates in the background
   */
  static async getParticipantByUserId(
    competitionId: string,
    userId: string
  ): Promise<Participant | null> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      const q = query(participantsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      // Map all docs to participants
      const allParticipants = snapshot.docs.map(doc => this.mapDocToParticipant(doc));
      
      // If only one, return it
      if (allParticipants.length === 1) {
        return allParticipants[0];
      }
      
      // Multiple records found - this is a problem, clean it up
      console.warn(`[ParticipantService] Found ${allParticipants.length} records for userId ${userId} - cleaning up duplicates`);
      
      // Prefer active participant, otherwise first one
      const activeParticipant = allParticipants.find(p => p.isActive);
      const keepParticipant = activeParticipant || allParticipants[0];
      
      // Delete duplicates in background (don't await to not block the operation)
      const duplicates = allParticipants.filter(p => p.id !== keepParticipant.id);
      this.cleanupDuplicateParticipants(competitionId, duplicates.map(p => p.id))
        .catch(err => console.error('Error cleaning up duplicates:', err));
      
      return keepParticipant;
    } catch (error) {
      console.error('Error getting participant by userId:', error);
      throw error;
    }
  }
  
  /**
   * Clean up duplicate participant records
   */
  private static async cleanupDuplicateParticipants(
    competitionId: string,
    participantIds: string[]
  ): Promise<void> {
    if (participantIds.length === 0) return;
    
    console.log(`[ParticipantService] Cleaning up ${participantIds.length} duplicate participants`);
    
    const batch = writeBatch(db);
    for (const id of participantIds) {
      const docRef = doc(db, 'competitions', competitionId, 'participants', id);
      batch.delete(docRef);
    }
    await batch.commit();
    
    console.log(`[ParticipantService] Cleaned up ${participantIds.length} duplicate participants`);
  }

  /**
   * Approve a participant registration (Admin/Head Judge only)
   */
  static async approveRegistration(
    competitionId: string,
    participantId: string,
    approvedBy: string
  ): Promise<void> {
    try {
      // Check authorization
      await checkManageParticipantsPermission(approvedBy);

      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      await updateDoc(docRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: approvedBy,
      });

      console.log('Registration approved:', participantId);
    } catch (error) {
      console.error('Error approving registration:', error);
      throw error;
    }
  }

  /**
   * Reject a participant registration (Admin/Head Judge only)
   */
  static async rejectRegistration(
    competitionId: string,
    participantId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      // Check authorization
      await checkManageParticipantsPermission(rejectedBy);

      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      await updateDoc(docRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: rejectedBy,
        rejectionReason: reason || null,
      });

      console.log('Registration rejected:', participantId);
    } catch (error) {
      console.error('Error rejecting registration:', error);
      throw error;
    }
  }

  /**
   * Cancel own registration (User can cancel their pending registration)
   */
  static async cancelOwnRegistration(
    competitionId: string,
    participantId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify the participant belongs to this user
      const participant = await this.getParticipant(competitionId, participantId);
      
      if (!participant) {
        throw new Error('Participant not found');
      }
      
      if (participant.userId !== userId) {
        throw new Error('You can only cancel your own registration');
      }
      
      if (participant.status !== 'pending_approval' && participant.status !== 'approved') {
        throw new Error('Cannot cancel registration in current status');
      }

      const docRef = doc(
        db,
        'competitions',
        competitionId,
        'participants',
        participantId
      );

      await updateDoc(docRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      });

      console.log('Registration cancelled:', participantId);
    } catch (error) {
      console.error('Error cancelling registration:', error);
      throw error;
    }
  }

  /**
   * Get pending registrations (for admin approval list)
   */
  static async getPendingRegistrations(
    competitionId: string
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
        where('status', '==', 'pending_approval'),
        orderBy('registeredAt', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToParticipant(doc));
    } catch (error) {
      console.error('Error getting pending registrations:', error);
      throw error;
    }
  }

  /**
   * Get approved participants only
   */
  static async getApprovedParticipants(
    competitionId: string
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
        where('status', '==', 'approved'),
        orderBy('registeredAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.mapDocToParticipant(doc));
    } catch (error) {
      console.error('Error getting approved participants:', error);
      throw error;
    }
  }

  /**
   * Check if a user is an approved participant (for self-reporting authorization)
   */
  static async isApprovedParticipant(
    competitionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const participant = await this.getParticipantByUserId(competitionId, userId);
      return participant?.status === 'approved';
    } catch (error) {
      console.error('Error checking participant approval:', error);
      return false;
    }
  }
  
  /**
   * Clean up all duplicate participant records for a competition
   * Call this if duplicates have already been created
   */
  static async cleanupAllDuplicates(competitionId: string): Promise<{
    usersWithDuplicates: number;
    duplicatesRemoved: number;
  }> {
    try {
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );
      
      const snapshot = await getDocs(participantsRef);
      const allParticipants = snapshot.docs.map(doc => this.mapDocToParticipant(doc));
      
      // Group by userId
      const byUserId = new Map<string, Participant[]>();
      for (const p of allParticipants) {
        if (p.userId) {
          const existing = byUserId.get(p.userId) || [];
          existing.push(p);
          byUserId.set(p.userId, existing);
        }
      }
      
      // Find users with duplicates
      let usersWithDuplicates = 0;
      let duplicatesRemoved = 0;
      const toDelete: string[] = [];
      
      for (const [userId, participants] of byUserId) {
        if (participants.length > 1) {
          usersWithDuplicates++;
          console.log(`[ParticipantService] User ${userId} has ${participants.length} duplicate records`);
          
          // Keep the active one, or the newest one
          const sorted = [...participants].sort((a, b) => {
            // Prefer active
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            // Then prefer newer
            return (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0);
          });
          
          // Mark all except first for deletion
          for (let i = 1; i < sorted.length; i++) {
            toDelete.push(sorted[i].id);
            duplicatesRemoved++;
          }
        }
      }
      
      // Delete duplicates in batches
      if (toDelete.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < toDelete.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = toDelete.slice(i, i + batchSize);
          for (const id of chunk) {
            const docRef = doc(db, 'competitions', competitionId, 'participants', id);
            batch.delete(docRef);
          }
          await batch.commit();
        }
      }
      
      console.log(`[ParticipantService] Cleanup complete: ${usersWithDuplicates} users had duplicates, ${duplicatesRemoved} removed`);
      
      return { usersWithDuplicates, duplicatesRemoved };
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      throw error;
    }
  }
}
