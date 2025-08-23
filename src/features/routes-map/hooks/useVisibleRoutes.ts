import { useMemo, useRef } from 'react';
import { RouteDoc, RouteFilters, RouteSortBy, MapTransforms } from '../types/route';
import { getViewportBounds, fromNorm } from '../utils/coords';
import { compareGrades, getGradeNumber } from '../utils/grades';

interface UseVisibleRoutesParams {
  routes: RouteDoc[];
  transforms: MapTransforms;
  screenWidth: number;
  screenHeight: number;
  imageWidth: number;
  imageHeight: number;
  filters?: RouteFilters;
  sortBy?: RouteSortBy;
  throttleMs?: number;
}

export function useVisibleRoutes({
  routes,
  transforms,
  screenWidth,
  screenHeight,
  imageWidth,
  imageHeight,
  filters,
  sortBy = 'distance',
  throttleMs = 100,
}: UseVisibleRoutesParams) {
  const lastUpdateRef = useRef<number>(0);
  const cachedResultRef = useRef<RouteDoc[]>([]);

  const visibleRoutes = useMemo(() => {
    const now = Date.now();
    
    // Throttle updates to prevent excessive re-renders
    if (now - lastUpdateRef.current < throttleMs && cachedResultRef.current.length > 0) {
      return cachedResultRef.current;
    }
    
    lastUpdateRef.current = now;

    // Calculate viewport bounds in image coordinates
    const bounds = getViewportBounds(transforms, screenWidth, screenHeight);
    
    // Filter routes within viewport
    let filteredRoutes = routes.filter((route) => {
      // Convert normalized coordinates to image coordinates
      const { xImg, yImg } = fromNorm(
        { xNorm: route.xNorm, yNorm: route.yNorm },
        { imgW: imageWidth, imgH: imageHeight }
      );
      
      // Check if route is within viewport bounds
      const isInViewport = 
        xImg >= bounds.xMinImg &&
        xImg <= bounds.xMaxImg &&
        yImg >= bounds.yMinImg &&
        yImg <= bounds.yMaxImg;
      
      if (!isInViewport) return false;
      
      // Apply additional filters
      if (filters) {
        // Status filter
        if (filters.status.length > 0 && !filters.status.includes(route.status)) {
          return false;
        }
        
        // Grade filter
        if (filters.grades.length > 0 && !filters.grades.includes(route.grade)) {
          return false;
        }
        
        // Color filter
        if (filters.colors.length > 0 && !filters.colors.includes(route.color)) {
          return false;
        }
        
        // Tags filter
        if (filters.tags.length > 0) {
          const routeTags = route.tags || [];
          const hasMatchingTag = filters.tags.some(tag => routeTags.includes(tag));
          if (!hasMatchingTag) {
            return false;
          }
        }
      }
      
      return true;
    });

    // Sort routes
    if (sortBy === 'distance') {
      // Sort by distance from viewport center
      const centerX = (bounds.xMinImg + bounds.xMaxImg) / 2;
      const centerY = (bounds.yMinImg + bounds.yMaxImg) / 2;
      
      filteredRoutes.sort((a, b) => {
        const aCoords = fromNorm(
          { xNorm: a.xNorm, yNorm: a.yNorm },
          { imgW: imageWidth, imgH: imageHeight }
        );
        const bCoords = fromNorm(
          { xNorm: b.xNorm, yNorm: b.yNorm },
          { imgW: imageWidth, imgH: imageHeight }
        );
        
        const aDist = Math.sqrt(
          Math.pow(aCoords.xImg - centerX, 2) + Math.pow(aCoords.yImg - centerY, 2)
        );
        const bDist = Math.sqrt(
          Math.pow(bCoords.xImg - centerX, 2) + Math.pow(bCoords.yImg - centerY, 2)
        );
        
        return aDist - bDist;
      });
    } else if (sortBy === 'grade-asc') {
      filteredRoutes.sort((a, b) => compareGrades(a.grade, b.grade));
    } else if (sortBy === 'grade-desc') {
      filteredRoutes.sort((a, b) => compareGrades(b.grade, a.grade));
    } else if (sortBy === 'rating') {
      filteredRoutes.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'newest') {
      filteredRoutes.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
    }

    cachedResultRef.current = filteredRoutes;
    return filteredRoutes;
  }, [
    routes,
    transforms.translateX,
    transforms.translateY,
    transforms.scale,
    screenWidth,
    screenHeight,
    imageWidth,
    imageHeight,
    filters,
    sortBy,
    throttleMs,
  ]);

  return visibleRoutes;
}

// Helper hook for creating default filters
export function useRouteFilters() {
  const defaultFilters: RouteFilters = {
    grades: [],
    colors: [],
    status: ['active'],
    tags: [],
  };

  return defaultFilters;
}
