/**
 * @fileoverview מחסן מצב מסלולים - Routes state management using Zustand
 * @description Centralized routes state with real-time subscriptions, optimistic updates,
 * and offline persistence following TopLogger's caching patterns
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteDoc } from '@/features/routes-map/types/route';
import { RoutesService } from '@/features/routes-map/services/RoutesService';

interface RoutesState {
    // Data
    routes: RouteDoc[];
    selectedRoute: RouteDoc | null;
    
    // Cache metadata (TopLogger pattern - track data freshness)
    lastSyncAt: number | null;
    cacheVersion: number;

    // Loading states
    isLoading: boolean;
    isInitialized: boolean;
    isSyncing: boolean;
    error: string | null;
    
    // Hydration state
    hasHydrated: boolean;
    setHasHydrated: (hydrated: boolean) => void;

    // Offline queue for pending operations
    pendingOperations: PendingOperation[];

    // Subscriptions
    unsubscribe: (() => void) | null;

    // Actions
    initializeRoutes: () => void;
    selectRoute: (route: RouteDoc | null) => void;
    addRoute: (route: Omit<RouteDoc, 'id'>) => Promise<void>;
    updateRoute: (id: string, updates: Partial<RouteDoc>) => Promise<void>;
    deleteRoute: (id: string) => Promise<void>;
    cleanup: () => void;
    
    // Offline support actions
    queueOperation: (type: 'add' | 'update' | 'delete', routeId?: string, data?: any) => void;
    processPendingOperations: () => Promise<void>;
    clearCache: () => void;
    forceRefresh: () => Promise<void>;
}

// Pending operation types for offline queue
interface PendingOperation {
    id: string;
    type: 'add' | 'update' | 'delete';
    routeId?: string;
    data?: any;
    timestamp: number;
    retryCount: number;
}

/**
 * מחסן מצב מסלולים עם ניהול זמן אמת ושמירה מקומית
 * Routes store with real-time state management and offline persistence
 * Following TopLogger's caching and offline-first patterns
 */
