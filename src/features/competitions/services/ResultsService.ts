/**
 * @fileoverview Results Service
 * @description Firebase operations for competition results and scoring
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
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '@/features/data/firebase';
import {
  RouteResult,
  ParticipantResult,
  LeaderboardEntry,
  CompetitionRoute,
  Competition,
} from '../types';
import {
  calculateRoutePoints,
  calculateTopNPoints,
  calculateTotemtitionPoints,
  calculateZoneTopRoutePoints,
  buildZoneTopScoringConfig,
  isZoneTopFormat,
  isPointsCompetitionFormat,
  calculatePointsCompetitionRoutePoints,
  NATIONAL_LEAGUE_SCORING,
} from '../constants';
import { getUserRoles } from '@/features/roles/rolesService';
import { ParticipantService } from './ParticipantService';

// =============== In-memory participant cache ===============
// During a single session a judge/participant may call enterRouteResult many
// times in quick succession (e.g. ticking 30 routes for a climber).  Each call
// previously hit Firestore with a fresh getParticipantByUserId lookup.  We
// cache the participant in memory with a short TTL so bursts of calls resolve
// instantly.  TTL is short enough that stale data from another tab/device is
// not a concern in practice – category reassignments are rare.

const PARTICIPANT_CACHE_TTL_MS = 30_000;
type ParticipantCacheEntry = {
  value: Awaited<ReturnType<typeof ParticipantService.getParticipantByUserId>>;
  expiresAt: number;
};
const participantCache = new Map<string, ParticipantCacheEntry>();

function participantCacheKey(competitionId: string, userId: string): string {
  return `${competitionId}:${userId}`;
}

async function getParticipantByUserIdCached(
  competitionId: string,
  userId: string,
): ReturnType<typeof ParticipantService.getParticipantByUserId> {
  const key = participantCacheKey(competitionId, userId);
  const now = Date.now();
  const cached = participantCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await ParticipantService.getParticipantByUserId(
    competitionId,
    userId,
  );
  participantCache.set(key, { value, expiresAt: now + PARTICIPANT_CACHE_TTL_MS });
  return value;
}

function invalidateParticipantCache(competitionId: string, userId?: string): void {
  if (userId) {
    participantCache.delete(participantCacheKey(competitionId, userId));
    return;
  }
  // Drop every entry for this competition.
  const prefix = `${competitionId}:`;
  for (const key of participantCache.keys()) {
    if (key.startsWith(prefix)) participantCache.delete(key);
  }
}

// =============== Snapshot coalescing ===============
// Firestore onSnapshot fires once per write batch, but during live scoring a
// judge may submit several writes per second.  Each event triggers a full
// leaderboard recompute, which is wasted work when events arrive within the
// same UI tick.  This helper defers the recompute to a microtask so multiple
// bursts collapse into one callback invocation.

function coalesce<T>(fn: (arg: T) => void): (arg: T) => void {
  let pending: { arg: T } | null = null;
  return (arg: T) => {
    const hadPending = pending !== null;
    pending = { arg };
    if (hadPending) return;
    Promise.resolve().then(() => {
      const current = pending;
      pending = null;
      if (current) fn(current.arg);
    });
  };
}

// =============== Result write conflict ===============
// Thrown by enterRouteResult when the caller provided an expectedVersion and
// the stored document has already advanced past it. Judge/head-judge UI can
// catch this to show a merge/overwrite dialog.

export class ResultConflictError extends Error {
  readonly serverVersion: number;
  readonly expectedVersion: number;
  readonly existingRoute: RouteResult | null;
  readonly existingEditedBy: string | null;
  readonly existingEditedAt: Date | null;
  constructor(opts: {
    serverVersion: number;
    expectedVersion: number;
    existingRoute: RouteResult | null;
    existingEditedBy?: string | null;
    existingEditedAt?: Date | null;
  }) {
    super(
      `Result version conflict: expected v${opts.expectedVersion}, server is v${opts.serverVersion}`,
    );
    this.name = 'ResultConflictError';
    this.serverVersion = opts.serverVersion;
    this.expectedVersion = opts.expectedVersion;
    this.existingRoute = opts.existingRoute;
    this.existingEditedBy = opts.existingEditedBy ?? null;
    this.existingEditedAt = opts.existingEditedAt ?? null;
  }
}

/**
 * Check if user has permission to enter results
 * Judges, Head Judges, and Admins can enter results
 */
async function checkEnterResultsPermission(userId: string): Promise<void> {
  const userRoles = await getUserRoles(userId);
  const hasPermission = userRoles.includes('admin') || 
                       userRoles.includes('judge') || 
                       userRoles.includes('head_judge');
  
  if (!hasPermission) {
    throw new Error('Not authorized to enter results. Only judges, head judges, and admins can enter results.');
  }
}

/**
 * Check if user has permission to edit results
 * Head Judges and Admins can edit results
 */
async function checkEditResultsPermission(userId: string): Promise<void> {
  const userRoles = await getUserRoles(userId);
  const hasPermission = userRoles.includes('admin') || 
                       userRoles.includes('head_judge');
  
  if (!hasPermission) {
    throw new Error('Not authorized to edit results. Only head judges and admins can edit results.');
  }
}

/**
 * Service for managing competition results
 */
export class ResultsService {
  // =============== History ===============

