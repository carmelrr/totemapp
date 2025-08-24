/**
 * @fileoverview מחסן מצב משתמש - User state management using Zustand
 * @description Centralized user authentication and profile state
 */

import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth } from '@/features/data/firebase';
import { UserStatsService } from '@/features/routes-map/services/UserStatsService';

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
    };
}

interface UserState {
    // Auth state
    currentUser: User | null;
    userProfile: UserProfile | null;

    // Loading states
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // Actions
    setCurrentUser: (user: User | null) => void;
    loadUserProfile: (userId: string) => Promise<void>;
    updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
    refreshUserStats: (userId: string) => Promise<void>;
    clearUser: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
    // Initial state
    currentUser: null,
    userProfile: null,
    isLoading: false,
    isInitialized: false,
    error: null,

    // Set current authenticated user
    setCurrentUser: (user) => {
        set({ currentUser: user });

        if (user) {
            // Load user profile when user is set
            get().loadUserProfile(user.uid);
        } else {
            // Clear profile when user is null
            set({ userProfile: null });
        }
    },

    // Load user profile data
    loadUserProfile: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            // This would need to be implemented in a UserService
            // For now, create a basic profile from auth user
            const { currentUser } = get();

            if (currentUser) {
                const profile: UserProfile = {
                    id: currentUser.uid,
                    displayName: currentUser.displayName || 'Anonymous',
                    email: currentUser.email || '',
                    photoURL: currentUser.photoURL || undefined,
                    isAdmin: false, // This should come from Firestore
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

                // Load user stats
                try {
                    const stats = await UserStatsService.getUserStats(userId);
                    profile.stats = stats;
                } catch (error) {
                    console.warn('Could not load user stats:', error);
                }

                set({
                    userProfile: profile,
                    isLoading: false,
                    isInitialized: true,
                });
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to load user profile',
                isLoading: false,
            });
        }
    },

    // Update user profile
    updateUserProfile: async (updates) => {
        const { userProfile } = get();
        if (!userProfile) return;

        try {
            // Update local state optimistically
            set({
                userProfile: {
                    ...userProfile,
                    ...updates,
                },
            });

            // TODO: Implement UserService.updateProfile(userProfile.id, updates)
            console.log('User profile update:', updates);
        } catch (error) {
            console.error('Error updating user profile:', error);
            // Revert optimistic update on error
            set({ userProfile });
            throw error;
        }
    },

    // Refresh user statistics
    refreshUserStats: async (userId) => {
        try {
            const stats = await UserStatsService.getUserStats(userId);
            const { userProfile } = get();

            if (userProfile) {
                set({
                    userProfile: {
                        ...userProfile,
                        stats,
                    },
                });
            }
        } catch (error) {
            console.error('Error refreshing user stats:', error);
        }
    },

    // Clear user data
    clearUser: () => {
        set({
            currentUser: null,
            userProfile: null,
            isLoading: false,
            isInitialized: false,
            error: null,
        });
    },
}));

// Selectors
export const useCurrentUser = () => useUserStore((state) => state.currentUser);
export const useUserProfile = () => useUserStore((state) => state.userProfile);
export const useUserLoading = () => useUserStore((state) => state.isLoading);
export const useUserStats = () => useUserStore((state) => state.userProfile?.stats);
export const useIsAdmin = () => useUserStore((state) => state.userProfile?.isAdmin || false);

// Actions
export const useUserActions = () => useUserStore((state) => ({
    setCurrentUser: state.setCurrentUser,
    loadUserProfile: state.loadUserProfile,
    updateUserProfile: state.updateUserProfile,
    refreshUserStats: state.refreshUserStats,
    clearUser: state.clearUser,
}));