export const useRoutesStore = create<RoutesState>()(
    persist(
        (set, get) => ({
            // Initial state
            routes: [],
            selectedRoute: null,
            lastSyncAt: null,
            cacheVersion: 1,
            isLoading: false,
            isInitialized: false,
            isSyncing: false,
            error: null,
            hasHydrated: false,
            setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
            pendingOperations: [],
            unsubscribe: null,

            // Initialize routes subscription
            initializeRoutes: () => {
                const { isInitialized, unsubscribe, routes } = get();

                if (isInitialized && unsubscribe) {
                    return; // Already initialized
                }

                // Show cached data immediately if available (TopLogger pattern)
                if (routes.length > 0) {
                    console.log('[RoutesStore] Showing cached routes while syncing...');
                    set({ isSyncing: true });
                } else {
                    set({ isLoading: true });
                }

                set({ error: null });

                try {
                    const unsubscribeFn = RoutesService.subscribeRoutes((newRoutes) => {
                        set({
                            routes: newRoutes,
                            isLoading: false,
                            isSyncing: false,
                            isInitialized: true,
                            lastSyncAt: Date.now(),
                            error: null,
                        });
                        
                        // Process any pending operations after sync
                        get().processPendingOperations();
                    });

                    set({ unsubscribe: unsubscribeFn });
                } catch (error) {
                    console.error('Error initializing routes:', error);
                    set({
                        error: error instanceof Error ? error.message : 'Failed to load routes',
                        isLoading: false,
                        isSyncing: false,
                    });
                }
            },

            // Select a route
            selectRoute: (route) => {
                set({ selectedRoute: route });
            },

            // Add new route with optimistic update
            addRoute: async (routeData) => {
                const tempId = `temp_${Date.now()}`;
                const tempRoute: RouteDoc = {
                    ...routeData,
                    id: tempId,
                    createdAt: new Date(),
                    status: routeData.status || 'active',
                    rating: 0,
                    tops: 0,
                    comments: 0,
                } as RouteDoc;

                // Optimistic update (TopLogger pattern - instant UI feedback)
                set((state) => ({
                    routes: [tempRoute, ...state.routes],
                }));

                try {
                    await RoutesService.addRoute(routeData);
                    // The subscription will replace the temp route with the real one
                } catch (error) {
                    console.error('Error adding route:', error);
                    
                    // Revert optimistic update
                    set((state) => ({
                        routes: state.routes.filter(r => r.id !== tempId),
                        error: error instanceof Error ? error.message : 'Failed to add route',
                    }));
                    
                    // Queue for retry if offline
                    get().queueOperation('add', undefined, routeData);
                    throw error;
                }
            },

            // Update existing route with optimistic update
            updateRoute: async (id, updates) => {
                const { routes } = get();
                const originalRoute = routes.find(r => r.id === id);

                // Optimistic update
                if (originalRoute) {
                    set((state) => ({
                        routes: state.routes.map(r => 
                            r.id === id ? { ...r, ...updates } : r
                        ),
                    }));
                }

                try {
                    await RoutesService.updateRoute(id, updates);
                    // The subscription will automatically update the store
                } catch (error) {
                    console.error('Error updating route:', error);
                    
                    // Revert optimistic update
                    if (originalRoute) {
                        set((state) => ({
                            routes: state.routes.map(r => 
                                r.id === id ? originalRoute : r
                            ),
                            error: error instanceof Error ? error.message : 'Failed to update route',
                        }));
                    }
                    
                    // Queue for retry if offline
                    get().queueOperation('update', id, updates);
                    throw error;
                }
            },

            // Delete route with optimistic update
            deleteRoute: async (id) => {
                const { routes } = get();
                const originalRoute = routes.find(r => r.id === id);
                
                // Optimistic delete
                set((state) => ({
                    routes: state.routes.filter(r => r.id !== id),
                    selectedRoute: state.selectedRoute?.id === id ? null : state.selectedRoute,
                }));

                try {
                    await RoutesService.deleteRoute(id);
                } catch (error) {
                    console.error('Error deleting route:', error);
                    
                    // Revert optimistic delete
                    if (originalRoute) {
                        set((state) => ({
                            routes: [...state.routes, originalRoute],
                            error: error instanceof Error ? error.message : 'Failed to delete route',
                        }));
                    }
                    
                    // Queue for retry if offline
                    get().queueOperation('delete', id, undefined);
                    throw error;
                }
            },

            // Cleanup subscriptions
            cleanup: () => {
                const { unsubscribe } = get();
                if (unsubscribe) {
                    unsubscribe();
                    set({
                        unsubscribe: null,
                        isInitialized: false,
                    });
                }
            },

            // Queue operation for retry (TopLogger offline pattern)
            queueOperation: (type: 'add' | 'update' | 'delete', routeId?: string, data?: any) => {
                const operation: PendingOperation = {
                    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type,
                    routeId,
                    data,
                    timestamp: Date.now(),
                    retryCount: 0,
                };
                
                set((state) => ({
                    pendingOperations: [...state.pendingOperations, operation],
                }));
            },

            // Process pending operations when back online
            processPendingOperations: async () => {
                const { pendingOperations } = get();
                if (pendingOperations.length === 0) return;

                console.log(`[RoutesStore] Processing ${pendingOperations.length} pending operations...`);

                for (const operation of pendingOperations) {
                    try {
                        switch (operation.type) {
                            case 'add':
                                if (operation.data) {
                                    await RoutesService.addRoute(operation.data);
                                }
                                break;
                            case 'update':
                                if (operation.routeId && operation.data) {
                                    await RoutesService.updateRoute(operation.routeId, operation.data);
                                }
                                break;
                            case 'delete':
                                if (operation.routeId) {
                                    await RoutesService.deleteRoute(operation.routeId);
                                }
                                break;
                        }
                        
                        // Remove successful operation from queue
                        set((state) => ({
                            pendingOperations: state.pendingOperations.filter(op => op.id !== operation.id),
                        }));
                    } catch (error) {
                        console.error(`[RoutesStore] Failed to process operation ${operation.id}:`, error);
                        
                        // Increment retry count
                        set((state) => ({
                            pendingOperations: state.pendingOperations.map(op => 
                                op.id === operation.id 
                                    ? { ...op, retryCount: op.retryCount + 1 }
                                    : op
                            ),
                        }));
                    }
                }
            },

            // Clear cached data
            clearCache: () => {
                set({
                    routes: [],
                    selectedRoute: null,
                    lastSyncAt: null,
                    pendingOperations: [],
                });
            },

            // Force refresh from server
            forceRefresh: async () => {
                const { cleanup, initializeRoutes } = get();
                cleanup();
                set({ lastSyncAt: null });
                initializeRoutes();
            },
        }),
        {
            name: 'routes-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                // Only persist essential data (TopLogger pattern)
                routes: state.routes,
                selectedRoute: state.selectedRoute,
                lastSyncAt: state.lastSyncAt,
                cacheVersion: state.cacheVersion,
                pendingOperations: state.pendingOperations,
            }),
            onRehydrateStorage: () => (state) => {
                console.log('[RoutesStore] Rehydrated from storage, routes count:', state?.routes?.length || 0);
                useRoutesStore.getState().setHasHydrated(true);
            },
        }
    )
);

// Selectors for better performance
export const useRoutes = () => useRoutesStore((state) => state.routes);
export const useSelectedRoute = () => useRoutesStore((state) => state.selectedRoute);
export const useRoutesLoading = () => useRoutesStore((state) => state.isLoading);
export const useRoutesSyncing = () => useRoutesStore((state) => state.isSyncing);
export const useRoutesError = () => useRoutesStore((state) => state.error);
export const useLastSyncAt = () => useRoutesStore((state) => state.lastSyncAt);
export const usePendingOperations = () => useRoutesStore((state) => state.pendingOperations);
export const useRoutesHasHydrated = () => useRoutesStore((state) => state.hasHydrated);

// Actions
export const useRoutesActions = () => useRoutesStore((state) => ({
    initializeRoutes: state.initializeRoutes,
    selectRoute: state.selectRoute,
    addRoute: state.addRoute,
    updateRoute: state.updateRoute,
    deleteRoute: state.deleteRoute,
    cleanup: state.cleanup,
    processPendingOperations: state.processPendingOperations,
    clearCache: state.clearCache,
    forceRefresh: state.forceRefresh,
}));
