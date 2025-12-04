// src/features/spraywall/hooks.ts
// Custom hooks for Spray Wall feature

import { useEffect, useState, useCallback } from "react";
import { SprayRoute, Hold } from "./types";
import {
  addRoute as addRouteService,
  getRoutesForWall,
  listenToRoutesForWall,
  deleteRoute as deleteRouteService,
} from "./routesService";
import { useWalls } from "@/features/walls/hooks";

// Re-export useWalls for convenience
export { useWalls };

/**
 * Hook to get routes for a specific wall with real-time updates
 */
export function useRoutesForWall(wallId: string | null) {
  const [routes, setRoutes] = useState<SprayRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallId) {
      setRoutes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = listenToRoutesForWall(wallId, (fetchedRoutes) => {
      setRoutes(fetchedRoutes);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [wallId]);

  return { routes, loading, error };
}

/**
 * Hook to manage adding a new route
 */
export function useAddRoute() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRoute = useCallback(
    async (payload: {
      wallId: string;
      name: string;
      grade: string;
      holds: Hold[];
      createdBy?: string | null;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const id = await addRouteService(payload);
        return id;
      } catch (e: any) {
        setError(e.message || "Failed to add route");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { addRoute, loading, error };
}

/**
 * Hook to manage hold marking state during route creation
 * @deprecated - Use local state in AddRouteScreen instead for better control
 */
export function useHoldMarker() {
  const [holds, setHolds] = useState<Hold[]>([]);

  const addHold = useCallback((x: number, y: number, type: Hold['type'] = 'middle', color: string = '#4488FF') => {
    const newHold: Hold = {
      id: `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      radius: 0.05,
      type,
      color,
    };
    setHolds((prev) => [...prev, newHold]);
    return newHold;
  }, []);

  const removeHold = useCallback((holdId: string) => {
    setHolds((prev) => prev.filter((h) => h.id !== holdId));
  }, []);

  const clearHolds = useCallback(() => {
    setHolds([]);
  }, []);

  const removeLastHold = useCallback(() => {
    setHolds((prev) => prev.slice(0, -1));
  }, []);

  return {
    holds,
    addHold,
    removeHold,
    clearHolds,
    removeLastHold,
    setHolds,
  };
}

/**
 * Hook to delete a route
 */
export function useDeleteRoute() {
  const [loading, setLoading] = useState(false);

  const deleteRoute = useCallback(async (routeId: string) => {
    setLoading(true);
    try {
      await deleteRouteService(routeId);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteRoute, loading };
}
