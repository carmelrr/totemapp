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
  getDocs,
  Timestamp,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { RouteDoc } from '../types/route';
import { triggerStatsRefresh } from '@/utils/events/statsRefreshEvent';

// ========== ROUTES CACHE ==========
// In-memory cache for routes data to avoid repeated fetches during stats calculations
interface RoutesCache {
  data: RouteDoc[] | null;
  timestamp: number;
}

const routesCache: RoutesCache = {
  data: null,
  timestamp: 0,
};

const ROUTES_CACHE_TTL = 30000; // 30 seconds TTL

/**
 * Get cached routes or fetch from Firestore
 * Used by stats services to avoid repeated queries
 */
export async function getCachedRoutes(): Promise<RouteDoc[]> {
  if (routesCache.data && Date.now() - routesCache.timestamp < ROUTES_CACHE_TTL) {
    return routesCache.data;
  }
  
  const routesRef = collection(db, 'routes').withConverter(routeConverter);
  const snapshot = await getDocs(routesRef);
  const routes = snapshot.docs.map((doc) => doc.data());
  
  routesCache.data = routes;
  routesCache.timestamp = Date.now();
  
  return routes;
}

/**
 * Clear routes cache - call when routes are modified
 */
export function clearRoutesCache(): void {
  routesCache.data = null;
  routesCache.timestamp = 0;
}

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
      archivedAt: route.archivedAt || null,
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

    // מידות viewBox היסטוריות - לתמיכה לאחור עם נתונים ישנים
    const VIEWBOX_W = 2560;
    const VIEWBOX_H = 1600;

    // המרה אוטומטית מ-x/y ל-xNorm/yNorm אם חסרים
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
      } else {
        // Convert from absolute pixels to normalized
        xNorm = Math.min(Math.max(data.x / VIEWBOX_W, 0), 1);
        yNorm = Math.min(Math.max(data.y / VIEWBOX_H, 0), 1);
      }
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
      archivedAt: data.archivedAt || null,
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
    console.log('🔍 [RoutesService] Setting up listener for routes collection');
    const routesRef = collection(db, this.COLLECTION_NAME).withConverter(routeConverter);
    const q = query(routesRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        console.log('✅ [RoutesService] Got routes snapshot, count:', snapshot.size);
        const routes = snapshot.docs.map((doc) => doc.data());
        onChange(routes);
      },
      (error) => {
        console.error('❌ [RoutesService] Firebase Error on routes:', error.code, error.message);
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
   * Subscribe to a single route for real-time updates
   */
  static subscribeToRoute(
    routeId: string,
    onChange: (route: RouteDoc | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    const routeRef = doc(db, this.COLLECTION_NAME, routeId).withConverter(routeConverter);

    return onSnapshot(
      routeRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onChange(snapshot.data());
        } else {
          onChange(null);
        }
      },
      (error) => {
        console.error('Error subscribing to route:', error);
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
      // Trigger stats refresh so profile statistics update immediately
      triggerStatsRefresh();
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
      // Trigger stats refresh so profile statistics update immediately
      triggerStatsRefresh();
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  }

  /**
   * Archive a route (soft delete) - moves to trash for 2 weeks
   */
  static async archiveRoute(id: string): Promise<void> {
    await this.updateRoute(id, { 
      status: 'archived',
      archivedAt: Timestamp.now()
    });
    // Trigger stats refresh so profile statistics update immediately
    triggerStatsRefresh();
  }

  /**
   * Restore an archived route
   */
  static async restoreRoute(id: string): Promise<void> {
    await this.updateRoute(id, { 
      status: 'active',
      archivedAt: null  // Clear the archived timestamp
    });
    // Trigger stats refresh so profile statistics update immediately
    triggerStatsRefresh();
  }

  /**
   * Subscribe to archived routes only
   */
  static subscribeArchivedRoutes(
    onChange: (routes: RouteDoc[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const routesRef = collection(db, this.COLLECTION_NAME).withConverter(routeConverter);
    const q = query(
      routesRef,
      where('status', '==', 'archived'),
      orderBy('archivedAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const routes = snapshot.docs.map((doc) => doc.data());
        onChange(routes);
      },
      (error) => {
        console.error('Error subscribing to archived routes:', error);
        onError?.(error);
      }
    );
  }

  /**
   * Permanently delete routes that have been archived for more than 2 weeks
   * This should be called periodically (e.g., on app start or via a Cloud Function)
   */
  static async cleanupExpiredArchivedRoutes(): Promise<number> {
    try {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const twoWeeksAgoTimestamp = Timestamp.fromDate(twoWeeksAgo);

      const routesRef = collection(db, this.COLLECTION_NAME).withConverter(routeConverter);
      const q = query(
        routesRef,
        where('status', '==', 'archived'),
        where('archivedAt', '<=', twoWeeksAgoTimestamp)
      );

      const { getDocs } = await import('firebase/firestore');
      const snapshot = await getDocs(q);
      
      let deletedCount = 0;
      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(docSnapshot.ref);
        deletedCount++;
      }

      if (deletedCount > 0) {
        console.log(`🗑️ Permanently deleted ${deletedCount} expired archived routes`);
        triggerStatsRefresh();
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired archived routes:', error);
      return 0;
    }
  }

  /**
   * Get days remaining until permanent deletion for an archived route
   */
  static getDaysUntilDeletion(route: RouteDoc): number {
    if (!route.archivedAt || route.status !== 'archived') {
      return -1;
    }

    const archivedDate = route.archivedAt.toDate ? route.archivedAt.toDate() : new Date(route.archivedAt);
    const deletionDate = new Date(archivedDate);
    deletionDate.setDate(deletionDate.getDate() + 14);

    const now = new Date();
    const diffTime = deletionDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
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
