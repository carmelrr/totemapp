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

// Firestore converter for type safety
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
    return {
      id: snapshot.id,
      name: data.name || '',
      grade: data.grade || 'V0',
      color: data.color || '#ef4444',
      xNorm: data.xNorm || 0,
      yNorm: data.yNorm || 0,
      createdAt: data.createdAt,
      status: data.status || 'active',
      rating: data.rating || 0,
      tops: data.tops || 0,
      comments: data.comments || 0,
      setter: data.setter,
      tags: data.tags || [],
    };
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
        setter: routeData.setter,
        tags: routeData.tags || [],
      };

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
}
