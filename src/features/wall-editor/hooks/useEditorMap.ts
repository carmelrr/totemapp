// useEditorMap - Hook for using editor-built maps with existing viewport logic

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Room, EditorRoute, Point } from '../types';
import { subscribeToRooms, getRoom } from '../services/editorService';
import { useAuth } from '@/context/AuthContext';

interface ViewportBounds {
  leftN: number;
  rightN: number;
  topN: number;
  bottomN: number;
}

interface UseEditorMapOptions {
  /** Room ID to load */
  roomId?: string;
  /** Current viewport bounds (normalized 0-1) */
  viewportBounds?: ViewportBounds;
  /** Whether to filter routes by viewport */
  filterByViewport?: boolean;
}

interface UseEditorMapResult {
  /** The loaded room */
  room: Room | null;
  /** All routes in the room */
  routes: EditorRoute[];
  /** Routes visible in current viewport */
  visibleRoutes: EditorRoute[];
  /** Room dimensions */
  dimensions: { width: number; height: number };
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Reload room data */
  reload: () => Promise<void>;
  /** Convert normalized coordinates to room coordinates */
  normalizedToRoom: (xN: number, yN: number) => Point;
  /** Convert room coordinates to normalized coordinates */
  roomToNormalized: (x: number, y: number) => { xN: number; yN: number };
}

/**
 * Hook for using editor-built maps with viewport filtering
 * 
 * This integrates with the existing viewport-based route filtering logic
 * to support the same behavior as the legacy SVG-based maps.
 */
export function useEditorMap({
  roomId,
  viewportBounds,
  filterByViewport = true,
}: UseEditorMapOptions): UseEditorMapResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Load room data
  const loadRoom = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedRoom = await getRoom(roomId);
      setRoom(loadedRoom);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load room'));
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);
  
  // Initial load
  useEffect(() => {
    loadRoom();
  }, [loadRoom]);
  
  // Room dimensions
  const dimensions = useMemo(() => ({
    width: room?.width || 0,
    height: room?.height || 0,
  }), [room]);
  
  // All routes
  const routes = useMemo(() => (room as any)?.routes || [], [room]);
  
  // Filter routes by viewport bounds
  const visibleRoutes = useMemo(() => {
    if (!filterByViewport || !viewportBounds || routes.length === 0) {
      return routes;
    }
    
    return routes.filter(route => {
      // Check if any point of the route is within viewport
      return route.points.some(point => {
        // Route points are stored in room coordinates
        // Convert to normalized for comparison with viewport
        const xN = room ? point.x / room.width : 0;
        const yN = room ? point.y / room.height : 0;
        
        return (
          xN >= viewportBounds.leftN &&
          xN <= viewportBounds.rightN &&
          yN >= viewportBounds.topN &&
          yN <= viewportBounds.bottomN
        );
      });
    });
  }, [routes, viewportBounds, filterByViewport, room]);
  
  // Coordinate conversion utilities
  const normalizedToRoom = useCallback((xN: number, yN: number): Point => {
    return {
      x: xN * (room?.width || 0),
      y: yN * (room?.height || 0),
    };
  }, [room]);
  
  const roomToNormalized = useCallback((x: number, y: number) => {
    return {
      xN: room?.width ? x / room.width : 0,
      yN: room?.height ? y / room.height : 0,
    };
  }, [room]);
  
  return {
    room,
    routes,
    visibleRoutes,
    dimensions,
    isLoading,
    error,
    reload: loadRoom,
    normalizedToRoom,
    roomToNormalized,
  };
}

/**
 * Hook for managing multiple rooms (for admin)
 */
export function useEditorRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!user) {
      setRooms([]);
      setIsLoading(false);
      return;
    }
    
    // Subscribe to rooms created by this user
    const unsubscribe = subscribeToRooms(
      (loadedRooms) => {
        setRooms(loadedRooms);
        setIsLoading(false);
      },
      user.uid // Filter by current user
    );
    
    return unsubscribe;
  }, [user]);
  
  return {
    rooms,
    isLoading,
    error,
  };
}

/**
 * Convert legacy SVG-based route to editor route format
 * 
 * This helps migrate existing routes to the new format.
 */
export function convertLegacyRoute(
  legacyRoute: {
    id: string;
    name: string;
    color: string;
    grade?: string;
    x?: number;
    y?: number;
    xNorm?: number;
    yNorm?: number;
  },
  roomWidth: number,
  roomHeight: number
): EditorRoute {
  // Determine coordinates
  let x: number, y: number;
  
  if (typeof legacyRoute.xNorm === 'number' && typeof legacyRoute.yNorm === 'number') {
    // Use normalized coordinates
    x = legacyRoute.xNorm * roomWidth;
    y = legacyRoute.yNorm * roomHeight;
  } else if (typeof legacyRoute.x === 'number' && typeof legacyRoute.y === 'number') {
    // Use pixel coordinates (assuming they're for the legacy 2560x1600 viewbox)
    x = (legacyRoute.x / 2560) * roomWidth;
    y = (legacyRoute.y / 1600) * roomHeight;
  } else {
    // Default to center
    x = roomWidth / 2;
    y = roomHeight / 2;
  }
  
  return {
    id: legacyRoute.id,
    name: legacyRoute.name,
    color: legacyRoute.color,
    grade: legacyRoute.grade || 'V0',
    points: [
      {
        id: `${legacyRoute.id}_point_1`,
        x,
        y,
        type: 'hold',
        order: 0,
      },
    ],
    createdAt: new Date(),
    createdBy: '',
  };
}
