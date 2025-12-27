/**
 * @fileoverview Unified API/Services Index
 * @description Single entry point for all data operations following TopLogger's clean API structure
 * 
 * TopLogger API Endpoints mapped to our services:
 * - GET /v1/gyms.json → WallsService.getWalls()
 * - GET /v1/gyms/{id}/climbs.json → RoutesService.subscribeRoutes()
 * - GET /v1/gyms/{id}/ranked_users.json → RankingsService.getGymRankings()
 * - POST /v1/climbs/{id}/log → FeedbackService.submitFeedback()
 * - GET /v1/users/{id}/ascents → UserStatsService.getUserStats()
 */

// ============================================
// Core Services
// ============================================

export { RoutesService } from '@/features/routes-map/services/RoutesService';
export { FeedbackService } from '@/features/routes-map/services/FeedbackService';
export { RouteStatsService } from '@/features/routes-map/services/RouteStatsService';
export { UserStatsService } from '@/features/routes-map/services/UserStatsService';
export { RankingsService } from '@/features/routes-map/services/RankingsService';

// ============================================
// API Client (for future REST migration)
// ============================================

export { apiClient, ApiClient } from './ApiClient';
export type { ApiConfig, ApiRequest, ApiResponse } from './ApiClient';

// ============================================
// Data Models
// ============================================

export * from '@/types/models';

// ============================================
// State Stores (Zustand)
// ============================================

export {
    useRoutesStore,
    useRoutes,
    useSelectedRoute,
    useRoutesLoading,
    useRoutesSyncing,
    useRoutesError,
    useLastSyncAt,
    usePendingOperations,
    useRoutesActions,
} from '@/store/routesStore';

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
    useUserActions,
} from '@/store/userStore';

export {
    useFiltersStore,
} from '@/store/useFiltersStore';

// ============================================
// Firebase Hooks (Real-time subscriptions)
// ============================================

export { useFirebaseRoutes, useActiveRoutes } from '@/features/routes-map/hooks/useFirebaseRoutes';

// ============================================
// Convenience API Functions
// Following TopLogger's endpoint pattern
// ============================================

import { RoutesService } from '@/features/routes-map/services/RoutesService';
import { FeedbackService } from '@/features/routes-map/services/FeedbackService';
import { RankingsService } from '@/features/routes-map/services/RankingsService';
import { UserStatsService } from '@/features/routes-map/services/UserStatsService';
import type { RouteDoc } from '@/features/routes-map/types/route';
import type { RankedUser, GymRankings, RankingType, ClimbsType } from '@/types/models';

/**
 * Unified API interface following TopLogger patterns
 * Use this for simple operations; use stores for reactive state
 */
export const api = {
    // Routes (equivalent to /v1/gyms/{id}/climbs)
    routes: {
        subscribe: RoutesService.subscribeRoutes.bind(RoutesService),
        subscribeActive: RoutesService.subscribeActiveRoutes.bind(RoutesService),
        add: RoutesService.addRoute.bind(RoutesService),
        update: RoutesService.updateRoute.bind(RoutesService),
        delete: RoutesService.deleteRoute.bind(RoutesService),
        archive: RoutesService.archiveRoute.bind(RoutesService),
        restore: RoutesService.restoreRoute.bind(RoutesService),
        getDisplayGrade: RoutesService.getDisplayGrade.bind(RoutesService),
        getDisplayRating: RoutesService.getDisplayStarRating.bind(RoutesService),
        getCompletionCount: RoutesService.getCompletionCount.bind(RoutesService),
    },

    // Feedback (equivalent to /v1/climbs/{id}/log)
    feedback: {
        add: FeedbackService.addFeedbackToRoute.bind(FeedbackService),
        subscribe: FeedbackService.subscribeFeedbacksForRoute.bind(FeedbackService),
        getUserFeedback: FeedbackService.getUserFeedbackForRoute.bind(FeedbackService),
        delete: FeedbackService.deleteFeedback.bind(FeedbackService),
        update: FeedbackService.updateFeedback.bind(FeedbackService),
    },

    // Rankings (equivalent to /v1/gyms/{id}/ranked_users)
    rankings: {
        byGrade: RankingsService.getRankedUsersByGrade.bind(RankingsService),
        byVolume: RankingsService.getRankedUsersByVolume.bind(RankingsService),
        byPoints: RankingsService.getRankedUsersByPoints.bind(RankingsService),
        getUserRank: RankingsService.getUserRank.bind(RankingsService),
        getGymRankings: RankingsService.getGymRankings.bind(RankingsService),
        getUserGradeDistribution: RankingsService.getUserGradeDistribution.bind(RankingsService),
    },

    // User Stats (equivalent to /v1/users/{id}/stats)
    userStats: {
        get: UserStatsService.getUserStats.bind(UserStatsService),
        update: UserStatsService.updateUserStats.bind(UserStatsService),
        reset: UserStatsService.resetUserStats.bind(UserStatsService),
    },
};

// ============================================
// Type Exports for API
// ============================================

export type { RouteDoc } from '@/features/routes-map/types/route';
export type { RouteFilters, RouteSortBy, MapTransforms } from '@/features/routes-map/types/route';
