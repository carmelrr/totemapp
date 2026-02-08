/**
 * @fileoverview Competition Routes Service
 * @description Firebase operations for competition routes (wall map)
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
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/features/data/firebase';
import { CompetitionRoute, TotemtitionRoute } from '../types';
import { getGradeBasePoints } from '../constants';
import { getUserRoles } from '@/features/roles/rolesService';

/**
 * Check if user has permission to manage competition routes
 * Only Head Judges and Admins can manage routes
 */
async function checkManageRoutesPermission(userId: string): Promise<void> {
  const userRoles = await getUserRoles(userId);
  const hasPermission = userRoles.includes('admin') || 
                       userRoles.includes('head_judge');
  
  if (!hasPermission) {
    throw new Error('Not authorized to manage competition routes. Only head judges and admins can manage routes.');
  }
}

/**
 * Service for managing competition routes
 */
export class CompetitionRoutesService {
  // =============== Route CRUD ===============

  /**
   * Add a route to a competition
   */
  static async addRoute(
    competitionId: string,
    data: {
      number: number;
      grade: string;
      xNorm: number;
      yNorm: number;
      pointsTop?: number;
      pointsZone?: number;
    },
    createdBy: string
  ): Promise<string> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkManageRoutesPermission(currentUser.uid);

      const routesRef = collection(
        db,
        'competitions',
        competitionId,
        'routes'
      );

      const basePoints = getGradeBasePoints(data.grade);

      const routeData: any = {
        competitionId,
        number: data.number,
        grade: data.grade,
        basePoints,
        xNorm: data.xNorm,
        yNorm: data.yNorm,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy,
      };

      // Store per-route scoring overrides for zone_top format
      if (data.pointsTop !== undefined) routeData.pointsTop = data.pointsTop;
      if (data.pointsZone !== undefined) routeData.pointsZone = data.pointsZone;

