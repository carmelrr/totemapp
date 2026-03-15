/**
 * useWallTapes — React hook that subscribes to wall tapes in real-time.
 */
import { useEffect, useState } from 'react';
import { WallTape, listenToWallTapes } from '../services/WallTapeService';

export function useWallTapes() {
  const [tapes, setTapes] = useState<WallTape[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = listenToWallTapes((fetched) => {
      setTapes(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { tapes, loading };
}
