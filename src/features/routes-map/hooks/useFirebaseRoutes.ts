import { useState, useEffect } from 'react';
import { RoutesService } from '../services/RoutesService';
import { RouteDoc } from '../types/route';

export function useFirebaseRoutes() {
  const [routes, setRoutes] = useState<RouteDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const unsubscribe = RoutesService.subscribeRoutes(
      (newRoutes) => {
        setRoutes(newRoutes);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return {
    routes,
    isLoading,
    error,
  };
}

export function useActiveRoutes() {
  const [routes, setRoutes] = useState<RouteDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const unsubscribe = RoutesService.subscribeActiveRoutes(
      (newRoutes) => {
        setRoutes(newRoutes);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return {
    routes,
    isLoading,
    error,
  };
}
