/**
 * @fileoverview מחסן מצב מסלולים - Routes state management using Zustand
 * @description Centralized routes state with real-time subscriptions and optimistic updates
 */

import { create } from 'zustand';
import { RouteDoc } from '@/features/routes-map/types/route';
import { RoutesService } from '@/features/routes-map/services/RoutesService';

interface RoutesState {
    // Data
    routes: RouteDoc[];
    selectedRoute: RouteDoc | null;

    // Loading states
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // Subscriptions
    unsubscribe: (() => void) | null;

    // Actions
    initializeRoutes: () => void;
    selectRoute: (route: RouteDoc | null) => void;
    addRoute: (route: Omit<RouteDoc, 'id'>) => Promise<void>;
    updateRoute: (id: string, updates: Partial<RouteDoc>) => Promise<void>;
    deleteRoute: (id: string) => Promise<void>;
    cleanup: () => void;
}

/**
 * מחסן מצב מסלולים עם ניהול זמן אמת
 * Routes store with real-time state management
 */
export const useRoutesStore = create<RoutesState>((set, get) => ({
    // Initial state
    routes: [],
    selectedRoute: null,
    isLoading: false,
    isInitialized: false,
    error: null,
    unsubscribe: null,

    // Initialize routes subscription
    initializeRoutes: () => {
        const { isInitialized, unsubscribe } = get();

        if (isInitialized && unsubscribe) {
            return; // Already initialized
        }

        set({ isLoading: true, error: null });

        try {
            const unsubscribeFn = RoutesService.subscribeRoutes((routes) => {
                set({
                    routes,
                    isLoading: false,
                    isInitialized: true,
                    error: null,
                });
            });

            set({ unsubscribe: unsubscribeFn });
        } catch (error) {
            console.error('Error initializing routes:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to load routes',
                isLoading: false,
            });
        }
    },

    // Select a route
    selectRoute: (route) => {
        set({ selectedRoute: route });
    },

    // Add new route
    addRoute: async (routeData) => {
        try {
            await RoutesService.addRoute(routeData);
            // The subscription will automatically update the store
        } catch (error) {
            console.error('Error adding route:', error);
            set({ error: error instanceof Error ? error.message : 'Failed to add route' });
            throw error;
        }
    },

    // Update existing route
    updateRoute: async (id, updates) => {
        try {
            await RoutesService.updateRoute(id, updates);
            // The subscription will automatically update the store
        } catch (error) {
            console.error('Error updating route:', error);
            set({ error: error instanceof Error ? error.message : 'Failed to update route' });
            throw error;
        }
    },

    // Delete route
    deleteRoute: async (id) => {
        try {
            await RoutesService.deleteRoute(id);
            // The subscription will automatically update the store

            // Clear selected route if it was deleted
            const { selectedRoute } = get();
            if (selectedRoute?.id === id) {
                set({ selectedRoute: null });
            }
        } catch (error) {
            console.error('Error deleting route:', error);
            set({ error: error instanceof Error ? error.message : 'Failed to delete route' });
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
                routes: [],
                selectedRoute: null,
            });
        }
    },
}));

// Selectors for better performance
export const useRoutes = () => useRoutesStore((state) => state.routes);
export const useSelectedRoute = () => useRoutesStore((state) => state.selectedRoute);
export const useRoutesLoading = () => useRoutesStore((state) => state.isLoading);
export const useRoutesError = () => useRoutesStore((state) => state.error);

// Actions
export const useRoutesActions = () => useRoutesStore((state) => ({
    initializeRoutes: state.initializeRoutes,
    selectRoute: state.selectRoute,
    addRoute: state.addRoute,
    updateRoute: state.updateRoute,
    deleteRoute: state.deleteRoute,
    cleanup: state.cleanup,
}));
