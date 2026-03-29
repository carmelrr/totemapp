// Hook to fetch and subscribe to published rooms

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/features/data/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { Room } from '../types';

const ROOMS_COLLECTION = 'editor_rooms';

interface UsePublishedRoomsOptions {
  /** Include rooms that are hidden from users (admin only) */
  includeHidden?: boolean;
  /** Only fetch rooms from a specific user */
  createdBy?: string;
}

interface UsePublishedRoomsResult {
  /** List of published rooms */
  rooms: Room[];
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refresh the rooms list */
  refresh: () => void;
}

/**
 * Hook to fetch and subscribe to published rooms
 * Used in the routes map to display dynamic wall maps
 */
export function usePublishedRooms(
  options: UsePublishedRoomsOptions = {}
): UsePublishedRoomsResult {
  const { includeHidden = false, createdBy } = options;
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);
  
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    try {
      const q = query(
        collection(db, ROOMS_COLLECTION),
        where('isPublished', '==', true)
      );
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let roomsData: Room[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            
            roomsData.push({
              id: doc.id,
              name: data.name,
              width: data.width,
              height: data.height,
              backgroundColor: data.backgroundColor || '#1a1a2e',
              gridColor: data.gridColor || '#4a4a6a',
              gridSize: data.gridSize || 50,
              showGrid: data.showGrid ?? true,
              walls: data.walls || [],
              mats: data.mats || [],
              sectors: data.sectors || [],
              textLabels: data.textLabels || [],
              entranceArrow: data.entranceArrow,
              isPublished: data.isPublished ?? false,
              isHidden: data.isHidden ?? false,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              createdBy: data.createdBy || '',
            });
          });
          
          // Client-side filtering
          if (!includeHidden) {
            roomsData = roomsData.filter(r => !r.isHidden);
          }
          
          if (createdBy) {
            roomsData = roomsData.filter(r => r.createdBy === createdBy);
          }
          
          // Sort by createdAt descending
          roomsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          
          setRooms(roomsData);
          setLoading(false);
        },
        (err) => {
          console.error('[usePublishedRooms] Snapshot error:', err);
          setError(err as Error);
          setLoading(false);
        }
      );
      
      return () => unsubscribe();
    } catch (err) {
      console.error('[usePublishedRooms] Setup error:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, [includeHidden, createdBy, refreshKey]);
  
  return { rooms, loading, error, refresh };
}

export default usePublishedRooms;
