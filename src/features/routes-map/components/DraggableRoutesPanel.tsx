// DraggableRoutesPanel - Bottom sheet panel for routes list
// Can be dragged up and down to control how much of the map it covers

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/features/theme/ThemeContext';
import { RoutesList } from '@/components/Lists';
import { FiltersBar } from '@/components/Filters';
import type { SortOption } from '@/components/Filters/FiltersBar';
import type { RouteDoc } from '../types/route';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Height limits as percentages of screen height
const HEIGHT_LIMITS = {
  MIN: 0.12,    // Collapsed - just the handle and filter bar visible
  MAX: 0.85,    // Almost full screen
};

interface DraggableRoutesPanelProps {
  routes: RouteDoc[];
  visibleRouteIds: string[];
  totalRouteCount: number;
  visibleRouteCount: number;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  onRoutePress: (route: RouteDoc) => void;
  onRouteLongPress?: (route: RouteDoc) => void;
  editModeEnabled?: boolean;
  canAccessEditMode?: boolean;
  onToggleEditMode?: () => void;
  onAddRoute?: () => void;
  onOpenArchive?: () => void;
  isLoading?: boolean;
  movingRoute?: boolean;
  onCancelMove?: () => void;
  /** Initial panel height in pixels. If provided, overrides the default height */
  initialHeight?: number;
  /** External shared value to sync the panel height (for coordinating with map) */
  panelHeightSV?: SharedValue<number>;
}

export default function DraggableRoutesPanel({
  routes,
  visibleRouteIds,
  totalRouteCount,
  visibleRouteCount,
  sortBy,
  onSortChange,
  onRoutePress,
  onRouteLongPress,
  editModeEnabled = false,
  canAccessEditMode = false,
  onToggleEditMode,
  onAddRoute,
  onOpenArchive,
  isLoading = false,
  movingRoute = false,
  onCancelMove,
  initialHeight: initialHeightProp,
  panelHeightSV,
}: DraggableRoutesPanelProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Calculate height limits in pixels
  const minHeight = SCREEN_HEIGHT * HEIGHT_LIMITS.MIN;
  const maxHeight = SCREEN_HEIGHT * HEIGHT_LIMITS.MAX;
  const defaultHeight = initialHeightProp 
    ? Math.max(minHeight, Math.min(maxHeight, initialHeightProp)) 
    : SCREEN_HEIGHT * 0.65;
  
  // Current panel height (animated) — use external shared value if provided
  const internalPanelHeight = useSharedValue(defaultHeight);
  const panelHeight = panelHeightSV || internalPanelHeight;
  const startHeight = useSharedValue(defaultHeight);
  
  // Initialize to default height on mount
  useEffect(() => {
    panelHeight.value = defaultHeight;
  }, [defaultHeight]);
  
  // Pan gesture for dragging - freely positions without snapping
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startHeight.value = panelHeight.value;
    })
    .onUpdate((event) => {
      // Dragging up = negative translationY = increase height
      const newHeight = startHeight.value - event.translationY;
      panelHeight.value = Math.max(minHeight, Math.min(maxHeight, newHeight));
    })
    .onEnd((event) => {
      // Apply velocity-based deceleration for smooth finish
      const velocity = event.velocityY;
      const projectedHeight = panelHeight.value - velocity * 0.1;
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, projectedHeight));
      
      panelHeight.value = withSpring(clampedHeight, {
        damping: 30,
        stiffness: 200,
        velocity: -velocity,
      });
    });
  
  // Animated style for the panel
  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: panelHeight.value,
    };
  });
  
  // Animated style for the handle indicator
  const handleIndicatorStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      panelHeight.value,
      [minHeight, maxHeight],
      [0, 180],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });
  
  // Tap on handle to toggle between collapsed and expanded
  const handleTapAction = useCallback(() => {
    const midPoint = (minHeight + maxHeight) / 2;
    if (panelHeight.value < midPoint) {
      // Currently more collapsed - expand
      panelHeight.value = withSpring(maxHeight, { damping: 30, stiffness: 200 });
    } else {
      // Currently more expanded - collapse
      panelHeight.value = withSpring(minHeight, { damping: 30, stiffness: 200 });
    }
  }, [panelHeight, minHeight, maxHeight]);
  
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(handleTapAction)();
    });
  
  const combinedGesture = Gesture.Race(panGesture, tapGesture);
  
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  
  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Drag Handle */}
      <GestureDetector gesture={combinedGesture}>
        <View style={styles.handleContainer}>
          <View style={styles.handleBar} />
          <Animated.View style={handleIndicatorStyle}>
            <Ionicons name="chevron-up" size={20} color={theme.textSecondary} />
          </Animated.View>
        </View>
      </GestureDetector>
      
      {/* Moving Route Banner */}
      {movingRoute && (
        <View style={styles.movingBanner}>
          <Text style={styles.movingBannerText}>📍 לחץ על המיקום החדש במפה</Text>
          <TouchableOpacity onPress={onCancelMove} style={styles.cancelMoveButton}>
            <Text style={styles.cancelMoveButtonText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Bar */}
      <View style={styles.filterBarContainer}>
        <View style={styles.filterBarWithActions}>
          <View style={styles.filterBarLeft}>
            <FiltersBar
              routeCount={totalRouteCount}
              visibleCount={visibleRouteCount}
              sortBy={sortBy}
              onSortChange={onSortChange}
            />
          </View>
          <View style={styles.filterBarRight}>
            {canAccessEditMode && onOpenArchive && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onOpenArchive}
              >
                <Ionicons name="trash-outline" size={18} color={theme.text} />
              </TouchableOpacity>
            )}
            {canAccessEditMode && onToggleEditMode && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  editModeEnabled && styles.actionButtonActive
                ]}
                onPress={onToggleEditMode}
              >
                <Ionicons 
                  name={editModeEnabled ? "checkmark" : "pencil"} 
                  size={18} 
                  color={editModeEnabled ? '#fff' : theme.text} 
                />
              </TouchableOpacity>
            )}
            {editModeEnabled && onAddRoute && (
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={onAddRoute}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      
      {/* Routes List */}
      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>טוען...</Text>
          </View>
        ) : (
          <RoutesList
            routes={routes}
            visibleRouteIds={visibleRouteIds}
            onRoutePress={onRoutePress}
            onRouteLongPress={editModeEnabled ? onRouteLongPress : undefined}
          />
        )}
      </View>
    </Animated.View>
  );
}

const createStyles = (theme: any, insets: { bottom: number }) => {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 20,
      overflow: 'hidden',
    },
    handleContainer: {
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    handleBar: {
      width: 40,
      height: 4,
      backgroundColor: theme.textSecondary,
      borderRadius: 2,
      marginBottom: 4,
    },
    filterBarContainer: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    filterBarWithActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    filterBarLeft: {
      flex: 1,
    },
    filterBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonActive: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    addButton: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    movingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(33, 150, 243, 0.95)',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    movingBannerText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600',
    },
    cancelMoveButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    cancelMoveButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600',
    },
    listContainer: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 16,
    },
  });
};
