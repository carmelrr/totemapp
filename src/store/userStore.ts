/**
 * @fileoverview מחסן מצב משתמש - User state management using Zustand
 * @description Centralized user authentication and profile state with offline persistence
 * Following TopLogger's "always logged in" pattern with local caching
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/features/data/firebase';
import { UserStatsService } from '@/features/routes-map/services/UserStatsService';
import { RankingsService } from '@/features/routes-map/services/RankingsService';

interface UserProfile {
    id: string;
    displayName: string;
    email: string;
    photoURL?: string;
    isAdmin: boolean;
    preferences: {
        theme: 'light' | 'dark' | 'auto';
        language: 'he' | 'en';
        units: 'metric' | 'imperial';
    };
    stats: {
        totalFeedbacks: number;
        totalStarRating: number;
        averageRating: number;
        completedRoutes: number;
        highestGrade?: string;
        totalRoutesSent?: number;
    };
    ranking?: {
        rank: number;
        total: number;
        percentile: number;
        lastUpdated: number;
    };
}

interface UserState {
    // Auth state
    currentUser: User | null;
    userProfile: UserProfile | null;

    // Cache metadata (TopLogger pattern)
    lastProfileSync: number | null;
    lastStatsSync: number | null;
    cacheVersion: number;

    // Loading states
    isLoading: boolean;
    isInitialized: boolean;
    isSyncing: boolean;
    error: string | null;
    
    // Hydration state (critical for race condition prevention)
    hasHydrated: boolean;
    setHasHydrated: (hydrated: boolean) => void;

    // Actions
    setCurrentUser: (user: User | null) => void;
    loadUserProfile: (userId: string) => Promise<void>;
    updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
    refreshUserStats: (userId: string) => Promise<void>;
    refreshUserRanking: (userId: string) => Promise<void>;
    clearUser: () => void;
    clearCache: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            // Initial state
            currentUser: null,
            userProfile: null,
            lastProfileSync: null,
            lastStatsSync: null,
            cacheVersion: 1,
            isLoading: false,
            isInitialized: false,
            isSyncing: false,
            error: null,
            hasHydrated: false,
            
            // Set hydration status
            setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

            // Set current authenticated user
            setCurrentUser: (user) => {
                set({ currentUser: user });

                if (user) {
                    // Load user profile when user is set
                    get().loadUserProfile(user.uid);
                } else {
                    // Clear profile when user is null (but keep cached data)
                    set({ currentUser: null });
                }
            },

            // Load user profile data with caching (TopLogger pattern)
            loadUserProfile: async (userId) => {
                const { userProfile, lastProfileSync } = get();
                
                // Show cached data immediately if available
                if (userProfile && userProfile.id === userId) {
                    console.log('[UserStore] Showing cached profile while syncing...');
                    set({ isSyncing: true });
                } else {
                    set({ isLoading: true });
                }
                
                set({ error: null });

                try {
                    // Fetch from Firestore
                    const userDocRef = doc(db, 'users', userId);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    const { currentUser } = get();
                    
                    let profile: UserProfile;
                    
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        profile = {
                            id: userId,
                            displayName: userData.displayName || currentUser?.displayName || 'Anonymous',
                            email: userData.email || currentUser?.email || '',
                            photoURL: userData.photoURL || currentUser?.photoURL || undefined,
                            isAdmin: userData.isAdmin === true,
                            preferences: userData.preferences || {
                                theme: 'auto',
                                language: 'he',
                                units: 'metric',
                            },
                            stats: userData.stats || {
                                totalFeedbacks: 0,
                                totalStarRating: 0,
                                averageRating: 0,
                                completedRoutes: 0,
                            },
                        };
                    } else {
                        // Create basic profile from auth user
                        profile = {
                            id: userId,
                            displayName: currentUser?.displayName || 'Anonymous',
                            email: currentUser?.email || '',
                            photoURL: currentUser?.photoURL || undefined,
                            isAdmin: false,
                            preferences: {
                                theme: 'auto',
                                language: 'he',
                                units: 'metric',
                            },
                            stats: {
                                totalFeedbacks: 0,
                                totalStarRating: 0,
                                averageRating: 0,
                                completedRoutes: 0,
                            },
                        };
                    }

                    // Load fresh stats
                    try {
                        const stats = await UserStatsService.getUserStats(userId);
                        profile.stats = { ...profile.stats, ...stats };
                    } catch (error) {
                        console.warn('[UserStore] Could not load user stats:', error);
                    }

                    // Load ranking
                    try {
                        const ranking = await RankingsService.getUserRank(userId, 'grade');
                        if (ranking) {
                            profile.ranking = {
                                ...ranking,
                                lastUpdated: Date.now(),
                            };
                        }
                    } catch (error) {
                        console.warn('[UserStore] Could not load user ranking:', error);
                    }

                    set({
                        userProfile: profile,
                        isLoading: false,
                        isSyncing: false,
                        isInitialized: true,
                        lastProfileSync: Date.now(),
                    });
                } catch (error) {
                    console.error('[UserStore] Error loading user profile:', error);
                    set({
                        error: error instanceof Error ? error.message : 'Failed to load user profile',
                        isLoading: false,
                        isSyncing: false,
                    });
                }
            },

            // Update user profile with optimistic update
            updateUserProfile: async (updates) => {
                const { userProfile } = get();
                if (!userProfile) return;

                const originalProfile = { ...userProfile };

                // Optimistic update
                set({
                    userProfile: {
                        ...userProfile,
                        ...updates,
                    },
                });

                try {
                    // TODO: Implement UserService.updateProfile(userProfile.id, updates)
                    console.log('[UserStore] User profile update:', updates);
                } catch (error) {
                    console.error('[UserStore] Error updating user profile:', error);
                    // Revert optimistic update on error
                    set({ userProfile: originalProfile });
                    throw error;
                }
            },

            // Refresh user statistics
            refreshUserStats: async (userId) => {
                try {
                    set({ isSyncing: true });
                    
                    const stats = await UserStatsService.getUserStats(userId);
                    const { userProfile } = get();

                    if (userProfile && userProfile.id === userId) {
                        set({
                            userProfile: {
                                ...userProfile,
                                stats: { ...userProfile.stats, ...stats },
                            },
                            lastStatsSync: Date.now(),
                            isSyncing: false,
                        });
                    }
                } catch (error) {
                    console.error('[UserStore] Error refreshing user stats:', error);
                    set({ isSyncing: false });
                }
            },

            // Refresh user ranking
            refreshUserRanking: async (userId) => {
                try {
                    const ranking = await RankingsService.getUserRank(userId, 'grade');
                    const { userProfile } = get();

                    if (userProfile && userProfile.id === userId && ranking) {
                        set({
                            userProfile: {
                                ...userProfile,
                                ranking: {
                                    ...ranking,
                                    lastUpdated: Date.now(),
                                },
                            },
                        });
                    }
                } catch (error) {
                    console.error('[UserStore] Error refreshing user ranking:', error);
                }
            },

            // Clear user data (on logout)
            clearUser: () => {
                set({
                    currentUser: null,
                    userProfile: null,
                    isLoading: false,
                    isInitialized: false,
                    isSyncing: false,
                    error: null,
                    lastProfileSync: null,
                    lastStatsSync: null,
                });
            },

            // Clear cached data
            clearCache: () => {
                set({
                    userProfile: null,
                    lastProfileSync: null,
                    lastStatsSync: null,
                });
            },
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                // Only persist profile data (not auth state - Firebase handles that)
                userProfile: state.userProfile,
                lastProfileSync: state.lastProfileSync,
                lastStatsSync: state.lastStatsSync,
                cacheVersion: state.cacheVersion,
            }),
            onRehydrateStorage: () => (state) => {
                // Called when store is rehydrated from AsyncStorage
                console.log('[UserStore] Rehydrated from storage, profile:', state?.userProfile?.displayName);
                useUserStore.getState().setHasHydrated(true);
            },
        }
    )
);

// Selectors
export const useCurrentUser = () => useUserStore((state) => state.currentUser);
export const useUserProfile = () => useUserStore((state) => state.userProfile);
export const useUserLoading = () => useUserStore((state) => state.isLoading);
export const useUserSyncing = () => useUserStore((state) => state.isSyncing);
export const useHasHydrated = () => useUserStore((state) => state.hasHydrated);
export const useUserStats = () => useUserStore((state) => state.userProfile?.stats);
export const useUserRanking = () => useUserStore((state) => state.userProfile?.ranking);
export const useIsAdmin = () => useUserStore((state) => state.userProfile?.isAdmin || false);
export const useLastProfileSync = () => useUserStore((state) => state.lastProfileSync);

// Actions
export const useUserActions = () => useUserStore((state) => ({
    setCurrentUser: state.setCurrentUser,
    loadUserProfile: state.loadUserProfile,
    updateUserProfile: state.updateUserProfile,
    refreshUserStats: state.refreshUserStats,
    refreshUserRanking: state.refreshUserRanking,
    clearUser: state.clearUser,
    clearCache: state.clearCache,
}));