  /**
   * Fetch the result edit history for a single participant, newest first.
   * Returns an empty list if the subcollection is missing.
   */
  static async getResultHistory(
    competitionId: string,
    participantId: string,
    options?: { limit?: number }
  ): Promise<Array<{
    id: string;
    routeNumber?: number;
    routeId?: string;
    action: 'create' | 'update' | 'delete' | 'remove' | string;
    previous?: any;
    next?: any;
    editedBy?: string;
    editedAt?: any;
    version?: number;
    isSelfReport?: boolean;
  }>> {
    const historyRef = collection(
      db,
      'competitions',
      competitionId,
      'results',
      participantId,
      'history'
    );
    const q = query(historyRef, orderBy('editedAt', 'desc'));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (options?.limit && items.length > options.limit) {
      return items.slice(0, options.limit);
    }
    return items;
  }

  // =============== Result Entry ===============

  /**
   * Enter or update a route result for a participant
   * @param competitionId - Competition ID
   * @param participantId - Participant ID (for self-reporting, this equals enteredBy)
   * @param routeNumber - Route number (1-30)
   * @param result - Route result data
   * @param enteredBy - User ID entering the result
   * @param isSelfReport - Whether this is a self-report (Totemtition)
   */
  static async enterRouteResult(
    competitionId: string,
    participantId: string,
    routeNumber: number,
    result: {
      routeId: string;
      completed: boolean;
      attempts: number;
      grade: string;
      // Zone/Top fields for zone_top format
      topAchieved?: boolean;
      topAttempt?: number;
      zoneAchieved?: boolean;
      zoneAttempt?: number;
      // Per-route overrides (zone_top)
      pointsTop?: number;
      pointsZone?: number;
    },
    enteredBy: string,
    isSelfReport: boolean = false,
    competition?: Competition | null,
    options?: {
      /**
       * If provided and the stored document's `version` is greater, the write
       * is rejected with a {@link ResultConflictError}. Allows judge UIs to
       * detect writes from another judge while the form was open.
       */
      expectedVersion?: number;
    }
  ): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // For self-reporting (Totemtition), check if user is entering for themselves
      if (isSelfReport) {
        if (currentUser.uid !== participantId) {
          throw new Error('Self-reporting is only allowed for your own results');
        }
      } else {
        // Standard authorization check for judges
        await checkEnterResultsPermission(currentUser.uid);
      }

      // Calculate points based on format
      let points = 0;
      const isTotemRoute = result.grade === 'TOTEM';
      const format = competition?.format;

      if (isTotemRoute) {
        // TOTEM routes: points calculated dynamically in leaderboard
        points = 0;
      } else if (format && isPointsCompetitionFormat(format) && result.completed) {
        // Points Competition: grade number = points (V0=0, V1=1 ... V8=8)
        points = calculatePointsCompetitionRoutePoints(result.grade);
      } else if (format && isZoneTopFormat(format) && competition?.settings) {
        // Zone/Top scoring
        const config = buildZoneTopScoringConfig(competition.settings);
        points = calculateZoneTopRoutePoints(
          {
            topAchieved: result.topAchieved ?? result.completed,
            topAttempt: result.topAttempt ?? (result.completed ? result.attempts : undefined),
            zoneAchieved: result.zoneAchieved ?? false,
            zoneAttempt: result.zoneAttempt,
            pointsTop: result.pointsTop ?? config.defaultPointsTop,
            pointsZone: result.pointsZone ?? config.defaultPointsZone,
          },
          config
        );
      } else if (result.completed) {
        // National league / custom: grade-based
        points = calculateRoutePoints(result.grade, result.attempts);
      }

      const routeResult: RouteResult = {
        routeNumber,
        routeId: result.routeId,
        completed: result.completed,
        attempts: result.attempts,
        points,
        enteredBy,
        enteredAt: new Date(),
        // Zone/Top fields – only include defined values (Firestore rejects undefined)
        ...(result.topAchieved !== undefined && { topAchieved: result.topAchieved }),
        ...(result.topAttempt !== undefined && { topAttempt: result.topAttempt }),
        ...(result.zoneAchieved !== undefined && { zoneAchieved: result.zoneAchieved }),
        ...(result.zoneAttempt !== undefined && { zoneAttempt: result.zoneAttempt }),
      };

      // Fetch participant (cached) – used only for denormalised fields on the
      // result doc (category/name/photo). Kept outside the transaction because
      // it reads a different collection; the TTL cache makes bursts cheap.
      const participant = await getParticipantByUserIdCached(
        competitionId,
        participantId,
      );

