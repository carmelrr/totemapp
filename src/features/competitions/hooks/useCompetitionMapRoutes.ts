/**
 * @fileoverview useCompetitionMapRoutes Hook
 * @description Hook to manage competition routes on the wall map
 * Handles route positioning, user completion status, and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { useCompetitionRoutes } from './useCompetition';
import { CompetitionRoutesService } from '../services/CompetitionRoutesService';
import { ResultsService } from '../services/ResultsService';
import { CompetitionRoute, CompetitionFormat, RouteResult } from '../types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/features/data/firebase';

interface UseCompetitionMapRoutesOptions {
  competitionId: string | null;
  userId?: string | null;
  format?: CompetitionFormat;
}

interface UseCompetitionMapRoutesResult {
  routes: CompetitionRoute[];
  loading: boolean;
  error: Error | null;
  userCompletedRoutes: string[];
  routeCompletionCounts: Record<string, number>;
  updateRoutePosition: (routeId: string, xNorm: number, yNorm: number) => Promise<void>;
  updateMultiplePositions: (positions: Array<{ routeId: string; xNorm: number; yNorm: number }>) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage competition routes on the wall map
 */
export function useCompetitionMapRoutes({
  competitionId,
  userId,
  format,
}: UseCompetitionMapRoutesOptions): UseCompetitionMapRoutesResult {
  // Get routes from base hook
  const { routes, loading, error, refresh } = useCompetitionRoutes(competitionId);
  
  // User's completed routes (for totemtition)
  const [userCompletedRoutes, setUserCompletedRoutes] = useState<string[]>([]);
  
  // Route completion counts (for totemtition display)
  const [routeCompletionCounts, setRouteCompletionCounts] = useState<Record<string, number>>({});

  // Subscribe to user's results for completed routes (totemtition)
  useEffect(() => {
    if (!competitionId || !userId || format !== 'totemtition') {
      setUserCompletedRoutes([]);
      return;
    }

    const resultsRef = doc(db, 'competitions', competitionId, 'results', userId);
    
    const unsubscribe = onSnapshot(
      resultsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const routesData = data.routes;
          
          if (routesData) {
            const routeValues: RouteResult[] = Array.isArray(routesData) 
              ? routesData 
              : Object.values(routesData);
            
            const completedIds = routeValues
              .filter(r => r.completed)
              .map(r => r.routeId || String(r.routeNumber))
              .filter(Boolean) as string[];
            
            setUserCompletedRoutes(completedIds);
          } else {
            setUserCompletedRoutes([]);
          }
        } else {
          setUserCompletedRoutes([]);
        }
      },
      (error) => {
        console.error('Error subscribing to user results:', error);
        setUserCompletedRoutes([]);
      }
    );

    return () => unsubscribe();
  }, [competitionId, userId, format]);

  // Subscribe to route completion counts (for totemtition)
  useEffect(() => {
    if (!competitionId || format !== 'totemtition') {
      setRouteCompletionCounts({});
      return;
    }

    const unsubscribe = ResultsService.subscribeToRouteCompletionCounts(
      competitionId,
      (counts) => {
        setRouteCompletionCounts(counts);
      }
    );

    return () => unsubscribe();
  }, [competitionId, format]);

  // Update a single route's position
  const updateRoutePosition = useCallback(async (
    routeId: string, 
    xNorm: number, 
    yNorm: number
  ): Promise<void> => {
    if (!competitionId) {
      throw new Error('Competition ID is required');
    }

    // Validate normalized coordinates
    if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) {
      throw new Error('Coordinates must be normalized (0-1)');
    }

    await CompetitionRoutesService.updateRoute(competitionId, routeId, {
      xNorm,
      yNorm,
    });
  }, [competitionId]);

  // Update multiple routes' positions at once
  const updateMultiplePositions = useCallback(async (
    positions: Array<{ routeId: string; xNorm: number; yNorm: number }>
  ): Promise<void> => {
    if (!competitionId) {
      throw new Error('Competition ID is required');
    }

    await CompetitionRoutesService.updateRoutePositions(competitionId, positions);
  }, [competitionId]);

  return {
    routes,
    loading,
    error,
    userCompletedRoutes,
    routeCompletionCounts,
    updateRoutePosition,
    updateMultiplePositions,
    refresh,
  };
}

/**
 * Hook to get only routes that have positions on the map
 */
export function usePositionedCompetitionRoutes(competitionId: string | null) {
  const { routes, loading, error, refresh } = useCompetitionRoutes(competitionId);
  
  // Filter routes that have valid positions
  const positionedRoutes = routes.filter(
    route => 
      route.xNorm !== undefined && 
      route.yNorm !== undefined && 
      route.xNorm > 0 && 
      route.yNorm > 0
  );
  
  return {
    routes: positionedRoutes,
    allRoutes: routes,
    loading,
    error,
    refresh,
    hasUnpositionedRoutes: routes.length > positionedRoutes.length,
    unpositionedCount: routes.length - positionedRoutes.length,
  };
}
