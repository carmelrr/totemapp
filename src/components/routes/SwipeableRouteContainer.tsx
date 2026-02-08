/**
 * @fileoverview SwipeableRouteContainer - מיכל החלקה בין מסלולים
 * @description Wraps route detail screen content with horizontal swipe gesture
 * for navigating between routes. Shows position indicator and edge arrows.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, I18nManager } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useRouteSwipe } from '@/hooks/useRouteSwipe';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface SwipeableRouteContainerProps {
  /** Current route ID being displayed */
  currentRouteId: string;
  /** Called when user successfully swipes to navigate to another route */
  onNavigateToRoute: (routeId: string, direction: 'next' | 'prev') => void;
  /** Content to wrap (the detail screen) */
  children: React.ReactNode;
}

export function SwipeableRouteContainer({
  currentRouteId,
  onNavigateToRoute,
  children,
}: SwipeableRouteContainerProps) {
  const { theme } = useTheme();

  const { panGesture, translateX, currentIndex, total, hasPrev, hasNext, isSwipeEnabled } =
    useRouteSwipe({ currentRouteId, onNavigate: onNavigateToRoute });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const styles = useMemo(() => createStyles(theme), [theme]);

  // If only 1 route (or not in the list), just render children without swipe
  if (!isSwipeEnabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Position indicator bar */}
      <View style={styles.indicatorBar}>
        <View style={styles.indicatorContent}>
          {hasPrev && (
            <Ionicons
              name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
              size={16}
              color={theme.textSecondary}
              style={styles.arrowIcon}
            />
          )}
          <Text style={styles.indicatorText}>
            {currentIndex + 1} / {total}
          </Text>
          {hasNext && (
            <Ionicons
              name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'}
              size={16}
              color={theme.textSecondary}
              style={styles.arrowIcon}
            />
          )}
        </View>
      </View>

      {/* Swipeable content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.content, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    indicatorBar: {
      position: 'absolute',
      bottom: 24,
      alignSelf: 'center',
      zIndex: 100,
      elevation: 10,
    },
    indicatorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
      gap: 6,
    },
    indicatorText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    arrowIcon: {
      opacity: 0.6,
    },
    content: {
      flex: 1,
    },
  });