      // Get or create participant result document, atomically.
      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );
      const historyRef = collection(
        db,
        'competitions',
        competitionId,
        'results',
        participantId,
        'history',
      );

      const txResult = await runTransaction(db, async (transaction) => {
        const resultDoc = await transaction.get(resultRef);

        if (resultDoc.exists()) {
          const existingData: any = resultDoc.data();
          const serverVersion: number = existingData.version || 0;

          // Optimistic-locking check (judges only).
          if (
            options?.expectedVersion !== undefined &&
            serverVersion > options.expectedVersion
          ) {
            const existingRoute =
              (existingData.routes && existingData.routes[routeNumber]) || null;
            throw new ResultConflictError({
              serverVersion,
              expectedVersion: options.expectedVersion,
              existingRoute,
              existingEditedBy: existingData.lastEditedBy ?? null,
              existingEditedAt:
                existingData.lastEditedAt?.toDate?.() ?? null,
            });
          }

          const previousRoute =
            (existingData.routes && existingData.routes[routeNumber]) || null;
          const routes = { ...(existingData.routes || {}) };
          routes[routeNumber] = routeResult;

          const { totalPoints, top7Points, routesCompleted } =
            this.calculateTotals(routes);

          const updateData: any = {
            routes,
            totalPoints,
            top7Points,
            routesCompleted,
            lastUpdated: serverTimestamp(),
            lastEditedBy: enteredBy,
            lastEditedAt: serverTimestamp(),
            version: serverVersion + 1,
          };

          if (participant) {
            if (participant.category) {
              updateData.category = participant.category;
              updateData.categoryName = participant.categoryName || null;
            }
            if (
              !existingData.participantName ||
              existingData.participantName === 'Unknown'
            ) {
              const resolvedName =
                participant.name || participant.userName || 'Unknown';
              updateData.participantName = resolvedName;
              updateData.userName = resolvedName;
            }
            if (participant.photoURL) {
              updateData.photoURL = participant.photoURL;
            }
          }

          transaction.update(resultRef, updateData);

          // Append a history entry for audit. Doc id is auto-generated so we
          // use doc() with a random id then set via transaction.
          const entryRef = doc(historyRef);
          transaction.set(entryRef, {
            routeNumber,
            routeId: routeResult.routeId,
            editedBy: enteredBy,
            editedAt: serverTimestamp(),
            action: previousRoute ? 'update' : 'create',
            previous: previousRoute ?? null,
            next: routeResult,
            version: serverVersion + 1,
            isSelfReport,
          });

          return { action: 'update' as const };
        }

        // No document yet – create one with version 1.
        const routes: Record<number, RouteResult> = {
          [routeNumber]: routeResult,
        };
        const { totalPoints, top7Points, routesCompleted } =
          this.calculateTotals(routes);

        const resolvedName =
          participant?.name || participant?.userName || 'Unknown';
        const photoURL = participant?.photoURL || null;
        const category = participant?.category || null;
        const categoryName = participant?.categoryName || null;

        transaction.set(resultRef, {
          competitionId,
          participantId,
          participantName: resolvedName,
          userName: resolvedName,
          photoURL,
          category,
          categoryName,
          routes,
          totalPoints,
          top7Points,
          routesCompleted,
          lastUpdated: serverTimestamp(),
          lastEditedBy: enteredBy,
          lastEditedAt: serverTimestamp(),
          version: 1,
        });

        const entryRef = doc(historyRef);
        transaction.set(entryRef, {
          routeNumber,
          routeId: routeResult.routeId,
          editedBy: enteredBy,
          editedAt: serverTimestamp(),
          action: 'create',
          previous: null,
          next: routeResult,
          version: 1,
          isSelfReport,
        });

        return { action: 'create' as const };
      });

      console.log(
        `Result ${txResult.action}: Route ${routeNumber} for participant ${participantId}`,
      );
    } catch (error) {
      console.error('Error entering route result:', error);
      throw error;
    }
  }

  /**
   * Delete a route result
   */
  static async deleteRouteResult(
    competitionId: string,
    participantId: string,
    routeNumber: number
  ): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkEditResultsPermission(currentUser.uid);

      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );
      const historyRef = collection(
        db,
        'competitions',
        competitionId,
        'results',
        participantId,
        'history',
      );

      await runTransaction(db, async (transaction) => {
        const resultDoc = await transaction.get(resultRef);
        if (!resultDoc.exists()) return;

        const existingData: any = resultDoc.data();
        const previousRoute =
          (existingData.routes && existingData.routes[routeNumber]) || null;
        if (!previousRoute) return;

        const routes = { ...(existingData.routes || {}) };
        delete routes[routeNumber];

        const { totalPoints, top7Points, routesCompleted } =
          this.calculateTotals(routes);
        const serverVersion: number = existingData.version || 0;

        transaction.update(resultRef, {
          routes,
          totalPoints,
          top7Points,
          routesCompleted,
          lastUpdated: serverTimestamp(),
          lastEditedBy: currentUser.uid,
          lastEditedAt: serverTimestamp(),
          version: serverVersion + 1,
        });

        const entryRef = doc(historyRef);
        transaction.set(entryRef, {
          routeNumber,
          routeId: previousRoute.routeId || null,
          editedBy: currentUser.uid,
          editedAt: serverTimestamp(),
          action: 'delete',
          previous: previousRoute,
          next: null,
          version: serverVersion + 1,
          isSelfReport: false,
        });
      });

      console.log(`Result deleted: Route ${routeNumber} for participant ${participantId}`);
    } catch (error) {
      console.error('Error deleting route result:', error);
      throw error;
    }
  }

  /**
   * Remove a route result by routeId (for self-reporting undo or judge action)
   */
  static async removeRouteResult(
    competitionId: string,
    participantId: string,
    routeId: string
  ): Promise<void> {
    try {
      // Check authorization: allow self-removal (participant removing own result) or judge/admin
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      const isSelfRemoval = currentUser.uid === participantId;
      if (!isSelfRemoval) {
        await checkEditResultsPermission(currentUser.uid);
      }

      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );
      const historyRef = collection(
        db,
        'competitions',
        competitionId,
        'results',
        participantId,
        'history',
      );

      await runTransaction(db, async (transaction) => {
        const resultDoc = await transaction.get(resultRef);
        if (!resultDoc.exists()) return;

        const existingData: any = resultDoc.data();
        const routes = { ...(existingData.routes || {}) };

        // Find route by routeId and delete
        let removedKey: string | null = null;
        let previousRoute: RouteResult | null = null;
        for (const [key, value] of Object.entries(routes)) {
          if ((value as any).routeId === routeId) {
            removedKey = key;
            previousRoute = value as RouteResult;
            delete routes[key];
            break;
          }
        }
        if (!removedKey || !previousRoute) return;

        const { totalPoints, top7Points, routesCompleted } =
          this.calculateTotals(routes);
        const serverVersion: number = existingData.version || 0;

        transaction.update(resultRef, {
          routes,
          totalPoints,
          top7Points,
          routesCompleted,
          lastUpdated: serverTimestamp(),
          lastEditedBy: currentUser.uid,
          lastEditedAt: serverTimestamp(),
          version: serverVersion + 1,
        });

        const entryRef = doc(historyRef);
        transaction.set(entryRef, {
          routeNumber: Number(removedKey),
          routeId,
          editedBy: currentUser.uid,
          editedAt: serverTimestamp(),
          action: 'remove',
          previous: previousRoute,
          next: null,
          version: serverVersion + 1,
          isSelfReport: isSelfRemoval,
        });
      });

      console.log(`Result removed: Route ${routeId} for participant ${participantId}`);
    } catch (error) {
      console.error('Error removing route result:', error);
      throw error;
    }
  }

  // =============== Get Results ===============

  /**
   * Get all results for a participant
   */
  static async getParticipantResult(
    competitionId: string,
    participantId: string
  ): Promise<ParticipantResult | null> {
    try {
      const resultRef = doc(
        db,
        'competitions',
        competitionId,
        'results',
        participantId
      );

      const resultDoc = await getDoc(resultRef);
      if (!resultDoc.exists()) return null;

      return this.mapDocToResult(resultDoc);
    } catch (error) {
      console.error('Error getting participant result:', error);
      throw error;
    }
  }

  /**
   * Get all results for a competition
   */
  static async getAllResults(
    competitionId: string
  ): Promise<ParticipantResult[]> {
    try {
      const resultsRef = collection(
        db,
        'competitions',
        competitionId,
        'results'
      );

      const q = query(resultsRef, orderBy('top7Points', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc, index) => ({
        ...this.mapDocToResult(doc),
        rank: index + 1,
      }));
    } catch (error) {
      console.error('Error getting all results:', error);
      throw error;
    }
  }

  /**
   * Get results by category
   */
  static async getResultsByCategory(
    competitionId: string,
    category: string
  ): Promise<ParticipantResult[]> {
    try {
      const resultsRef = collection(
        db,
        'competitions',
        competitionId,
        'results'
      );

      const q = query(
        resultsRef,
        where('category', '==', category),
        orderBy('top7Points', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc, index) => ({
        ...this.mapDocToResult(doc),
        categoryRank: index + 1,
      }));
    } catch (error) {
      console.error('Error getting results by category:', error);
      throw error;
    }
  }

  // =============== Leaderboard ===============

  /**
   * Get leaderboard entries
   */
  static async getLeaderboard(
    competitionId: string,
    category?: string,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    try {
      const results = category
        ? await this.getResultsByCategory(competitionId, category)
        : await this.getAllResults(competitionId);

      return results.slice(0, limit).map((result, index) => ({
        rank: category ? result.categoryRank || index + 1 : result.rank || index + 1,
        participantId: result.participantId,
        participantName: result.participantName,
        userId: undefined, // Would need to join with participants
        points: result.top7Points,
        routesCompleted: result.routesCompleted,
        category: result.category,
        categoryName: result.categoryName,
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard entries for all categories
   * Returns a map of category ID -> leaderboard entries
   */
  static async getLeaderboardByCategories(
    competitionId: string,
    categories: { id: string; name: string }[],
    limit: number = 50
  ): Promise<Record<string, LeaderboardEntry[]>> {
    try {
      const result: Record<string, LeaderboardEntry[]> = {};
      
      // Get leaderboard for each category
      for (const category of categories) {
        const categoryLeaderboard = await this.getLeaderboard(
          competitionId,
          category.id,
          limit
        );
        result[category.id] = categoryLeaderboard;
      }
      
      return result;
    } catch (error) {
      console.error('Error getting leaderboard by categories:', error);
      throw error;
    }
  }

  /**
   * Subscribe to leaderboard updates
   */
  static subscribeToLeaderboard(
    competitionId: string,
    callback: (entries: LeaderboardEntry[]) => void,
    category?: string
  ): () => void {
    const emit = coalesce(callback);
    const resultsRef = collection(
      db,
      'competitions',
      competitionId,
      'results'
    );

    let q;
    if (category) {
      q = query(
        resultsRef,
        where('category', '==', category),
        orderBy('top7Points', 'desc')
      );
    } else {
      q = query(resultsRef, orderBy('top7Points', 'desc'));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const entries: LeaderboardEntry[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          
          // Calculate total attempts from all routes
          let totalAttempts = 0;
          if (data.routes && typeof data.routes === 'object') {
            Object.values(data.routes).forEach((route: any) => {
              if (route && typeof route.attempts === 'number') {
                totalAttempts += route.attempts;
              }
            });
          }
          
          return {
            rank: 0, // Will be calculated with tie handling
            participantId: doc.id,
            participantName: data.participantName || data.userName || 'Unknown',
            userName: data.userName || data.participantName || 'Unknown',
            userId: data.participantId || doc.id,
            photoURL: data.photoURL || null,
            points: data.top7Points || 0,
            totalPoints: data.top7Points || 0,
            routesCompleted: data.routesCompleted || 0,
            totalAttempts,
            category: data.category,
            categoryName: data.categoryName,
          };
        });
        
        // Calculate ranks with tie handling
        // If players have the same points, they share the same rank
        // Next rank skips to the correct position (e.g., 1,1,1,4 not 1,1,1,2)
        entries.sort((a, b) => (b.points || 0) - (a.points || 0));
        let currentRank = 1;
        for (let i = 0; i < entries.length; i++) {
          if (i === 0) {
            entries[i].rank = currentRank;
          } else if ((entries[i].points || 0) === (entries[i - 1].points || 0)) {
            // Same points as previous - same rank (tie)
            entries[i].rank = entries[i - 1].rank;
          } else {
            // Different points - rank is position + 1 (to account for ties)
            entries[i].rank = i + 1;
          }
        }

        emit(entries);
      },
      (error) => {
        console.error('Error subscribing to leaderboard:', error);
        emit([]);
      }
    );
  }

  /**
   * Subscribe to a participant's results
   */
  static subscribeToParticipantResult(
    competitionId: string,
    participantId: string,
    callback: (result: ParticipantResult | null) => void
  ): () => void {
    const resultRef = doc(
      db,
      'competitions',
      competitionId,
      'results',
      participantId
    );

    return onSnapshot(
      resultRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(this.mapDocToResult(snapshot));
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error subscribing to participant result:', error);
        callback(null);
      }
    );
  }

  // =============== Batch Operations ===============

  /**
   * Fix missing participant names in existing results
   * This method looks up participants by userId since result doc IDs are userIds
   */
  static async fixMissingParticipantNames(competitionId: string): Promise<number> {
    try {
      const resultsRef = collection(
        db,
        'competitions',
        competitionId,
        'results'
      );
      const participantsRef = collection(
        db,
        'competitions',
        competitionId,
        'participants'
      );

      // Get all participants and build a map by userId (not doc.id)
      const participantsSnapshot = await getDocs(participantsRef);
      const participantsByUserId = new Map<string, { name?: string; userName?: string; photoURL?: string }>();
      participantsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.userId) {
          participantsByUserId.set(data.userId, {
            name: data.name,
            userName: data.userName,
            photoURL: data.photoURL,
          });
        }
      });

      // Get all results
      const resultsSnapshot = await getDocs(resultsRef);
      const batch = writeBatch(db);
      let fixedCount = 0;

      resultsSnapshot.docs.forEach((resultDoc) => {
        const data = resultDoc.data();
        const userId = resultDoc.id; // Result doc ID is the userId
        const participant = participantsByUserId.get(userId);

        // Check if name is missing or "Unknown"
        if (
          (!data.participantName || data.participantName === 'Unknown') &&
          participant
        ) {
          const name = participant.name || participant.userName || 'Unknown';
          batch.update(resultDoc.ref, {
            participantName: name,
            userName: participant.userName || participant.name,
            photoURL: participant.photoURL || null,
          });
          fixedCount++;
        }
      });

      if (fixedCount > 0) {
        await batch.commit();
        console.log(`Fixed ${fixedCount} missing participant names`);
      }

      return fixedCount;
    } catch (error) {
      console.error('Error fixing missing participant names:', error);
      throw error;
    }
  }

  /**
   * Recalculate all rankings for a competition
   */
  static async recalculateRankings(competitionId: string): Promise<void> {
    try {
      const results = await this.getAllResults(competitionId);
      const batch = writeBatch(db);

      // Overall rankings
      results.forEach((result, index) => {
        const resultRef = doc(
          db,
          'competitions',
          competitionId,
          'results',
          result.participantId
        );
        batch.update(resultRef, { rank: index + 1 });
      });

      // Category rankings
      const categories = [...new Set(results.map(r => r.category).filter(Boolean))];
      
      for (const category of categories) {
        const categoryResults = results
          .filter(r => r.category === category)
          .sort((a, b) => b.top7Points - a.top7Points);

        categoryResults.forEach((result, index) => {
          const resultRef = doc(
            db,
            'competitions',
            competitionId,
            'results',
            result.participantId
          );
          batch.update(resultRef, { categoryRank: index + 1 });
        });
      }

      await batch.commit();
      console.log('Rankings recalculated for competition:', competitionId);
    } catch (error) {
      console.error('Error recalculating rankings:', error);
      throw error;
    }
  }

  /**
   * Clear all results for a competition
   */
  static async clearAllResults(competitionId: string): Promise<void> {
    try {
      // Check authorization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      await checkEditResultsPermission(currentUser.uid);

      const resultsRef = collection(
        db,
        'competitions',
        competitionId,
        'results'
      );

      const snapshot = await getDocs(resultsRef);
      const batch = writeBatch(db);

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('All results cleared for competition:', competitionId);
    } catch (error) {
      console.error('Error clearing results:', error);
      throw error;
    }
  }

  // =============== Helper Methods ===============

  /**
   * Calculate totals from route results
   */
  private static calculateTotals(routes: Record<number, RouteResult>): {
    totalPoints: number;
    top7Points: number;
    routesCompleted: number;
  } {
    const completedRoutes = Object.values(routes).filter(r => r.completed);
    const allPoints = completedRoutes.map(r => r.points);
    
    return {
      totalPoints: allPoints.reduce((sum, p) => sum + p, 0),
      top7Points: calculateTopNPoints(allPoints, 7),
      routesCompleted: completedRoutes.length,
    };
  }

  /**
   * Map Firestore document to ParticipantResult
   */
  private static mapDocToResult(docSnap: any): ParticipantResult {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      competitionId: data.competitionId,
      participantId: docSnap.id,
      participantName: data.participantName || data.userName || 'Unknown',
      userName: data.userName || data.participantName || 'Unknown',
      photoURL: data.photoURL || null,
      category: data.category,
      categoryName: data.categoryName,
      routes: data.routes || {},
      routesCompleted: data.routesCompleted || 0,
      totalPoints: data.totalPoints || 0,
      top7Points: data.top7Points || 0,
      rank: data.rank,
      categoryRank: data.categoryRank,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    };
  }

  // =============== Totemtition Scoring ===============

  /**
   * Calculate Totemtition leaderboard with dynamic 1000/N scoring
   * This method calculates points based on how many climbers completed each route
   * @param competitionId - Competition ID
   * @returns Leaderboard entries with Totemtition scoring
   */
  static async calculateTotemtitionLeaderboard(
    competitionId: string
  ): Promise<LeaderboardEntry[]> {
    try {
      // Get all results
      const allResults = await this.getAllResults(competitionId);
      
      if (allResults.length === 0) {
        return [];
      }

      // Step 1: Count completions per route PER CATEGORY
      // Structure: { category: { routeKey: count } }
      const categoryRouteCompletionCounts: Record<string, Record<string, number>> = {};
      
      allResults.forEach((result) => {
        const participantCategory = result.category || '__no_category__';
        if (!categoryRouteCompletionCounts[participantCategory]) {
          categoryRouteCompletionCounts[participantCategory] = {};
        }
        
        const routes = result.routes;
        if (routes) {
          const routeValues = Array.isArray(routes) ? routes : Object.values(routes);
          routeValues.forEach((route: RouteResult) => {
            if (route.completed) {
              const routeKey = route.routeId || String(route.routeNumber);
              categoryRouteCompletionCounts[participantCategory][routeKey] = 
                (categoryRouteCompletionCounts[participantCategory][routeKey] || 0) + 1;
            }
          });
        }
      });

      // Step 2: Calculate points for each participant using CATEGORY-SPECIFIC counts
      const leaderboardEntries: LeaderboardEntry[] = allResults.map((result) => {
        let totalPoints = 0;
        const routes = result.routes;
        const participantCategory = result.category || '__no_category__';
        const categoryCompletionCounts = categoryRouteCompletionCounts[participantCategory] || {};
        
        if (routes) {
          const routeValues = Array.isArray(routes) ? routes : Object.values(routes);
          routeValues.forEach((route: RouteResult) => {
            if (route.completed) {
              const routeKey = route.routeId || String(route.routeNumber);
              const completionCount = categoryCompletionCounts[routeKey] || 1;
              const points = calculateTotemtitionPoints(1000, completionCount);
              totalPoints += points;
            }
          });
        }

        return {
          participantId: result.participantId,
          participantName: result.participantName || 'Unknown',
          category: result.category,
          categoryName: result.categoryName,
          totalPoints,
          routesCompleted: result.routesCompleted || 0,
          rank: 0, // Will be calculated below
        };
      });

      // Step 3: Sort by points and assign ranks with tie handling
      leaderboardEntries.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      for (let i = 0; i < leaderboardEntries.length; i++) {
        if (i === 0) {
          leaderboardEntries[i].rank = 1;
        } else if ((leaderboardEntries[i].totalPoints || 0) === (leaderboardEntries[i - 1].totalPoints || 0)) {
          // Same points as previous - same rank (tie)
          leaderboardEntries[i].rank = leaderboardEntries[i - 1].rank;
        } else {
          // Different points - rank is position + 1 (to account for ties)
          leaderboardEntries[i].rank = i + 1;
        }
      }

      return leaderboardEntries;
    } catch (error) {
      console.error('Error calculating Totemtition leaderboard:', error);
      throw error;
    }
  }

  /**
   * Subscribe to Totemtition leaderboard with dynamic 1000/N scoring
   * Recalculates points whenever results change
   */
  static subscribeToTotemtitionLeaderboard(
    competitionId: string,
    callback: (entries: LeaderboardEntry[]) => void,
    category?: string
  ): () => void {
    const emit = coalesce(callback);
    const resultsRef = collection(
      db,
      'competitions',
      competitionId,
      'results'
    );

    // Subscribe to all results changes
    return onSnapshot(
      resultsRef,
      async (snapshot) => {
        try {
          // Step 1: Build all results from snapshot
          const allResults: ParticipantResult[] = snapshot.docs.map((doc) =>
            this.mapDocToResult(doc)
          );

          if (allResults.length === 0) {
            emit([]);
            return;
          }

          // Filter by category if needed
          const filteredResults = category
            ? allResults.filter((r) => r.category === category)
            : allResults;

          // Step 2: Count completions per route PER CATEGORY
          // For Totemtition, points are divided only among participants in the same category
          // Structure: { category: { routeKey: count } }
          const categoryRouteCompletionCounts: Record<string, Record<string, number>> = {};

          allResults.forEach((result) => {
            const participantCategory = result.category || '__no_category__';
            if (!categoryRouteCompletionCounts[participantCategory]) {
              categoryRouteCompletionCounts[participantCategory] = {};
            }
            
            const routes = result.routes;
            if (routes) {
              const routeValues = Array.isArray(routes)
                ? routes
                : Object.values(routes);
              routeValues.forEach((route: RouteResult) => {
                if (route.completed) {
                  const routeKey = route.routeId || String(route.routeNumber);
                  categoryRouteCompletionCounts[participantCategory][routeKey] =
                    (categoryRouteCompletionCounts[participantCategory][routeKey] || 0) + 1;
                }
              });
            }
          });

          // Step 3: Calculate points for each participant using CATEGORY-SPECIFIC completion counts
          const leaderboardEntries: LeaderboardEntry[] = filteredResults.map(
            (result) => {
              let totalPoints = 0;
              let totalAttempts = 0;
              const routes = result.routes;
              const participantCategory = result.category || '__no_category__';
              const categoryCompletionCounts = categoryRouteCompletionCounts[participantCategory] || {};

              if (routes) {
                const routeValues = Array.isArray(routes)
                  ? routes
                  : Object.values(routes);
                routeValues.forEach((route: RouteResult) => {
                  if (route.attempts) {
                    totalAttempts += route.attempts;
                  }
                  if (route.completed) {
                    const routeKey = route.routeId || String(route.routeNumber);
                    // Use category-specific completion count
                    const completionCount = categoryCompletionCounts[routeKey] || 1;
                    const points = calculateTotemtitionPoints(1000, completionCount);
                    totalPoints += points;
                  }
                });
              }

              return {
                rank: 0, // Will be calculated below
                participantId: result.participantId,
                participantName: result.participantName || result.userName || 'Unknown',
                userName: result.userName || result.participantName || 'Unknown',
                userId: result.participantId,
                photoURL: (result as any).photoURL || null,
                points: totalPoints,
                totalPoints,
                routesCompleted: result.routesCompleted || 0,
                totalAttempts,
                category: result.category,
                categoryName: result.categoryName,
              };
            }
          );

          // Step 4: Sort by points and assign ranks with tie handling
          // If players have the same points, they share the same rank
          // Next rank skips to the correct position (e.g., 1,1,1,4 not 1,1,1,2)
          leaderboardEntries.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
          
          for (let i = 0; i < leaderboardEntries.length; i++) {
            if (i === 0) {
              leaderboardEntries[i].rank = 1;
            } else if ((leaderboardEntries[i].totalPoints || 0) === (leaderboardEntries[i - 1].totalPoints || 0)) {
              // Same points as previous - same rank (tie)
              leaderboardEntries[i].rank = leaderboardEntries[i - 1].rank;
            } else {
              // Different points - rank is position + 1 (to account for ties)
              leaderboardEntries[i].rank = i + 1;
            }
          }

          emit(leaderboardEntries);
        } catch (error) {
          console.error('Error calculating Totemtition leaderboard:', error);
          emit([]);
        }
      },
      (error) => {
        console.error('Error subscribing to Totemtition leaderboard:', error);
        emit([]);
      }
    );
  }

  /**
   * Subscribe to Zone/Top leaderboard (IFSC Points / Custom Points)
   * Points are already calculated and stored in each route result's `points` field
   * at entry time, so this uses the pre-calculated scores.
   */
  static subscribeToZoneTopLeaderboard(
    competitionId: string,
    callback: (entries: LeaderboardEntry[]) => void,
    category?: string
  ): () => void {
    const emit = coalesce(callback);
    const resultsRef = collection(
      db,
      'competitions',
      competitionId,
      'results'
    );

    return onSnapshot(
      resultsRef,
      (snapshot) => {
        const allResults: ParticipantResult[] = snapshot.docs.map((d) =>
          this.mapDocToResult(d)
        );

        if (allResults.length === 0) {
          emit([]);
          return;
        }

        const filteredResults = category
          ? allResults.filter((r) => r.category === category)
          : allResults;

        const entries: LeaderboardEntry[] = filteredResults.map((result) => {
          let totalPoints = 0;
          let totalAttempts = 0;
          let routesCompleted = 0;
          let totalTops = 0;
          let totalZones = 0;
          let totalTopAttempts = 0;
          let totalZoneAttempts = 0;
          const routes = result.routes;

          if (routes) {
            const routeValues = Array.isArray(routes)
              ? routes
              : Object.values(routes);
            routeValues.forEach((route: RouteResult) => {
              if (route.attempts) {
                totalAttempts += route.attempts;
              }
              if (route.completed || route.topAchieved || route.zoneAchieved) {
                // Use the pre-calculated points from entry time
                totalPoints += route.points || 0;
                if (route.completed || route.topAchieved) {
                  routesCompleted++;
                }
              }
              // IFSC aggregates
              if (route.topAchieved) {
                totalTops++;
                totalTopAttempts += route.topAttempt || 1;
              }
              if (route.zoneAchieved) {
                totalZones++;
                totalZoneAttempts += route.zoneAttempt || 1;
              }
            });
          }

          // Round to 2 decimal places for display
          totalPoints = Math.round(totalPoints * 100) / 100;

          return {
            rank: 0,
            participantId: result.participantId,
            participantName: result.participantName || result.userName || 'Unknown',
            userName: result.userName || result.participantName || 'Unknown',
            userId: result.participantId,
            photoURL: (result as any).photoURL || null,
            points: totalPoints,
            totalPoints,
            routesCompleted,
            totalAttempts,
            category: result.category,
            categoryName: result.categoryName,
            totalTops,
            totalZones,
            totalTopAttempts,
            totalZoneAttempts,
          };
        });

        // Sort and assign ranks with tie handling
        entries.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        for (let i = 0; i < entries.length; i++) {
          if (i === 0) {
            entries[i].rank = 1;
          } else if ((entries[i].totalPoints || 0) === (entries[i - 1].totalPoints || 0)) {
            entries[i].rank = entries[i - 1].rank;
          } else {
            entries[i].rank = i + 1;
          }
        }

        emit(entries);
      },
      (error) => {
        console.error('Error subscribing to Zone/Top leaderboard:', error);
        emit([]);
      }
    );
  }

  // =============== Points Competition ===============

  /**
   * Subscribe to Points Competition leaderboard
   * Points are pre-calculated at entry time (grade number = points: V0=0, V8=8)
   * Uses totalPoints (sum of all completed routes), no TOP-N.
   */
  static subscribeToPointsCompetitionLeaderboard(
    competitionId: string,
    callback: (entries: LeaderboardEntry[]) => void
  ): () => void {
    const emit = coalesce(callback);
    const resultsRef = collection(
      db,
      'competitions',
      competitionId,
      'results'
    );

    return onSnapshot(
      resultsRef,
      (snapshot) => {
        const allResults: ParticipantResult[] = snapshot.docs.map((d) =>
          this.mapDocToResult(d)
        );

        if (allResults.length === 0) {
          emit([]);
          return;
        }

        const entries: LeaderboardEntry[] = allResults.map((result) => {
          let totalPoints = 0;
          let totalAttempts = 0;
          let routesCompleted = 0;
          const routes = result.routes;

          if (routes) {
            const routeValues = Array.isArray(routes) ? routes : Object.values(routes);
            routeValues.forEach((route: RouteResult) => {
              if (route.attempts) {
                totalAttempts += route.attempts;
              }
              if (route.completed) {
                totalPoints += route.points || 0;
                routesCompleted++;
              }
            });
          }

          return {
            rank: 0,
            participantId: result.participantId,
            participantName: result.participantName || result.userName || 'Unknown',
            userName: result.userName || result.participantName || 'Unknown',
            userId: result.participantId,
            photoURL: (result as any).photoURL || null,
            points: totalPoints,
            totalPoints,
            routesCompleted,
            totalAttempts,
            category: result.category,
            categoryName: result.categoryName,
          };
        });

        // Sort by totalPoints desc, then by routesCompleted desc for tie-breaking
        entries.sort((a, b) => {
          const pointsDiff = (b.totalPoints || 0) - (a.totalPoints || 0);
          if (pointsDiff !== 0) return pointsDiff;
          return (b.routesCompleted || 0) - (a.routesCompleted || 0);
        });

        // Rank with tie handling
        for (let i = 0; i < entries.length; i++) {
          if (i === 0) {
            entries[i].rank = 1;
          } else if ((entries[i].totalPoints || 0) === (entries[i - 1].totalPoints || 0)) {
            entries[i].rank = entries[i - 1].rank;
          } else {
            entries[i].rank = i + 1;
          }
        }

        emit(entries);
      },
      (error) => {
        console.error('Error subscribing to Points Competition leaderboard:', error);
        emit([]);
      }
    );
  }

  /**
   * Subscribe to route completion counts for Totemtition (category-based)
   * Returns a map of { category: { routeId: count } }
   * Also includes a '__global__' key for overall counts (for backward compatibility)
   */
  static subscribeToRouteCompletionCountsByCategory(
    competitionId: string,
    callback: (counts: Record<string, Record<string, number>>) => void
  ): () => void {
    const resultsRef = collection(
      db,
      'competitions',
      competitionId,
      'results'
    );

    return onSnapshot(
      resultsRef,
      (snapshot) => {
        const categoryRouteCounts: Record<string, Record<string, number>> = {
          '__global__': {}, // For backward compatibility
        };

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const category = data.category || '__no_category__';
          const routes = data.routes;
          
          if (!categoryRouteCounts[category]) {
            categoryRouteCounts[category] = {};
          }
          
          if (routes && typeof routes === 'object') {
            Object.values(routes).forEach((route: any) => {
              if (route && route.completed) {
                const routeKey = route.routeId || String(route.routeNumber);
                // Count per category
                categoryRouteCounts[category][routeKey] = (categoryRouteCounts[category][routeKey] || 0) + 1;
                // Also count globally
                categoryRouteCounts['__global__'][routeKey] = (categoryRouteCounts['__global__'][routeKey] || 0) + 1;
              }
            });
          }
        });

        callback(categoryRouteCounts);
      },
      (error) => {
        console.error('Error subscribing to route completion counts by category:', error);
        callback({});
      }
    );
  }

  /**
   * Subscribe to route completion counts for Totemtition
   * Returns a map of routeId/routeNumber -> completion count
   * @deprecated Use subscribeToRouteCompletionCountsByCategory for category-based scoring
   */
  static subscribeToRouteCompletionCounts(
    competitionId: string,
    callback: (counts: Record<string, number>) => void
  ): () => void {
    const resultsRef = collection(
      db,
      'competitions',
      competitionId,
      'results'
    );

    return onSnapshot(
      resultsRef,
      (snapshot) => {
        const counts: Record<string, number> = {};

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const routes = data.routes;
          
          if (routes && typeof routes === 'object') {
            Object.values(routes).forEach((route: any) => {
              if (route && route.completed) {
                const routeKey = route.routeId || String(route.routeNumber);
                counts[routeKey] = (counts[routeKey] || 0) + 1;
              }
            });
          }
        });

        callback(counts);
      },
      (error) => {
        console.error('Error subscribing to route completion counts:', error);
        callback({});
      }
    );
  }

  // =============== Category Sync Utilities ===============

  /**
   * Sync categories for all results in a competition from their participant records
   * Use this to fix existing results that are missing category data
   * @param competitionId - Competition ID
   * @returns Number of results updated
   */
  static async syncResultCategories(competitionId: string): Promise<number> {
    try {
      const resultsRef = collection(db, 'competitions', competitionId, 'results');
      const snapshot = await getDocs(resultsRef);
      
      let updatedCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const participantId = docSnap.id;
        
        // Get participant data to fetch current category
        const participant = await ParticipantService.getParticipantByUserId(competitionId, participantId);
        
        if (participant && participant.category) {
          // Check if category needs to be updated
          if (data.category !== participant.category) {
            await updateDoc(doc(db, 'competitions', competitionId, 'results', participantId), {
              category: participant.category,
              categoryName: participant.categoryName || null,
            });
            updatedCount++;
            console.log(`[syncResultCategories] Updated category for ${participantId}: ${data.category} -> ${participant.category}`);
          }
        }
      }
      
      console.log(`[syncResultCategories] Synced ${updatedCount} results in competition ${competitionId}`);
      return updatedCount;
    } catch (error) {
      console.error('Error syncing result categories:', error);
      throw error;
    }
  }

  /**
   * Get results that are missing category data
   * @param competitionId - Competition ID
   * @returns Array of participant IDs with missing categories
   */
  static async getResultsWithMissingCategories(competitionId: string): Promise<string[]> {
    try {
      const resultsRef = collection(db, 'competitions', competitionId, 'results');
      const snapshot = await getDocs(resultsRef);
      
      const missingCategories: string[] = [];
      
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.category) {
          missingCategories.push(docSnap.id);
        }
      });
      
      return missingCategories;
    } catch (error) {
      console.error('Error getting results with missing categories:', error);
      throw error;
    }
  }
}
