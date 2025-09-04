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
      status: route.status,
      rating: route.rating,
      tops: route.tops,
      comments: route.comments,
      setter: route.setter,
      tags: route.tags || [],
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
      originalColor: data.color
    });

    // ✅ המרה אוטומטית מ-x/y ל-xNorm/yNorm אם חסרים
    let xNorm = data.xNorm;
    let yNorm = data.yNorm;

    // אם אין נורמליזציה אבל יש קורדינטות מוחלטות - המר
    if ((xNorm == null || yNorm == null) &&
      Number.isFinite(data.x) && Number.isFinite(data.y)) {
      xNorm = Math.min(Math.max(data.x / VIEWBOX_W, 0), 1);
      yNorm = Math.min(Math.max(data.y / VIEWBOX_H, 0), 1);
      console.log(`🔄 Route ${snapshot.id}: converted x=${data.x}, y=${data.y} to xNorm=${xNorm.toFixed(4)}, yNorm=${yNorm.toFixed(4)}`);
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
      name: data.name || '',
      grade: data.grade || 'V0',
      color,
      xNorm: Number.isFinite(xNorm) ? xNorm : 0,
      yNorm: Number.isFinite(yNorm) ? yNorm : 0,
      createdAt: data.createdAt,
      status: data.status || 'active',
      rating: data.rating || 0,
      tops: data.tops || 0,
      comments: data.comments || 0,
      setter: data.setter,
      tags: data.tags || [],
    };

    console.log(`✅ Route ${snapshot.id} processed:`, {
      xNorm: result.xNorm,
      yNorm: result.yNorm,
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
      const routesRef = collection(db, this.COLLECTION_NAME).withConverter(routeConverter);

      const newRoute: Omit<RouteDoc, 'id'> = {
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
      };

      // הוסף setter רק אם הוא לא undefined/empty
      if (routeData.setter && routeData.setter.trim()) {
        newRoute.setter = routeData.setter;
      }

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
    try {
      const routeRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(routeRef, updates);
    } catch (error) {
      console.error('Error updating route:', error);
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
