/**
 * @fileoverview useRouteSwipe - Hook for swipe navigation between routes
 * @description Provides gesture handling and navigation state for swiping between
 * routes in detail screens. Uses react-native-gesture-handler + reanimated.
 */

import { useCallback, useMemo } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { useRouteNavigationStore } from '@/store/useRouteNavigationStore';

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface UseRouteSwipeOptions {
  /** Current route ID being displayed */
  currentRouteId: string;
  /** Called when user swipes to a different route */
  onNavigate: (routeId: string, direction: 'next' | 'prev') => void;
}

interface UseRouteSwipeResult {
  /** Pan gesture to attach to GestureDetector */
  panGesture: ReturnType<typeof Gesture.Pan>;
  /** Animated translateX value for the content */
  translateX: ReturnType<typeof useSharedValue<number>>;
  /** Current route index (0-based) */
  currentIndex: number;
  /** Total number of routes in the list */
  total: number;
  /** Whether there's a previous route to swipe to */
  hasPrev: boolean;
  /** Whether there's a next route to swipe to */
  hasNext: boolean;
  /** Whether the swipe navigation is available (list has > 1 route) */
  isSwipeEnabled: boolean;
}

export function useRouteSwipe({ currentRouteId, onNavigate }: UseRouteSwipeOptions): UseRouteSwipeResult {
  const routeIds = useRouteNavigationStore((s) => s.routeIds);
  const translateX = useSharedValue(0);

  const currentIndex = useMemo(
    () => routeIds.indexOf(currentRouteId),
    [routeIds, currentRouteId]
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < routeIds.length - 1;
  const total = routeIds.length;
  const isSwipeEnabled = total > 1 && currentIndex >= 0;

  const navigateToRoute = useCallback(
    (direction: 'next' | 'prev') => {
      const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      if (newIndex >= 0 && newIndex < routeIds.length) {
        onNavigate(routeIds[newIndex], direction);
      }
    },
    [currentIndex, routeIds, onNavigate]
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-25, 25])   // Only activate after 25px horizontal movement
      .failOffsetY([-15, 15])     // Cancel if 15px vertical movement happens first
      .onUpdate((e) => {
        'worklet';
        // Rubber-band effect at the edges
        if (e.translationX > 0 && !hasPrev) {
          translateX.value = e.translationX * 0.2;
        } else if (e.translationX < 0 && !hasNext) {
          translateX.value = e.translationX * 0.2;
        } else {
          translateX.value = e.translationX;
        }
      })
      .onEnd((e) => {
        'worklet';
        const exceedsThreshold =
          Math.abs(e.translationX) > SWIPE_THRESHOLD ||
          Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

        if (exceedsThreshold && e.translationX > 0 && hasPrev) {
          // Swipe right → previous route
          translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, (finished) => {
            if (finished) {
              translateX.value = 0; // Snap back to center before state update
              runOnJS(navigateToRoute)('prev');
            }
          });
        } else if (exceedsThreshold && e.translationX < 0 && hasNext) {
          // Swipe left → next route
          translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, (finished) => {
            if (finished) {
              translateX.value = 0; // Snap back to center before state update
              runOnJS(navigateToRoute)('next');
            }
          });
        } else {
          // Snap back
          translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        }
      });
  }, [hasPrev, hasNext, navigateToRoute, translateX]);

  return {
    panGesture,
    translateX,
    currentIndex,
    total,
    hasPrev,
    hasNext,
    isSwipeEnabled,
  };
}
