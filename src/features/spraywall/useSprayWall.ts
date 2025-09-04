import { useState, useEffect } from "react";
import { sprayApi } from "./sprayApi";

export const useSprayWall = (wallId) => {
  const [currentSeason, setCurrentSeason] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wallId) return;

    let unsubscribeFunction: (() => void) | null = null;

    const loadSeason = async () => {
      try {
        setLoading(true);
        setError(null);

        const season = await sprayApi.getCurrentSeason(wallId);
        setCurrentSeason(season);

        if (season) {
          // Listen to routes for current season
          const unsubscribe = sprayApi.listenRoutes(
            wallId,
            season.id,
            (routesData) => {
              setRoutes(routesData);
              setLoading(false);
            },
          );

          unsubscribeFunction = unsubscribe;
        } else {
          setRoutes([]);
          setLoading(false);
        }
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    };

    loadSeason();

    return () => {
      if (unsubscribeFunction && typeof unsubscribeFunction === "function") {
        unsubscribeFunction();
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
    refreshSeason,
  };
};
