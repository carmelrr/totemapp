
import { useMemo } from 'react';
import { isRouteVisibleOnScreen } from '../utils/mapUtils';

export default function useVisibleRoutes(routes, scale, translateX, translateY, mapWidth, mapHeight, circleRadius = 15) {
  return useMemo(() => {
    if (!routes || !Array.isArray(routes)) {
      return [];
    }
    
    const visibleRoutes = routes.filter((route) => {
      if (!route) return false;
      const isVisible = isRouteVisibleOnScreen(route, scale, translateX, translateY, mapWidth, mapHeight, circleRadius);
      return isVisible;
    });
    
    return visibleRoutes;
  }, [routes, scale, translateX, translateY, mapWidth, mapHeight, circleRadius]);
}
