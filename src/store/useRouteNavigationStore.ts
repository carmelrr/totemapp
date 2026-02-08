/**
 * @fileoverview Route Navigation Store - מחסן ניווט בין מסלולים
 * @description Stores the current filtered route list for swipe navigation between routes.
 * List screens set the route IDs before navigating to a detail screen.
 * Detail screens read the list to enable swipe-based route-to-route navigation.
 */

import { create } from 'zustand';

interface RouteNavigationState {
  /** Ordered list of route IDs matching current filters/sort */
  routeIds: string[];
  
  /** 
   * Cached route data map (id → route nav params object).
   * Used by RoutesMapScreen which passes full route objects to RouteDetailsScreen.
   */
  routeDataMap: Record<string, any>;
  
  /** Set the navigation list before navigating to a detail screen */
  setNavigationList: (ids: string[], dataMap?: Record<string, any>) => void;
  
  /** Clear the navigation list (e.g., on unmount) */
  clear: () => void;
}

export const useRouteNavigationStore = create<RouteNavigationState>((set) => ({
  routeIds: [],
  routeDataMap: {},
  
  setNavigationList: (ids, dataMap) => set({
    routeIds: ids,
    routeDataMap: dataMap || {},
  }),
  
  clear: () => set({
    routeIds: [],
    routeDataMap: {},
  }),
}));
