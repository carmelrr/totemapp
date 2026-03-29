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
  writeBatch,
  Timestamp,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, auth } from '@/features/data/firebase';
import { RouteDoc } from '../types/route';
import { triggerStatsRefresh } from '@/utils/events/statsRefreshEvent';
import { distributeAlongWallPolyline } from '@/utils/snapToWall';

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
      nameHe: route.nameHe || null,
      nameEn: route.nameEn || null,
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
      wallTape: route.wallTape || null,
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
      nameHe: data.nameHe || undefined,
      nameEn: data.nameEn || undefined,
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
      wallTape: data.wallTape || undefined,
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
    wallTape?: string;
  }): Promise<string> {
    try {
      const routesRef = collection(db, this.COLLECTION_NAME);

      // Build route data - use empty string instead of undefined for optional fields
      const newRoute: Record<string, any> = {
        name: routeData.name,
        grade: routeData.grade,
        color: routeData.color,
        xNorm: routeData.xNorm,
        yNorm: routeData.yNorm,
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser?.uid || '',
        status: routeData.status || 'active',
        rating: 0,
        tops: 0,
        comments: 0,
        tags: routeData.tags || [],
        setter: routeData.setter?.trim() || '', // Empty string instead of undefined
      };

      // Only add wallTape if provided
      if (routeData.wallTape) {
        newRoute.wallTape = routeData.wallTape;
      }

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
   * Batch archive multiple routes (soft delete) - moves to trash for 2 weeks
   * Uses Firestore writeBatch for atomic operation
   */
  static async batchArchiveRoutes(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    const batch = writeBatch(db);
    const now = Timestamp.now();
    
    for (const id of ids) {
      const routeRef = doc(db, this.COLLECTION_NAME, id);
      batch.update(routeRef, {
        status: 'archived',
        archivedAt: now,
      });
    }
    
    await batch.commit();
    triggerStatsRefresh();
    return ids.length;
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
   * Update names (nameHe, nameEn, name) for all routes with a given color
   * that don't yet have bilingual names.
   * Returns the number of routes updated.
   */
  static async updateRouteNamesByColor(
    color: string,
    nameHe: string,
    nameEn: string,
    excludeRouteId?: string
  ): Promise<number> {
    try {
      const routesRef = collection(db, this.COLLECTION_NAME);
      const q = query(routesRef, where('color', '==', color));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Try uppercase
        const qUpper = query(routesRef, where('color', '==', color.toUpperCase()));
        const snapshotUpper = await getDocs(qUpper);
        if (snapshotUpper.empty) return 0;

        const batch = writeBatch(db);
        let count = 0;
        snapshotUpper.docs.forEach((docSnap) => {
          if (excludeRouteId && docSnap.id === excludeRouteId) return;
          const data = docSnap.data();
          // Only update routes that don't have bilingual names yet
          if (!data.nameHe || !data.nameEn) {
            const grade = data.grade || '';
            batch.update(docSnap.ref, {
              name: `${nameHe} ${grade}`.trim(),
              nameHe: `${nameHe} ${grade}`.trim(),
              nameEn: `${nameEn} ${grade}`.trim(),
            });
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
          clearRoutesCache();
        }
        return count;
      }

      const batch = writeBatch(db);
      let count = 0;
      snapshot.docs.forEach((docSnap) => {
        if (excludeRouteId && docSnap.id === excludeRouteId) return;
        const data = docSnap.data();
        // Only update routes that don't have bilingual names yet
        if (!data.nameHe || !data.nameEn) {
          const grade = data.grade || '';
          batch.update(docSnap.ref, {
            name: `${nameHe} ${grade}`.trim(),
            nameHe: `${nameHe} ${grade}`.trim(),
            nameEn: `${nameEn} ${grade}`.trim(),
          });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        clearRoutesCache();
      }
      return count;
    } catch (error) {
      console.error('Error updating route names by color:', error);
      throw error;
    }
  }

  /**
   * Normalize all routes that have oldColor to newColor (fixes legacy hex mismatches).
   * Also updates names if provided. Returns count of updated routes.
   */
  static async normalizeRouteColor(
    oldColor: string,
    newColor: string,
    colorNameHe?: string,
    colorNameEn?: string,
    excludeRouteId?: string
  ): Promise<number> {
    if (oldColor.toUpperCase() === newColor.toUpperCase()) return 0;
    try {
      const routesRef = collection(db, this.COLLECTION_NAME);
      const q = query(routesRef, where('color', '==', oldColor));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return 0;

      const batch = writeBatch(db);
      let count = 0;
      snapshot.docs.forEach((docSnap) => {
        if (excludeRouteId && docSnap.id === excludeRouteId) return;
        const data = docSnap.data();
        const updates: any = { color: newColor };
        // Also update names if provided
        if (colorNameHe && colorNameEn && data.grade) {
          updates.name = `${colorNameHe} ${data.grade}`;
          updates.nameHe = `${colorNameHe} ${data.grade}`;
          updates.nameEn = `${colorNameEn} ${data.grade}`;
        }
        batch.update(docSnap.ref, updates);
        count++;
      });
      if (count > 0) {
        await batch.commit();
        clearRoutesCache();
      }
      return count;
    } catch (error) {
      console.error('Error normalizing route color:', error);
      throw error;
    }
  }

  /**
   * Update all routes that have a specific color to a new color
   * Used when admin edits a color in the color management screen
   */
  static async updateRoutesByColor(oldColor: string, newColor: string): Promise<number> {
    try {
      const routesRef = collection(db, this.COLLECTION_NAME);
      // Query routes with the old color (try both cases)
      const q = query(routesRef, where('color', '==', oldColor));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Try uppercase version
        const qUpper = query(routesRef, where('color', '==', oldColor.toUpperCase()));
        const snapshotUpper = await getDocs(qUpper);
        if (snapshotUpper.empty) return 0;

        const batch = writeBatch(db);
        snapshotUpper.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, { color: newColor });
        });
        await batch.commit();
        clearRoutesCache();
        return snapshotUpper.size;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { color: newColor });
      });
      await batch.commit();
      clearRoutesCache();
      return snapshot.size;
    } catch (error) {
      console.error('Error updating routes by color:', error);
      throw error;
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

  /**
   * Normalize ALL active routes: for each route, find the closest visible color
   * and update the color + bilingual names (Hebrew & English).
   * Used by admin to fix color mismatches after editing the color palette.
   * Returns { updated, skipped, total }.
   */
  static async normalizeAllRouteColors(): Promise<{ updated: number; skipped: number; total: number }> {
    const { findClosestVisibleColorWithKey, getColorTranslationKey } = require('../utils/colors');
    const { getColorSettingSync, initializeColorSettings } = require('./ColorSettingsService');
    const { he: heTranslations } = require('@/features/language/translations/he');
    const { en: enTranslations } = require('@/features/language/translations/en');

    // Ensure color settings cache is loaded
    await initializeColorSettings();

    try {
      const routesRef = collection(db, this.COLLECTION_NAME);
      const q = query(routesRef, where('status', '==', 'active'));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return { updated: 0, skipped: 0, total: 0 };

      const total = snapshot.size;
      let updated = 0;
      let skipped = 0;

      // Firestore batches are limited to 500 operations
      const batches: ReturnType<typeof writeBatch>[] = [writeBatch(db)];
      let batchIndex = 0;
      let opsInBatch = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const currentColor = data.color || '';
        const grade = data.grade || '';

        if (!currentColor || !grade) {
          skipped++;
          continue;
        }

        // Find closest visible color
        const { key: closestKey, displayHex: closestHex } = findClosestVisibleColorWithKey(currentColor);

        // Get color names for both languages
        const colorKey = getColorTranslationKey(closestKey);
        const customSetting = getColorSettingSync(closestKey);
        const colorNameHe = customSetting?.nameHe ||
          heTranslations?.colors?.[colorKey] || colorKey;
        const colorNameEn = customSetting?.nameEn ||
          enTranslations?.colors?.[colorKey] || colorKey;

        const newNameHe = `${colorNameHe} ${grade}`;
        const newNameEn = `${colorNameEn} ${grade}`;

        // Check if anything actually changed
        if (
          currentColor.toUpperCase() === closestHex.toUpperCase() &&
          data.nameHe === newNameHe &&
          data.nameEn === newNameEn
        ) {
          skipped++;
          continue;
        }

        // Need a new batch?
        if (opsInBatch >= 499) {
          batches.push(writeBatch(db));
          batchIndex++;
          opsInBatch = 0;
        }

        batches[batchIndex].update(docSnap.ref, {
          color: closestHex,
          name: newNameHe,
          nameHe: newNameHe,
          nameEn: newNameEn,
        });
        opsInBatch++;
        updated++;
      }

      // Commit all batches
      for (const batch of batches) {
        await batch.commit();
      }

      if (updated > 0) {
        clearRoutesCache();
      }

      return { updated, skipped, total };
    } catch (error) {
      console.error('Error normalizing all route colors:', error);
      throw error;
    }
  }

  /**
   * Balance route positions for routes created on a specific date.
   * When extremeId1 and extremeId2 are provided, they are used as the two
   * endpoints of the balancing line. Otherwise, the leftmost and rightmost
   * routes (by xNorm) are chosen automatically.
   *
   * Routes are sorted by their projection onto the line between the two
   * extremes, which keeps them on the "inner side" of the map and
   * properly handles non-horizontal arrangements.
   */
  static async restoreRoutePositions(
    previousPositions: Record<string, { xNorm: number; yNorm: number }>,
  ): Promise<{ restored: number }> {
    try {
      const entries = Object.entries(previousPositions);
      if (entries.length === 0) return { restored: 0 };

      const batch = writeBatch(db);
      entries.forEach(([routeId, pos]) => {
        const routeRef = doc(db, this.COLLECTION_NAME, routeId);
        batch.update(routeRef, { xNorm: pos.xNorm, yNorm: pos.yNorm });
      });
      await batch.commit();
      clearRoutesCache();
      return { restored: entries.length };
    } catch (error) {
      console.error('Error restoring route positions:', error);
      throw error;
    }
  }

  static async balanceRoutePositions(
    dateStr: string,
    extremeId1?: string,
    extremeId2?: string,
    room?: any,
  ): Promise<{ updated: number; total: number; previousPositions: Record<string, { xNorm: number; yNorm: number }> }> {
    try {
      // Parse date range using local time
      const [year, month, day] = dateStr.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

      console.log('[RoutesService] balanceRoutePositions:', { dateStr, extremeId1, extremeId2 });

      // Fetch all active routes
      const routesRef = collection(db, this.COLLECTION_NAME).withConverter(routeConverter);
      const q = query(routesRef, where('status', '==', 'active'));
      const snapshot = await getDocs(q);

      // Filter by date
      const dateRoutes = snapshot.docs
        .map((d) => ({ docRef: d.ref, route: d.data() }))
        .filter(({ route }) => {
          if (!route.createdAt) return false;
          const routeDate = route.createdAt.toDate ? route.createdAt.toDate() : new Date(route.createdAt);
          return routeDate >= startOfDay && routeDate < endOfDay;
        });

      console.log('[RoutesService] Routes matching date:', dateRoutes.length);

      if (dateRoutes.length < 2) {
        return { updated: 0, total: dateRoutes.length };
      }

      // Determine extremes: use provided IDs or fallback to auto-detection
      let extremeA: typeof dateRoutes[0];
      let extremeB: typeof dateRoutes[0];

      if (extremeId1 && extremeId2) {
        const a = dateRoutes.find((r) => r.route.id === extremeId1);
        const b = dateRoutes.find((r) => r.route.id === extremeId2);
        if (!a || !b) {
          throw new Error('One or both extreme route IDs not found in date range');
        }
        extremeA = a;
        extremeB = b;
      } else {
        // Fallback: leftmost and rightmost by xNorm
        dateRoutes.sort((a, b) => a.route.xNorm - b.route.xNorm);
        extremeA = dateRoutes[0];
        extremeB = dateRoutes[dateRoutes.length - 1];
      }

      const ax = extremeA.route.xNorm;
      const ay = extremeA.route.yNorm;
      const bx = extremeB.route.xNorm;
      const by = extremeB.route.yNorm;

      // Direction vector A→B
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;

      // Sort routes by their projection onto the A→B line.
      const withProjection = dateRoutes.map((item) => {
        const px = item.route.xNorm - ax;
        const py = item.route.yNorm - ay;
        const t = lenSq > 0 ? (px * dx + py * dy) / lenSq : 0;
        return { ...item, t };
      });
      withProjection.sort((a, b) => a.t - b.t);

      // Compute target positions — along wall polyline if room is provided
      const count = withProjection.length;
      let targetPositions: { xNorm: number; yNorm: number }[];

      if (room && room.walls && room.walls.length > 0) {
        // Distribute along the wall polyline
        targetPositions = distributeAlongWallPolyline(
          { xNorm: ax, yNorm: ay },
          { xNorm: bx, yNorm: by },
          count,
          room,
        );
      } else {
        // Fallback: straight line
        targetPositions = withProjection.map((_, index) => {
          const frac = count > 1 ? index / (count - 1) : 0;
          return { xNorm: ax + frac * dx, yNorm: ay + frac * dy };
        });
      }

      const batch = writeBatch(db);
      let updated = 0;
      const previousPositions: Record<string, { xNorm: number; yNorm: number }> = {};

      withProjection.forEach((item, index) => {
        const newX = targetPositions[index].xNorm;
        const newY = targetPositions[index].yNorm;

        // Only update if position actually changed
        if (Math.abs(item.route.xNorm - newX) > 0.0001 || Math.abs(item.route.yNorm - newY) > 0.0001) {
          // Save old position for undo
          previousPositions[item.route.id] = { xNorm: item.route.xNorm, yNorm: item.route.yNorm };
          const routeRef = doc(db, this.COLLECTION_NAME, item.route.id);
          batch.update(routeRef, { xNorm: newX, yNorm: newY });
          updated++;
        }
      });

      if (updated > 0) {
        await batch.commit();
        clearRoutesCache();
      }

      return { updated, total: dateRoutes.length, previousPositions };
    } catch (error) {
      console.error('Error balancing route positions:', error);
      throw error;
    }
  }
}
