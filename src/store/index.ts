/**
 * @fileoverview Unified Store Exports
 * @description Central export point for all Zustand stores
 * Following TopLogger's state management patterns with offline persistence
 */

// Filters store
export * from './useFiltersStore';
export { useFiltersStore } from './useFiltersStore';

// Routes store (with offline persistence)
export * from './routesStore';
export { 
    useRoutesStore, 
    useRoutes, 
    useSelectedRoute, 
    useRoutesLoading,
    useRoutesSyncing,
    useRoutesError, 
    useLastSyncAt,
    usePendingOperations,
    useRoutesHasHydrated,
    useRoutesActions 
} from './routesStore';

// User store (with offline persistence)
export * from './userStore';
export { 
    useUserStore, 
    useCurrentUser, 
    useUserProfile, 
    useUserLoading,
    useUserSyncing,
    useUserStats,
    useUserRanking,
    useIsAdmin,
    useLastProfileSync,
    useHasHydrated,
    useUserActions 
} from './userStore';
