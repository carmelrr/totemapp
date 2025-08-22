import { useState, useEffect } from 'react';
import { sprayApi } from './sprayApi';

export const useSprayWall = (wallId) => {
  const [currentSeason, setCurrentSeason] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wallId) return;

    const loadSeason = async () => {
      try {
        setLoading(true);
        const season = await sprayApi.getCurrentSeason(wallId);
        setCurrentSeason(season);
        
        if (season) {
          // Listen to routes for current season
          const unsubscribe = sprayApi.listenRoutes(wallId, season.id, (routesData) => {
            setRoutes(routesData);
            setLoading(false);
          });
          
          return unsubscribe;
        } else {
          setRoutes([]);
          setLoading(false);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    const unsubscribe = loadSeason();
    
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [wallId]);

  const refreshSeason = async () => {
    try {
      const season = await sprayApi.getCurrentSeason(wallId);
      setCurrentSeason(season);
    } catch (err) {
      setError(err.message);
    }
  };

  return {
    currentSeason,
    routes,
    loading,
    error,
    refreshSeason
  };
};
