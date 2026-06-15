/**
 * @fileoverview Leaderboard store — cached, stale-while-revalidate wall rankings
 * @description Computes the wall leaderboard once and caches it (in-memory + AsyncStorage),
 * replacing the previous pattern in LeaderboardScreenV2 that re-scanned the full
 * `routes` / `routeFeedbacks` / `users` collections on every mount AND on every change to
 * any user document. Cached data renders instantly; revalidation happens in the background,
 * TTL-guarded so focus/remount don't recompute needlessly.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { getCachedRoutes } from '@/features/routes-map/services/RoutesService';
import { prefetchAvatarImages } from '@/components/ui/CachedAvatar';

// 'all' = all time (incl. archived routes); 'onWall' = only routes currently on the wall.
export type LeaderboardTimeFilter = 'onWall' | 'all';

export interface LeaderboardUser {
  id: string;
  displayName: string;
  photoURL: string | null;
  points: number;
  allTimePoints: number; // tiebreaker when points are equal
  routeCount?: number;
  rank?: number;
}

// Points per grade: V0/V1 = 1, V2 = 2, ... (matches the previous in-screen mapping).
const GRADE_POINTS: Record<string, number> = {
  VB: 1, V0: 1, V1: 1, V2: 2, V3: 3, V4: 4, V5: 5, V6: 6, V7: 7, V8: 8,
  V9: 9, V10: 10, V11: 11, V12: 12, V13: 13, V14: 14, V15: 15, V16: 16, V17: 17,
};

/** Parse a V-grade string to its points value (e.g. "V5" -> 5, "V0/1" -> 1). */
export const parseGradeToPoints = (grade: string | undefined | null): number => {
  if (!grade) return 0;
  if (GRADE_POINTS[grade] !== undefined) return GRADE_POINTS[grade];
  if (grade === 'V0/1' || grade === 'V0-1') return 1;
  const match = grade.match(/^V(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num <= 1 ? 1 : num;
  }
  return 0;
};

const STORAGE_PREFIX = 'leaderboard:v1:';
const TTL_MS = 90_000; // don't recompute within 90s of the last successful refresh
const FILTERS: LeaderboardTimeFilter[] = ['onWall', 'all'];

interface CachedSnapshot {
  users: LeaderboardUser[];
  computedAt: number;
}

interface LeaderboardState {
  usersByFilter: Record<LeaderboardTimeFilter, LeaderboardUser[]>;
  computedAt: Record<LeaderboardTimeFilter, number>;
  loading: boolean;
  hydrated: boolean;
  inFlight: Partial<Record<LeaderboardTimeFilter, Promise<void>>>;

  /** Load the last persisted snapshots from AsyncStorage (once per app run). */
  hydrate: () => Promise<void>;
  /** Recompute only if the cached data for `filter` is older than the TTL (or missing). */
  ensureFresh: (filter: LeaderboardTimeFilter, fallbackName: string) => Promise<void>;
  /** Force a recompute for `filter` regardless of TTL (pull-to-refresh). */
  refresh: (filter: LeaderboardTimeFilter, fallbackName: string) => Promise<void>;
}

const EMPTY: LeaderboardUser[] = [];

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  usersByFilter: { onWall: EMPTY, all: EMPTY },
  computedAt: { onWall: 0, all: 0 },
  loading: false,
  hydrated: false,
  inFlight: {},

  hydrate: async () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    try {
      const entries = await AsyncStorage.multiGet(FILTERS.map((f) => STORAGE_PREFIX + f));
      const usersByFilter = { ...get().usersByFilter };
      const computedAt = { ...get().computedAt };
      entries.forEach(([key, val]) => {
        if (!val) return;
        const filter = key.replace(STORAGE_PREFIX, '') as LeaderboardTimeFilter;
        try {
          const snap = JSON.parse(val) as CachedSnapshot;
          if (snap?.users?.length) {
            usersByFilter[filter] = snap.users;
            computedAt[filter] = snap.computedAt;
          }
        } catch {
          // ignore corrupt cache entry
        }
      });
      set({ usersByFilter, computedAt });
    } catch {
      // AsyncStorage unavailable — fall back to live compute
    }
  },

  ensureFresh: async (filter, fallbackName) => {
    const { computedAt, usersByFilter } = get();
    const isFresh = Date.now() - (computedAt[filter] || 0) < TTL_MS;
    if (isFresh && usersByFilter[filter].length > 0) return;
    return get().refresh(filter, fallbackName);
  },

  refresh: (filter, fallbackName) => {
    const existing = get().inFlight[filter];
    if (existing) return existing;

    const run = (async () => {
      set({ loading: true });
      try {
        const onlyActiveRoutes = filter === 'onWall';

        // Routes (cached, 30s TTL) — grade lookup + which routes are currently on the wall.
        const routes = await getCachedRoutes();
        const gradeByRouteId = new Map<string, string>();
        const activeRouteIds = new Set<string>();
        routes.forEach((r) => {
          gradeByRouteId.set(r.id, r.grade);
          if (!r.status || r.status === 'active') activeRouteIds.add(r.id);
        });

        // Aggregate completed feedbacks into per-user points.
        const feedbacksSnap = await getDocs(collection(db, 'routeFeedbacks'));
        const statsByUser = new Map<
          string,
          { points: number; allTimePoints: number; routeCount: number; seen: Set<string> }
        >();
        feedbacksSnap.forEach((fbDoc) => {
          const fb = fbDoc.data();
          const userId = fb.userId;
          if (!userId) return;
          const isCompleted = fb.closedRoute === true || fb.isCompleted === true;
          if (!isCompleted) return;

          if (!statsByUser.has(userId)) {
            statsByUser.set(userId, { points: 0, allTimePoints: 0, routeCount: 0, seen: new Set() });
          }
          const stats = statsByUser.get(userId)!;
          const uniqueId = `main_${fbDoc.id}`;
          if (stats.seen.has(uniqueId)) return;
          stats.seen.add(uniqueId);

          const points = parseGradeToPoints(gradeByRouteId.get(fb.routeId) || 'V0');
          stats.allTimePoints += points;
          if (!onlyActiveRoutes || activeRouteIds.has(fb.routeId)) {
            stats.points += points;
            stats.routeCount++;
          }
        });

        // Merge with user profiles.
        const usersSnap = await getDocs(collection(db, 'users'));
        const users: LeaderboardUser[] = [];
        usersSnap.forEach((userDoc) => {
          const data = userDoc.data();
          const stats = statsByUser.get(userDoc.id) || { points: 0, allTimePoints: 0, routeCount: 0 };
          users.push({
            id: userDoc.id,
            displayName: data.displayName || fallbackName,
            photoURL: data.photoURL || null,
            points: stats.points,
            allTimePoints: stats.allTimePoints,
            routeCount: stats.routeCount,
          });
        });

        users.sort((a, b) =>
          b.points !== a.points ? b.points - a.points : b.allTimePoints - a.allTimePoints,
        );

        const computedAt = Date.now();
        set((state) => ({
          usersByFilter: { ...state.usersByFilter, [filter]: users },
          computedAt: { ...state.computedAt, [filter]: computedAt },
          loading: false,
        }));

        prefetchAvatarImages(users.slice(0, 15).map((u) => u.photoURL));
        AsyncStorage.setItem(
          STORAGE_PREFIX + filter,
          JSON.stringify({ users, computedAt } as CachedSnapshot),
        ).catch(() => {});
      } catch (error) {
        console.error('[leaderboardStore] refresh failed:', error);
        set({ loading: false });
      } finally {
        set((state) => ({ inFlight: { ...state.inFlight, [filter]: undefined } }));
      }
    })();

    set((state) => ({ inFlight: { ...state.inFlight, [filter]: run } }));
    return run;
  },
}));

// Selectors
export const useLeaderboardUsers = (filter: LeaderboardTimeFilter) =>
  useLeaderboardStore((s) => s.usersByFilter[filter]);
export const useLeaderboardLoading = () => useLeaderboardStore((s) => s.loading);
/** Epoch ms of the last successful compute for `filter`, or 0 if never computed. */
export const useLeaderboardComputedAt = (filter: LeaderboardTimeFilter) =>
  useLeaderboardStore((s) => s.computedAt[filter]);

// Stable actions object — never changes, so it won't trigger re-renders.
const leaderboardActions = {
  hydrate: () => useLeaderboardStore.getState().hydrate(),
  ensureFresh: (filter: LeaderboardTimeFilter, fallbackName: string) =>
    useLeaderboardStore.getState().ensureFresh(filter, fallbackName),
  refresh: (filter: LeaderboardTimeFilter, fallbackName: string) =>
    useLeaderboardStore.getState().refresh(filter, fallbackName),
};
export const useLeaderboardActions = () => leaderboardActions;
