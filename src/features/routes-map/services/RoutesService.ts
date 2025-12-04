/**
 * @fileoverview שירות ניהול מסלולים - Firestore operations for routes management
 * @description Routes Service - handles CRUD operations for climbing routes
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { RouteDoc } from '../types/route';

/**
 * ממיר Firestore לבטיחות טיפוסים
 * Firestore converter for type safety
 */
const routeConverter: FirestoreDataConverter<RouteDoc> = {
  toFirestore(route: any): DocumentData {
    return {
      name: route.name,
      grade: route.grade,
      color: route.color,
      xNorm: route.xNorm,
      yNorm: route.yNorm,
      createdAt: route.createdAt || Timestamp.now(),
      status: route.status || 'active',
      rating: route.rating || 0,
      tops: route.tops || 0,
      comments: route.comments || 0,
      tags: route.tags || [],
      setter: route.setter || '', // Empty string instead of undefined
      // Community feedback stats
      averageStarRating: route.averageStarRating || 0,
      calculatedGrade: route.calculatedGrade || null,
      feedbackCount: route.feedbackCount || 0,
      completionCount: route.completionCount || 0,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options): RouteDoc {
    const data = snapshot.data(options);

    // ✅ מידות viewBox של WallMapSVG - עדכן לפי הקובץ שלך
    const VIEWBOX_W = 2560;
    const VIEWBOX_H = 1600;

    console.log(`🔍 Processing route ${snapshot.id}:`, {
      name: data.name,
      originalX: data.x,
      originalY: data.y,
      originalXNorm: data.xNorm,
      originalYNorm: data.yNorm,
      originalColor: data.color,
      hasXNorm: typeof data.xNorm === 'number',
      hasYNorm: typeof data.yNorm === 'number',
      xIsNormalized: typeof data.x === 'number' && data.x >= 0 && data.x <= 1,
      yIsNormalized: typeof data.y === 'number' && data.y >= 0 && data.y <= 1
    });

    // ✅ המרה אוטומטית מ-x/y ל-xNorm/yNorm אם חסרים
    let xNorm = data.xNorm;
    let yNorm = data.yNorm;

    // Helper function to check if already normalized
    const isNormalized = (x: number, y: number) => {
      return typeof x === 'number' && typeof y === 'number' && 
             x >= 0 && x <= 1 && y >= 0 && y <= 1;
    };

    // Only convert if we don't have valid normalized coordinates
    if ((typeof xNorm !== 'number' || typeof yNorm !== 'number' || !isNormalized(xNorm, yNorm)) &&
        Number.isFinite(data.x) && Number.isFinite(data.y)) {
      
      // Check if x,y values are already normalized (between 0-1)
      if (isNormalized(data.x, data.y)) {
        xNorm = data.x;
        yNorm = data.y;
        console.log(`✅ Route ${snapshot.id}: using already normalized x=${data.x}, y=${data.y}`);
      } else {
        // Convert from absolute pixels to normalized
        xNorm = Math.min(Math.max(data.x / VIEWBOX_W, 0), 1);
        yNorm = Math.min(Math.max(data.y / VIEWBOX_H, 0), 1);
        console.log(`🔄 Route ${snapshot.id}: converted x=${data.x}, y=${data.y} to xNorm=${xNorm.toFixed(4)}, yNorm=${yNorm.toFixed(4)}`);
      }
    } else if (typeof xNorm === 'number' && typeof yNorm === 'number') {
      console.log(`✅ Route ${snapshot.id}: using existing xNorm=${xNorm.toFixed(4)}, yNorm=${yNorm.toFixed(4)}`);
    }

    // ✅ Adapter סלחני לצבע שמחפש בכמה מפתחות נפוצים
    const color =
      data.color ??
      data.colorHex ??
      data.visual?.color ??
      data.meta?.color ??
      '#ef4444'; // fallback אדום

    const result = {
      id: snapshot.id,
      name: data.name || data.title || `מסלול ${snapshot.id.slice(-6)}`, // Better fallback
      grade: data.grade || 'V0',
      color,
      xNorm: Number.isFinite(xNorm) ? Math.min(Math.max(xNorm, 0), 1) : 0,
      yNorm: Number.isFinite(yNorm) ? Math.min(Math.max(yNorm, 0), 1) : 0,
      createdAt: data.createdAt,
      status: data.status || 'active',
      rating: data.rating || 0,
      tops: data.tops || 0,
      comments: data.comments || 0,
      setter: data.setter,
      tags: data.tags || [],
      // Community feedback stats
      averageStarRating: data.averageStarRating || 0,
      calculatedGrade: data.calculatedGrade || null,
      feedbackCount: data.feedbackCount || 0,
      completionCount: data.completionCount || 0,
    };

    console.log(`✅ Route ${snapshot.id} processed:`, {
      finalXNorm: result.xNorm,
      finalYNorm: result.yNorm,
      isValidCoords: result.xNorm >= 0 && result.xNorm <= 1 && result.yNorm >= 0 && result.yNorm <= 1,
      color: result.color,
      isValid: Number.isFinite(result.xNorm) && Number.isFinite(result.yNorm),
      inBounds: result.xNorm >= 0 && result.xNorm <= 1 && result.yNorm >= 0 && result.yNorm <= 1
    });

    return result;
  },
};

export class RoutesService {
  private static readonly COLLECTION_NAME = 'routes';

  /**
   * Subscribe to routes collection with real-time updates
   */
  static subscribeRoutes(
    onChange: (routes: RouteDoc[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const routesRef = collection(db, this.COLLECTION_NAME).withConverter(routeConverter);
    const q = query(routesRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const routes = snapshot.docs.map((doc) => doc.data());
        onChange(routes);
      },
      (error) => {
        console.error('Error subscribing to routes:', error);
        onError?.(error);
      }
    );
  }

  /**
   * Subscribe to active routes only
   */
  static subscribeActiveRoutes(
    onChange: (routes: RouteDoc[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const routesRef = collection(db, this.COLLECTION_NAME).withConverter(routeConverter);
    const q = query(
      routesRef,
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const routes = snapshot.docs.map((doc) => doc.data());
        onChange(routes);
      },
      (error) => {
        console.error('Error subscribing to active routes:', error);
        onError?.(error);
      }
    );
  }

  /**
   * Add a new route
   */
  static async addRoute(routeData: {
    name: string;
    grade: string;
    color: string;
    xNorm: number;
    yNorm: number;
    status?: 'active' | 'archived' | 'draft';
    setter?: string;
    tags?: string[];
  }): Promise<string> {
    try {
      const routesRef = collection(db, this.COLLECTION_NAME);

      // Build route data - use empty string instead of undefined for optional fields
      const newRoute = {
        name: routeData.name,
        grade: routeData.grade,
        color: routeData.color,
        xNorm: routeData.xNorm,
        yNorm: routeData.yNorm,
        createdAt: Timestamp.now(),
        status: routeData.status || 'active',
        rating: 0,
        tops: 0,
        comments: 0,
        tags: routeData.tags || [],
        setter: routeData.setter?.trim() || '', // Empty string instead of undefined
      };

      console.log('📝 Adding route to Firestore:', JSON.stringify(newRoute, null, 2));

      const docRef = await addDoc(routesRef, newRoute);
      return docRef.id;
    } catch (error) {
      console.error('Error adding route:', error);
      throw error;
    }
  }

  /**
   * Update an existing route
   */
  static async updateRoute(
    id: string,
    updates: Partial<Omit<RouteDoc, 'id' | 'createdAt'>>
  ): Promise<void> {
    console.log('[RoutesService] updateRoute called with id:', id);
    console.log('[RoutesService] updates:', JSON.stringify(updates));
    try {
      const routeRef = doc(db, this.COLLECTION_NAME, id);
      console.log('[RoutesService] Got doc reference, calling updateDoc...');
      await updateDoc(routeRef, updates);
      console.log('[RoutesService] updateDoc completed successfully');
    } catch (error) {
      console.error('[RoutesService] Error updating route:', error);
      throw error;
    }
  }

  /**
   * Delete a route
   */
  static async deleteRoute(id: string): Promise<void> {
    try {
      const routeRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(routeRef);
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  }

  /**
   * Archive a route (soft delete)
   */
  static async archiveRoute(id: string): Promise<void> {
    return this.updateRoute(id, { status: 'archived' });
  }

  /**
   * Restore an archived route
   */
  static async restoreRoute(id: string): Promise<void> {
    return this.updateRoute(id, { status: 'active' });
  }

  /**
   * Increment tops count for a route
   */
  static async incrementTops(id: string): Promise<void> {
    try {
      const routeRef = doc(db, this.COLLECTION_NAME, id);
      // Note: In production, you might want to use a transaction or increment field value
      // For now, we'll fetch current value and increment
      const currentRoute = await this.getRoute(id);
      if (currentRoute) {
        await updateDoc(routeRef, { tops: currentRoute.tops + 1 });
      }
    } catch (error) {
      console.error('Error incrementing tops:', error);
      throw error;
    }
  }

  /**
   * Get a single route by ID (helper method)
   */
  private static async getRoute(id: string): Promise<RouteDoc | null> {
    try {
      const routeRef = doc(db, this.COLLECTION_NAME, id).withConverter(routeConverter);
      const snapshot = await import('firebase/firestore').then(({ getDoc }) => getDoc(routeRef));
      return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
      console.error('Error getting route:', error);
      return null;
    }
  }

  /**
   * Get display grade for a route (utility function)
   */
  static getDisplayGrade(route: any): string {
    if (!route) return "";
    const grade = route.calculatedGrade || route.grade;
    return grade ? String(grade) : "";
  }

  /**
   * Get display star rating for a route (utility function)
   */
  static getDisplayStarRating(route: any): number {
    return route.averageStarRating || 0;
  }

  /**
   * Get completion count for a route (utility function)
   */
  static getCompletionCount(route: any): number {
    return route.completionCount || 0;
  }
}
