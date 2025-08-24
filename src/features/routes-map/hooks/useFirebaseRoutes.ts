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
        console.log(`🔥 Firebase routes updated: ${newRoutes.length} routes received`);
        
        // Log summary of routes
        newRoutes.forEach((route, index) => {
          console.log(`  ${index + 1}. ${route.name || route.id}: (${route.xNorm.toFixed(3)}, ${route.yNorm.toFixed(3)}) ${route.grade}`);
        });
        
        setRoutes(newRoutes);
        setIsLoading(false);
      },
      (err) => {
        console.error('❌ Firebase routes error:', err);
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
