// src/features/community-routes/hooks.ts
// Custom hooks for Community Routes feature

import { useState, useEffect, useCallback } from 'react';
import {
  CommunityRoute,
  CommunityRouteComment,
  CommunityRouteFilters,
} from './types';
import {
  getCommunityRoutes,
  getCommunityRoute,
  getUserCommunityRoutes,
  listenToCommunityRoutes,
  createCommunityRoute,
  deleteCommunityRoute,
  uploadCommunityRouteImage,
  toggleLike,
  hasUserLiked,
  getComments,
  addComment,
  deleteComment,
  incrementViewCount,
  getDaysUntilExpiration,
  isExpiringSoon,
} from './service';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook to get community routes with real-time updates
 */
export function useCommunityRoutes(filters?: CommunityRouteFilters) {
  const [routes, setRoutes] = useState<CommunityRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = listenToCommunityRoutes(
      (fetchedRoutes) => {
        setRoutes(fetchedRoutes);
        setLoading(false);
      },
      filters
    );

    return () => unsubscribe();
  }, [filters?.sortBy, filters?.gymName]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedRoutes = await getCommunityRoutes(filters);
      setRoutes(fetchedRoutes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  return { routes, loading, error, refresh };
}

/**
 * Hook to get the current user's community routes
 */
export function useUserCommunityRoutes() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<CommunityRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setRoutes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getUserCommunityRoutes(user.uid)
      .then((fetchedRoutes) => {
        setRoutes(fetchedRoutes);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user?.uid]);

  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const fetchedRoutes = await getUserCommunityRoutes(user.uid);
      setRoutes(fetchedRoutes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  return { routes, loading, error, refresh };
}

/**
 * Hook to get a single community route
 */
export function useCommunityRoute(routeId: string | null) {
  const [route, setRoute] = useState<CommunityRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) {
      setRoute(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getCommunityRoute(routeId)
      .then((fetchedRoute) => {
        setRoute(fetchedRoute);
        setLoading(false);
        // Increment view count
        if (fetchedRoute) {
          incrementViewCount(routeId).catch(console.error);
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [routeId]);

  return { route, loading, error };
}

/**
 * Hook for creating a new community route
 */
export function useCreateCommunityRoute() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (
      imageUri: string,
      imageWidth: number,
      imageHeight: number,
      name: string,
      grade: string,
      holds: any[],
      options?: {
        description?: string;
        gymName?: string;
        wallSection?: string;
        tags?: string[];
      }
    ) => {
      if (!user) {
        throw new Error('יש להתחבר כדי ליצור מסלול');
      }

      setSaving(true);
      setError(null);

      try {
        // Upload image first
        const imageUrl = await uploadCommunityRouteImage(imageUri, user.uid);

        // Create route document
        const routeId = await createCommunityRoute({
          imageUrl,
          imageWidth,
          imageHeight,
          name,
          grade,
          holds,
          createdBy: user.uid,
          creatorName: user.displayName || 'אנונימי',
          ...options,
        });

        return routeId;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  return { create, saving, error };
}

/**
 * Hook for deleting a community route
 */
export function useDeleteCommunityRoute() {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteRoute = useCallback(
    async (routeId: string, createdBy: string) => {
      if (!user) {
        throw new Error('יש להתחבר כדי למחוק מסלול');
      }

      if (user.uid !== createdBy) {
        throw new Error('אין לך הרשאה למחוק מסלול זה');
      }

      setDeleting(true);
      setError(null);

      try {
        await deleteCommunityRoute(routeId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setDeleting(false);
      }
    },
    [user]
  );

  return { deleteRoute, deleting, error };
}

/**
 * Hook for managing likes
 */
export function useCommunityRouteLike(routeId: string | null) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routeId || !user?.uid) {
      setLiked(false);
      setLoading(false);
      return;
    }

    hasUserLiked(routeId, user.uid)
      .then((hasLiked) => {
        setLiked(hasLiked);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [routeId, user?.uid]);

  const toggle = useCallback(async () => {
    if (!routeId || !user?.uid) return false;

    try {
      const newLikedState = await toggleLike(routeId, user.uid);
      setLiked(newLikedState);
      return newLikedState;
    } catch (err) {
      console.error('Error toggling like:', err);
      return liked;
    }
  }, [routeId, user?.uid, liked]);

  return { liked, loading, toggle };
}

/**
 * Hook for managing comments
 */
export function useCommunityRouteComments(routeId: string | null) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommunityRouteComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    try {
      const fetchedComments = await getComments(routeId);
      setComments(fetchedComments);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const post = useCallback(
    async (text: string) => {
      if (!routeId || !user?.uid) return;

      setPosting(true);
      try {
        await addComment(
          routeId,
          user.uid,
          user.displayName || 'אנונימי',
          text
        );
        await refresh();
      } catch (err) {
        console.error('Error posting comment:', err);
        throw err;
      } finally {
        setPosting(false);
      }
    },
    [routeId, user, refresh]
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!routeId) return;
      try {
        await deleteComment(commentId, routeId);
        await refresh();
      } catch (err) {
        console.error('Error deleting comment:', err);
        throw err;
      }
    },
    [routeId, refresh]
  );

  return { comments, loading, posting, post, remove, refresh };
}

/**
 * Hook for expiration helpers
 */
export function useExpirationInfo(expiresAt: any) {
  const [daysLeft, setDaysLeft] = useState(0);
  const [expiringSoon, setExpiringSoon] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const updateExpiration = () => {
      setDaysLeft(getDaysUntilExpiration(expiresAt));
      setExpiringSoon(isExpiringSoon(expiresAt));
    };

    updateExpiration();

    // Update every hour
    const interval = setInterval(updateExpiration, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return { daysLeft, expiringSoon };
}