      const docRef = await addDoc(routesRef, routeData);
      console.log('Route added:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error adding route:', error);
      throw error;
    }
  }

  /**
   * Update a route
   */
  static async updateRoute(
    competitionId: string,
    routeId: string,
    data: Partial<{
      number: number;
      grade: string;
      xNorm: number;
      yNorm: number;
      color: string;
      isActive: boolean;
      pointsTop: number;
      pointsZone: number;
    }>
  ): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkManageRoutesPermission(currentUser.uid);

      const routeRef = doc(
        db,
        'competitions',
        competitionId,
        'routes',
        routeId
      );

      const updateData: any = { ...data };

      // Recalculate base points if grade changed
      if (data.grade) {
        updateData.basePoints = getGradeBasePoints(data.grade);
      }

      await updateDoc(routeRef, updateData);
      console.log('Route updated:', routeId);
    } catch (error) {
      console.error('Error updating route:', error);
      throw error;
    }
  }

  /**
   * Delete a route
   */
  static async deleteRoute(
    competitionId: string,
    routeId: string
  ): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkManageRoutesPermission(currentUser.uid);

      const routeRef = doc(
        db,
        'competitions',
        competitionId,
        'routes',
        routeId
      );

      await deleteDoc(routeRef);
      console.log('Route deleted:', routeId);
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  }

  // =============== Query Operations ===============

  /**
   * Get all routes for a competition
   */
  static async getRoutes(competitionId: string): Promise<CompetitionRoute[]> {
    try {
      const routesRef = collection(
        db,
        'competitions',
        competitionId,
        'routes'
      );

      const q = query(routesRef, orderBy('number', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => this.mapDocToRoute(doc));
    } catch (error) {
      console.error('Error getting routes:', error);
      throw error;
    }
  }

  /**
   * Get a specific route
   */
  static async getRoute(
    competitionId: string,
    routeId: string
  ): Promise<CompetitionRoute | null> {
    try {
      const routeRef = doc(
        db,
        'competitions',
        competitionId,
        'routes',
        routeId
      );

      const routeDoc = await getDoc(routeRef);
      if (!routeDoc.exists()) return null;

      return this.mapDocToRoute(routeDoc);
    } catch (error) {
      console.error('Error getting route:', error);
      throw error;
    }
  }

  /**
   * Get route by number
   */
  static async getRouteByNumber(
    competitionId: string,
    routeNumber: number
  ): Promise<CompetitionRoute | null> {
    try {
      const routes = await this.getRoutes(competitionId);
      return routes.find(r => r.number === routeNumber) || null;
    } catch (error) {
      console.error('Error getting route by number:', error);
      throw error;
    }
  }

  /**
   * Get route count
   */
  static async getRouteCount(competitionId: string): Promise<number> {
    try {
      const routes = await this.getRoutes(competitionId);
      return routes.filter(r => r.isActive).length;
    } catch (error) {
      console.error('Error getting route count:', error);
      return 0;
    }
  }

  // =============== Real-time Subscriptions ===============

  /**
   * Subscribe to routes list
   */
  static subscribeToRoutes(
    competitionId: string,
    callback: (routes: CompetitionRoute[]) => void
  ): () => void {
    const routesRef = collection(
      db,
      'competitions',
      competitionId,
      'routes'
    );

    const q = query(routesRef, orderBy('number', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const routes = snapshot.docs.map(doc => this.mapDocToRoute(doc));
        callback(routes);
      },
      (error) => {
        console.error('Error subscribing to routes:', error);
        callback([]);
      }
    );
  }

  // =============== Bulk Operations ===============

  /**
   * Create routes for a competition (batch)
   * @param competitionId - Competition ID
   * @param routeCount - Number of routes to create
   * @param grades - Array of grades for each route (optional)
   * @param createdBy - Admin user ID
   */
  static async createRoutesForCompetition(
    competitionId: string,
    routeCount: number,
    grades: string[] = [],
    createdBy: string
  ): Promise<number> {
    try {
      const routesRef = collection(
        db,
        'competitions',
        competitionId,
        'routes'
      );

      const batch = writeBatch(db);

      for (let i = 1; i <= routeCount; i++) {
        const grade = grades[i - 1] || 'V0';
        const basePoints = getGradeBasePoints(grade);

        const newDocRef = doc(routesRef);
        batch.set(newDocRef, {
          competitionId,
          number: i,
          grade,
          basePoints,
          xNorm: 0,
          yNorm: 0,
          isActive: true,
          createdAt: serverTimestamp(),
          createdBy,
        });
      }

      await batch.commit();
      console.log(`Created ${routeCount} routes for competition:`, competitionId);
      return routeCount;
    } catch (error) {
      console.error('Error creating routes:', error);
      throw error;
    }
  }

  /**
   * Delete all routes for a competition
   */
  static async deleteAllRoutes(competitionId: string): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkManageRoutesPermission(currentUser.uid);

      const routes = await this.getRoutes(competitionId);
      const batch = writeBatch(db);

      routes.forEach(route => {
        const routeRef = doc(
          db,
          'competitions',
          competitionId,
          'routes',
          route.id
        );
        batch.delete(routeRef);
      });

      await batch.commit();
      console.log('All routes deleted for competition:', competitionId);
    } catch (error) {
      console.error('Error deleting all routes:', error);
      throw error;
    }
  }

  /**
   * Update route positions in bulk (after drag & drop on wall map)
   */
  static async updateRoutePositions(
    competitionId: string,
    positions: Array<{ routeId: string; xNorm: number; yNorm: number }>
  ): Promise<void> {
    try {
      const batch = writeBatch(db);

      positions.forEach(({ routeId, xNorm, yNorm }) => {
        const routeRef = doc(
          db,
          'competitions',
          competitionId,
          'routes',
          routeId
        );
        batch.update(routeRef, { xNorm, yNorm });
      });

      await batch.commit();
      console.log('Route positions updated');
    } catch (error) {
      console.error('Error updating route positions:', error);
      throw error;
    }
  }

  /**
   * Update a route's position for a specific category
   * Stores positions per-category in categoryPositions map
   */
  static async updateRouteCategoryPosition(
    competitionId: string,
    routeId: string,
    categoryId: string,
    xNorm: number,
    yNorm: number
  ): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');
      await checkManageRoutesPermission(currentUser.uid);

      const routeRef = doc(db, 'competitions', competitionId, 'routes', routeId);
      await updateDoc(routeRef, {
        [`categoryPositions.${categoryId}`]: { xNorm, yNorm },
      });
      console.log(`Route ${routeId} position updated for category ${categoryId}`);
    } catch (error) {
      console.error('Error updating route category position:', error);
      throw error;
    }
  }

  // =============== Totemtition-specific ===============

  /**
   * Update Totemtition route completion stats
   */
  static async updateTotemtitionRouteStats(
    competitionId: string,
    routeId: string,
    completionCount: number,
    totalPoolPoints: number = 1000
  ): Promise<void> {
    try {
      const routeRef = doc(
        db,
        'competitions',
        competitionId,
        'routes',
        routeId
      );

      const pointsPerCompletion = completionCount > 0
        ? Math.floor(totalPoolPoints / completionCount)
        : totalPoolPoints;

      await updateDoc(routeRef, {
        completionCount,
        totalPoolPoints,
        currentPointsPerCompletion: pointsPerCompletion,
      });

      console.log('Totemtition route stats updated:', routeId);
    } catch (error) {
      console.error('Error updating totemtition route stats:', error);
      throw error;
    }
  }

  /**
   * Get routes with Totemtition scoring data
   */
  static async getTotemtitionRoutes(
    competitionId: string
  ): Promise<TotemtitionRoute[]> {
    try {
      const routes = await this.getRoutes(competitionId);

      return routes.map(route => ({
        ...route,
        totalPoolPoints: (route as any).totalPoolPoints || 1000,
        completionCount: (route as any).completionCount || 0,
        currentPointsPerCompletion: (route as any).currentPointsPerCompletion || 1000,
      }));
    } catch (error) {
      console.error('Error getting totemtition routes:', error);
      throw error;
    }
  }

  // =============== Helper Methods ===============

  /**
   * Map Firestore document to CompetitionRoute
   */
  private static mapDocToRoute(docSnap: any): CompetitionRoute {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      competitionId: data.competitionId,
      routeNumber: data.number || data.routeNumber,
      number: data.number || data.routeNumber,
      grade: data.grade,
      basePoints: data.basePoints || getGradeBasePoints(data.grade),
      xNorm: data.xNorm || 0,
      yNorm: data.yNorm || 0,
      color: data.color, // Custom color set by head judge
      isActive: data.isActive ?? true,
      createdAt: data.createdAt?.toDate() || new Date(),
      createdBy: data.createdBy,
      // Per-route scoring overrides (zone_top format)
      ...(data.pointsTop !== undefined && { pointsTop: data.pointsTop }),
      ...(data.pointsZone !== undefined && { pointsZone: data.pointsZone }),
      // Per-category positions
      ...(data.categoryPositions && { categoryPositions: data.categoryPositions }),
    };
  }
}
