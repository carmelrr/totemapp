import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  useWindowDimensions,
  ScrollView,
  Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Theme
import { useTheme } from '@/features/theme/ThemeContext';
import { BrandLogo } from '@/components/ui/BrandLogo';

// Responsive Layout Hook
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

// New Architecture Components
import WallMap, { WallMapRef } from '../../../components/WallMap/WallMap';
import { FiltersBar, FiltersSheet } from '../../../components/Filters';
import { RoutesList } from '../../../components/Lists';
import type { SortOption } from '../../../components/Filters/FiltersBar';

import RouteBottomSheet from '../components/RouteBottomSheet';
import RouteEditModal from '../components/RouteEditModal';
import DraggableRoutesPanel from '../components/DraggableRoutesPanel';
import InlineAddRoutePanel from '../components/InlineAddRoutePanel';

// Store and Hooks
import { useFiltersStore, filterRoutes } from '../../../store/useFiltersStore';
import { useRouteNavigationStore } from '../../../store/useRouteNavigationStore';
import { useFirebaseRoutes } from '../hooks/useFirebaseRoutes';

// Language
import { useLanguage } from '@/features/language';

// Admin Context and Roles
import { useAdmin } from '../../../context/AdminContext';
import { useRolesContext } from '../../../features/roles';

import { useUserRouteStatus } from '@/hooks/useUserRouteStatus';

// Wall Editor - Dynamic walls
import { usePublishedRooms, WallSelector } from '@/features/wall-editor';
import type { Sector } from '@/features/wall-editor/types';

// Types
import { RouteDoc, MapTransforms } from '../types/route';
import { RoutesService } from '../services/RoutesService';
import { snapNormToNearestWall } from '@/utils/snapToWall';

type RootStackParamList = {
  RoutesMap: undefined;
  AddRoute: undefined;
  RoutesArchive: undefined;
  RouteDetails: {
    route: any;
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoutesMap'>;

/**
 * RoutesMapScreen עם האדריכלות החדשה
 * משתמש ב-WallMap, FiltersBar, RoutesList ו-Zustand store
 * עם תמיכה לחזרה מדורגת בתאימות לקומפוננטים הישנים
 * תומך ב-Landscape וב-Portrait עם layout אדפטיבי
 */
export default function RoutesMapScreen() {
  const navigation = useNavigation<NavigationProp>();
  
  // Theme
  const { theme } = useTheme();
  
  // Language
  const { t } = useLanguage();
  
  // Safe area insets for handling Android navigation bar
  const insets = useSafeAreaInsets();
  
  // Responsive Layout - automatically updates on rotation
  const layout = useResponsiveLayout();
  const { isLandscape, isTablet, isPhoneLandscape, mapLayoutMode, width, height, scaleFactor } = layout;
  
  // Admin Mode (for full admins)
  const { isAdmin, adminModeEnabled, setAdminModeEnabled } = useAdmin();
  
  // Roles Context - includes route_setter permission
  const { canEditRoutes, isRouteSetter } = useRolesContext();
  
  // Edit mode is enabled when:
  // 1. Admin has toggled admin mode ON, OR
  // 2. Route setter is logged in (they can always edit)
  // We use a local state for route setters to toggle their edit mode
  const [routeSetterEditMode, setRouteSetterEditMode] = useState(false);
  
  // Combined edit mode: admin mode OR route setter edit mode
  const editModeEnabled = adminModeEnabled || (isRouteSetter && routeSetterEditMode);
  
  // Can user access edit mode at all?
  const canAccessEditMode = isAdmin || canEditRoutes;
  
  // Toggle edit mode based on user type
  const toggleEditMode = useCallback(() => {
    if (isAdmin) {
      setAdminModeEnabled(!adminModeEnabled);
    } else if (canEditRoutes) {
      setRouteSetterEditMode(!routeSetterEditMode);
    }
  }, [isAdmin, adminModeEnabled, setAdminModeEnabled, canEditRoutes, routeSetterEditMode]);
  
  // UI State
  const [selectedRoute, setSelectedRoute] = useState<RouteDoc | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteDoc | null>(null);
  const [movingRoute, setMovingRoute] = useState<RouteDoc | null>(null); // Route being moved
  const [addingRoute, setAddingRoute] = useState(false); // Inline add route mode
  const [addingPhase, setAddingPhase] = useState<'placing' | 'details'>('placing');
  const [addingCoordinates, setAddingCoordinates] = useState<{ xNorm: number; yNorm: number } | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'split'>('split');
  const [mapFrameSize, setMapFrameSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [sortBy, setSortBy] = useState<SortOption>('grade-asc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1); // For zoom slider
  const currentZoomRef = useRef(1); // Ref to avoid re-renders during gesture
  // Store last received transform values so we can re-compute viewport bounds
  // when mapFrameSize changes, using actual zoom/pan instead of hardcoded defaults.
  const lastTransformRef = useRef({ scale: 1, translateX: 0, translateY: 0 });
  const [headerHeight, setHeaderHeight] = useState(insets.top + 46); // Dynamic header height

  // Shared value for panel height — used by the DraggableRoutesPanel
  const panelHeightSV = useSharedValue(height * 0.45);

  // Shared value for current zoom level — drives the map constraint animation
  const zoomScaleSV = useSharedValue(1);

  // Zoom threshold: free the map from the panel constraint almost immediately
  // when zooming. This ensures the user can navigate freely.
  const ZOOM_FREE_THRESHOLD = 1.05;

  // Animated style: constrain map between header and panel when not zoomed,
  // let it extend behind the panel when zoomed in past threshold
  const mapAnimatedStyle = useAnimatedStyle(() => {
    const bottomValue = interpolate(
      zoomScaleSV.value,
      [ZOOM_FREE_THRESHOLD * 0.9, ZOOM_FREE_THRESHOLD],
      [panelHeightSV.value, 0],
      Extrapolation.CLAMP
    );
    return { bottom: bottomValue };
  });

  // Active sector filtering - when a sector label is pressed
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  
  // Ref for WallMap zoom control
  const wallMapRef = useRef<WallMapRef>(null);
  
  // Sort options for modal
  const sortOptions = useMemo(() => [
    { value: 'grade-asc' as SortOption, label: t.common.gradeEasyToHard, icon: 'trending-up-outline' },
    { value: 'grade-desc' as SortOption, label: t.common.gradeHardToEasy, icon: 'trending-down-outline' },
    { value: 'popularity' as SortOption, label: t.common.mostPopular, icon: 'trophy-outline' },
    { value: 'most-repeats' as SortOption, label: t.common.mostRepeats, icon: 'repeat-outline' },
  ], [t]);
  
  // Data
  const { routes, isLoading, error } = useFirebaseRoutes();
  
  // Published rooms (dynamic wall maps)
  const { rooms: publishedRooms, loading: roomsLoading, refresh: refreshRooms } = usePublishedRooms({
    includeHidden: isAdmin && adminModeEnabled,
  });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // Auto-select first published room
  useEffect(() => {
    if (publishedRooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(publishedRooms[0].id);
    }
  }, [publishedRooms, selectedRoomId]);

  // Reset sector filter when changing rooms
  useEffect(() => {
    setActiveSectorId(null);
  }, [selectedRoomId]);
  
  // Get currently selected room
  const selectedRoom = useMemo(() => {
    return publishedRooms.find(r => r.id === selectedRoomId) || null;
  }, [publishedRooms, selectedRoomId]);
  
  // Create styles with theme, layout, insets, and room background color
  const styles = useMemo(() => createStyles(theme, layout, insets, selectedRoom?.backgroundColor), [theme, layout, insets, selectedRoom?.backgroundColor]);
  
  // User's route status for completion filtering
  const { userRouteData } = useUserRouteStatus();
  
  // Create a set of completed route IDs for filtering
  const completedRouteIds = useMemo(() => {
    const completedIds = new Set<string>();
    Object.entries(userRouteData).forEach(([routeId, data]) => {
      if (data.status === 'sent' || data.status === 'flashed') {
        completedIds.add(routeId);
      }
    });
    return completedIds;
  }, [userRouteData]);
  
  // Filters Store — use selectors for stable references
  const filters = useFiltersStore(state => state.filters);
  const sorting = useFiltersStore(state => state.sorting);
  const searchQuery = useFiltersStore(state => state.searchQuery);

  // Filtered routes based on current filters (uses standalone filterRoutes for stable deps)
  const filteredRoutes = useMemo(() => {
    return filterRoutes(routes, filters, sorting, searchQuery, undefined, completedRouteIds);
  }, [routes, filters, sorting, searchQuery, completedRouteIds]);

  // Get the currently active sector object
  const activeSector = useMemo(() => {
    if (!activeSectorId || !selectedRoom?.sectors) return null;
    return selectedRoom.sectors.find(s => s.id === activeSectorId) || null;
  }, [activeSectorId, selectedRoom?.sectors]);

  // Routes filtered by active sector bounds (if a sector is selected)
  const sectorFilteredRoutes = useMemo(() => {
    if (!activeSector || !selectedRoom) return filteredRoutes;
    
    const { bounds } = activeSector;
    // Convert sector bounds (room coordinates) to normalized coordinates (0-1)
    const leftN = bounds.x / selectedRoom.width;
    const rightN = (bounds.x + bounds.width) / selectedRoom.width;
    const topN = bounds.y / selectedRoom.height;
    const bottomN = (bounds.y + bounds.height) / selectedRoom.height;
    
    return filteredRoutes.filter(route => 
      route.xNorm >= leftN &&
      route.xNorm <= rightN &&
      route.yNorm >= topN &&
      route.yNorm <= bottomN
    );
  }, [filteredRoutes, activeSector, selectedRoom]);

  // Helper function to extract numeric grade value for sorting
  // Uses calculatedGrade (community consensus) if available, otherwise original grade
  const getGradeValue = useCallback((route: RouteDoc): number => {
    const grade = route.calculatedGrade || route.grade;
    if (!grade) return 0;
    // Extract number from grade string (e.g., "V6" -> 6, "V13" -> 13)
    const match = grade.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }, []);

  // Sort function for routes
  const sortRoutes = useCallback((routesToSort: RouteDoc[]): RouteDoc[] => {
    return [...routesToSort].sort((a, b) => {
      switch (sortBy) {
        case 'grade-asc':
          // Sort by community grade (calculatedGrade) if available, otherwise original
          return getGradeValue(a) - getGradeValue(b);
        case 'grade-desc':
          return getGradeValue(b) - getGradeValue(a);
        case 'popularity':
          // Sort by average star rating (highest first)
          return (b.averageStarRating || 0) - (a.averageStarRating || 0);
        case 'most-repeats':
          // Sort by completion count (most repeats first)
          return (b.completionCount || 0) - (a.completionCount || 0);
        default:
          return 0;
      }
    });
  }, [sortBy, getGradeValue]);

  // Viewport bounds for visible routes (normalized 0-1)
  const [viewportBounds, setViewportBounds] = useState({ 
    leftN: 0, 
    rightN: 1, 
    topN: 0, 
    bottomN: 1 
  });

  // Routes visible in the current viewport (sorted)
  // Uses filteredRoutes (not sector-filtered) so panning reveals routes from other sectors
  const visibleRoutes = useMemo(() => {
    let routesToShow: RouteDoc[];
    
    // Use all filtered routes as the base (sector selection only zooms, doesn't filter)
    const baseRoutes = filteredRoutes;
    
    if (viewMode === 'list') {
      // In list mode, show all filtered routes
      routesToShow = baseRoutes;
    } else {
      // Filter routes by viewport bounds
      routesToShow = baseRoutes.filter(route => (
        route.xNorm >= viewportBounds.leftN &&
        route.xNorm <= viewportBounds.rightN &&
        route.yNorm >= viewportBounds.topN &&
        route.yNorm <= viewportBounds.bottomN
      ));
    }

    // Apply sorting
    return sortRoutes(routesToShow);
  }, [filteredRoutes, viewportBounds, viewMode, sortRoutes]);

  // Stable ID list for the routes panel (avoids new array reference on every render)
  const visibleRouteIds = useMemo(
    () => visibleRoutes.map(r => r.id),
    [visibleRoutes]
  );

  // Routes for the MAP layer — pass all filtered routes so circles don't "pop in"
  // when panning. RouteCircle components are already React.memo'd with custom
  // comparison, so rendering off-screen circles has negligible cost compared to
  // the visual glitch of delayed viewport filtering.
  const mapVisibleRoutes = filteredRoutes;

  // Keep a ref to visibleRoutes so handleRoutePress doesn't need it as a dependency
  const visibleRoutesRef = useRef(visibleRoutes);
  visibleRoutesRef.current = visibleRoutes;

  // Route data map builder for swipe navigation
  const buildRouteDataMap = useCallback((routes: RouteDoc[]): Record<string, any> => {
    const map: Record<string, any> = {};
    for (const r of routes) {
      map[r.id] = {
        id: r.id,
        name: r.name,
        nameHe: r.nameHe,
        nameEn: r.nameEn,
        grade: r.grade,
        color: r.color,
        difficulty: r.grade,
        description: `מסלול ${r.name} ברמת קושי ${r.grade}`,
        coordinates: { x: r.xNorm, y: r.yNorm },
        createdAt: r.createdAt?.toDate ? r.createdAt.toDate().toISOString() :
                   r.createdAt instanceof Date ? r.createdAt.toISOString() :
                   new Date().toISOString(),
        createdBy: r.setter || 'system',
        wallId: 'default-wall',
        averageStarRating: r.averageStarRating || 0,
        calculatedGrade: r.calculatedGrade || null,
        feedbackCount: r.feedbackCount || 0,
        completionCount: r.completionCount || 0,
      };
    }
    return map;
  }, []);

  const setNavigationList = useRouteNavigationStore((s) => s.setNavigationList);

  // Handlers
  const handleRoutePress = useCallback((route: RouteDoc) => {
    // In edit mode, open edit modal instead of navigating
    if (editModeEnabled) {
      setEditingRoute(route);
      setShowEditModal(true);
      return;
    }

    // Set route list for swipe navigation (use visibleRoutes which has filters+sort applied)
    const currentVisibleRoutes = visibleRoutesRef.current;
    const routeDataMap = buildRouteDataMap(currentVisibleRoutes);
    setNavigationList(currentVisibleRoutes.map(r => r.id), routeDataMap);
    
    navigation.navigate('RouteDetails', { 
      route: routeDataMap[route.id] || {
        id: route.id,
        name: route.name,
        nameHe: route.nameHe,
        nameEn: route.nameEn,
        grade: route.grade,
        color: route.color,
        difficulty: route.grade,
        description: `מסלול ${route.name} ברמת קושי ${route.grade}`,
        coordinates: {
          x: route.xNorm,
          y: route.yNorm,
        },
        createdAt: route.createdAt?.toDate ? route.createdAt.toDate().toISOString() : 
                   route.createdAt instanceof Date ? route.createdAt.toISOString() :
                   new Date().toISOString(),
        createdBy: route.setter || 'system',
        wallId: 'default-wall',
        averageStarRating: route.averageStarRating || 0,
        calculatedGrade: route.calculatedGrade || null,
        feedbackCount: route.feedbackCount || 0,
        completionCount: route.completionCount || 0,
      }
    });
  }, [navigation, editModeEnabled, buildRouteDataMap, setNavigationList]);

  const handleRouteLongPress = useCallback((route: RouteDoc) => {
    // Long press opens edit modal only if edit mode is enabled
    // User must have edit permissions AND have activated edit mode
    if (editModeEnabled) {
      setEditingRoute(route);
      setShowEditModal(true);
    }
  }, [editModeEnabled]);

  const handleEditModalClose = useCallback(() => {
    setShowEditModal(false);
    setEditingRoute(null);
  }, []);

  const handleEditModalSave = useCallback(() => {
    // Routes will refresh automatically from Firebase listener
    setShowEditModal(false);
    setEditingRoute(null);
  }, []);

  const handleEditModalDelete = useCallback(() => {
    // Routes will refresh automatically from Firebase listener
    setShowEditModal(false);
    setEditingRoute(null);
  }, []);

  // Start moving a route - called from RouteEditModal
  const handleStartMoveRoute = useCallback((route: RouteDoc) => {
    try {
      setMovingRoute(route);
      Alert.alert(
        'הזזת מסלול',
        'לחץ על המיקום החדש במפה',
        [{ text: 'הבנתי', style: 'default' }]
      );
    } catch (error) {
      console.error('📍 Error in handleStartMoveRoute:', error);
    }
  }, []);

  // Handle tap on map to place moved route OR new route
  const handleMapTap = useCallback(async (coordinates: { xImg: number; yImg: number }) => {
    // Validate coordinates
    if (typeof coordinates.xImg !== 'number' || typeof coordinates.yImg !== 'number' ||
        isNaN(coordinates.xImg) || isNaN(coordinates.yImg)) {
      console.error('📍 Invalid coordinates received:', coordinates);
      return;
    }
    
    // Wall dimensions for aspect ratio calculation
    const wallWidth = selectedRoom?.width || 2560;
    const wallHeight = selectedRoom?.height || 1600;
    const wallAspectRatio = wallHeight / wallWidth;
    
    // Calculate actual image dimensions based on container and aspect ratio
    const containerWidth = mapFrameSize.width || 377;
    const containerHeight = mapFrameSize.height || 236;
    
    let imageWidth = containerWidth;
    let imageHeight = containerWidth * wallAspectRatio;
    
    if (imageHeight > containerHeight) {
      imageHeight = containerHeight;
      imageWidth = containerHeight / wallAspectRatio;
    }
    
    const clampedXImg = Math.max(0, Math.min(imageWidth, coordinates.xImg));
    const clampedYImg = Math.max(0, Math.min(imageHeight, coordinates.yImg));
    
    const xNorm = clampedXImg / imageWidth;
    const yNorm = clampedYImg / imageHeight;

    if (isNaN(xNorm) || isNaN(yNorm)) {
      console.error('📍 Invalid normalized coordinates:', { xNorm, yNorm });
      return;
    }

    let clampedX = Math.max(0, Math.min(1, xNorm));
    let clampedY = Math.max(0, Math.min(1, yNorm));

    // Snap to nearest wall point
    if (selectedRoom) {
      const snapped = snapNormToNearestWall(clampedX, clampedY, selectedRoom);
      if (snapped.snapped) {
        clampedX = snapped.xNorm;
        clampedY = snapped.yNorm;
      }
    }

    // Handle adding mode - capture coordinates and switch to details phase
    if (addingRoute) {
      setAddingCoordinates({ xNorm: clampedX, yNorm: clampedY });
      setAddingPhase('details');
      return;
    }

    // Handle moving mode
    if (!movingRoute) return;

    try {
      await RoutesService.updateRoute(movingRoute.id, {
        xNorm: clampedX,
        yNorm: clampedY,
      });
      Alert.alert(t.common.success, t.alerts.routeMoved);
    } catch (error) {
      console.error('📍 Error moving route:', error);
      Alert.alert(t.common.error, t.alerts.routeMoveFailed);
    } finally {
      setMovingRoute(null);
    }
  }, [movingRoute, addingRoute, mapFrameSize, selectedRoom]);

  // Cancel moving route
  const handleCancelMove = useCallback(() => {
    setMovingRoute(null);
  }, []);

  // Cancel adding route
  const handleCancelAdd = useCallback(() => {
    setAddingRoute(false);
    setAddingPhase('placing');
    setAddingCoordinates(null);
  }, []);

  // Save added route - called from InlineAddRoutePanel
  const handleAddRouteSaved = useCallback(() => {
    setAddingRoute(false);
    setAddingPhase('placing');
    setAddingCoordinates(null);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setShowBottomSheet(false);
    setSelectedRoute(null);
  }, []);

  const handleMarkTop = useCallback(async (route: RouteDoc) => {
    try {
      await RoutesService.incrementTops(route.id);
      Alert.alert(t.common.success, t.alerts.routeMarkedTop);
    } catch (error) {
      Alert.alert(t.common.error, t.alerts.routeMarkFailed);
    }
  }, []);

  const handleRate = useCallback(async (route: RouteDoc, rating: number) => {
    try {
      await RoutesService.updateRoute(route.id, { rating });
      Alert.alert(t.common.success, t.alerts.routeRated);
    } catch (error) {
      Alert.alert(t.common.error, t.alerts.routeRateFailed);
    }
  }, []);

  const handleShare = useCallback((route: RouteDoc) => {
    Alert.alert(t.alerts.shareTitle, t.alerts.shareRoute(route.name));
  }, []);

  const handleReport = useCallback((route: RouteDoc) => {
    Alert.alert(t.alerts.reportTitle, t.alerts.reportRoute(route.name));
  }, []);

  const handleAddRoute = useCallback(() => {
    setAddingRoute(true);
    setAddingPhase('placing');
    setAddingCoordinates(null);
  }, []);

  const handleOpenArchive = useCallback(() => {
    navigation.navigate('RoutesArchive' as any);
  }, [navigation]);

  const handleTransformChange = useCallback((transform: { scale: number; translateX: number; translateY: number }) => {
    // Store latest transform so we can re-use it when mapFrameSize changes
    lastTransformRef.current = transform;

    // Update zoom shared value for the map constraint animation
    zoomScaleSV.value = transform.scale;

    const containerWidth = mapFrameSize.width || 0;
    const containerHeight = mapFrameSize.height || 0;
    
    // Update zoom slider state only when it changes meaningfully (avoids re-renders during gesture)
    if (Math.abs(currentZoomRef.current - transform.scale) > 0.05) {
      currentZoomRef.current = transform.scale;
      setCurrentZoom(transform.scale);
    }
    
    if (containerWidth <= 0 || containerHeight <= 0) {
      return;
    }

    const { scale, translateX, translateY } = transform;
    
    // Wall map dimensions - use selected room or default SVG dimensions
    const wallWidth = selectedRoom?.width || 2560;
    const wallHeight = selectedRoom?.height || 1600;
    const wallAspectRatio = wallHeight / wallWidth;

    // Calculate how the image fits within the container (object-fit: contain)
    // This must match the calculation in WallMap.tsx
    let imageWidth = containerWidth;
    let imageHeight = containerWidth * wallAspectRatio;

    if (imageHeight > containerHeight) {
      imageHeight = containerHeight;
      imageWidth = containerHeight / wallAspectRatio;
    }

    // Image center for transform calculations
    const imgCenterX = imageWidth / 2;
    const imgCenterY = imageHeight / 2;
    
    // Transform model (matching useMapTransforms):
    // With transform order [translate, scale], scale happens around the image center.
    // screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
    // To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
    
    // Calculate visible portion in image coordinates
    // Left edge of viewport (screenX = 0):
    const leftImg = Math.max(0, Math.min(imageWidth, (0 - imgCenterX - translateX) / scale + imgCenterX));
    // Top edge of viewport (screenY = 0):
    const topImg = Math.max(0, Math.min(imageHeight, (0 - imgCenterY - translateY) / scale + imgCenterY));
    // Right edge of viewport (screenX = containerWidth):
    const rightImg = Math.max(0, Math.min(imageWidth, (containerWidth - imgCenterX - translateX) / scale + imgCenterX));
    // Bottom edge of viewport (screenY = containerHeight):
    const bottomImg = Math.max(0, Math.min(imageHeight, (containerHeight - imgCenterY - translateY) / scale + imgCenterY));
    
    // Convert to normalized coordinates (0-1)
    let leftN = leftImg / imageWidth;
    let rightN = rightImg / imageWidth;
    let topN = topImg / imageHeight;
    let bottomN = bottomImg / imageHeight;

    // Add padding for route circles (so partially visible routes are included)
    const safeScale = Math.max(0.1, scale);
    const circleSizeScreen = Math.max(24, 32 / Math.sqrt(safeScale));
    const radiusInImageCoords = (circleSizeScreen / 2) / scale;
    const padXN = radiusInImageCoords / imageWidth;
    const padYN = radiusInImageCoords / imageHeight;

    // Apply padding and clamp to [0, 1]
    const newBounds = {
      leftN: Math.max(0, Math.min(1, leftN - padXN)),
      rightN: Math.max(0, Math.min(1, rightN + padXN)),
      topN: Math.max(0, Math.min(1, topN - padYN)),
      bottomN: Math.max(0, Math.min(1, bottomN + padYN))
    };

    setViewportBounds(prev => {
      const changed =
        Math.abs(prev.leftN - newBounds.leftN) > 0.005 ||
        Math.abs(prev.rightN - newBounds.rightN) > 0.005 ||
        Math.abs(prev.topN - newBounds.topN) > 0.005 ||
        Math.abs(prev.bottomN - newBounds.bottomN) > 0.005;
      return changed ? newBounds : prev;
    });
  }, [mapFrameSize.width, mapFrameSize.height, selectedRoom]);

  // Recalculate viewport bounds when map frame size changes.
  // Uses the last known transform values (actual zoom/pan) so viewport bounds
  // stay correct when the DraggableRoutesPanel is dragged.
  useEffect(() => {
    if (mapFrameSize.width > 0 && mapFrameSize.height > 0) {
      handleTransformChange(lastTransformRef.current);
    }
  }, [mapFrameSize.width, mapFrameSize.height, handleTransformChange]);

  // Stable WallMap callback props — prevent WallMap re-renders when unrelated state changes
  const wallMapRoutePress = useMemo(
    () => (movingRoute || addingRoute) ? undefined : handleRoutePress,
    [movingRoute, addingRoute, handleRoutePress]
  );
  const wallMapRouteLongPress = useMemo(
    () => (movingRoute || addingRoute) ? undefined : (editModeEnabled ? handleRouteLongPress : undefined),
    [movingRoute, addingRoute, editModeEnabled, handleRouteLongPress]
  );
  const wallMapTap = useMemo(
    () => (movingRoute || (addingRoute && addingPhase === 'placing')) ? handleMapTap : undefined,
    [movingRoute, addingRoute, addingPhase, handleMapTap]
  );
  const wallMapSelectedRouteId = useMemo(
    () => movingRoute?.id || selectedRoute?.id,
    [movingRoute?.id, selectedRoute?.id]
  );
  const wallMapShowSectorLabels = useMemo(
    () => currentZoom <= 1.8 && !addingRoute,
    [currentZoom, addingRoute]
  );

  const handleDebug = useCallback(() => {
    Alert.alert(
      'מידע דיבוג',
      `מסלולים נטענו: ${routes.length}\n` +
      `טוען: ${isLoading}\n` +
      `שגיאה: ${error ? error.message : 'אין'}\n` +
      `מסלולים מסוננים: ${filteredRoutes.length}\n` +
      `מסלולים בתחום ראייה: ${visibleRoutes.length}\n` +
      `תחום ראייה: ${JSON.stringify({
        left: viewportBounds.leftN.toFixed(2),
        right: viewportBounds.rightN.toFixed(2),
        top: viewportBounds.topN.toFixed(2),
        bottom: viewportBounds.bottomN.toFixed(2)
      })}`
    );
  }, [routes, isLoading, error, filteredRoutes, visibleRoutes, viewportBounds]);

  const availableColors = useMemo(() => {
    // Only consider active routes for available colors (exclude archived)
    const activeRoutes = routes.filter(route => route.status !== 'archived');
    const colors = new Set(activeRoutes.map(route => route.color).filter(Boolean));
    return Array.from(colors);
  }, [routes]);

  const availableGrades = useMemo(() => {
    // Only consider active routes for available grades (exclude archived)
    const activeRoutes = routes.filter(route => route.status !== 'archived');
    const grades = new Set(activeRoutes.map(route => route.grade).filter(Boolean));
    return Array.from(grades).sort();
  }, [routes]);

  // חילוץ תאריכים ייחודיים מהמסלולים בפורמט YYYY-MM-DD
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    // Only consider active routes for available dates (exclude archived)
    const activeRoutes = routes.filter(route => route.status !== 'archived');
    activeRoutes.forEach(route => {
      if (route.createdAt) {
        const date = route.createdAt.toDate ? route.createdAt.toDate() : new Date(route.createdAt);
        const dateStr = date.toISOString().split('T')[0]; // פורמט YYYY-MM-DD
        dates.add(dateStr);
      }
    });
    // מיון מהחדש לישן
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [routes]);
  
  // הודעה כשאין מסלולים בתחום הראייה
  const renderEmptyMessage = () => {
    if (visibleRoutes.length === 0 && !isLoading && filteredRoutes.length > 0) {
      return (
        <View style={styles.emptyMessageContainer}>
          <Text style={styles.emptyMessageText}>
            אין מסלולים בתחום הנראה
          </Text>
          <Text style={styles.emptyMessageSubtext}>
            נסו להזיז או להקטין את המפה
          </Text>
        </View>
      );
    }
    return null;
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>שגיאה בטעינת מסלולים: {error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => console.log('Retry requested')}>
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderMapView = () => {
    // If no room is available, show a message
    if (!selectedRoom) {
      return (
        <View style={styles.loadingMapContainer}>
          <Text style={{color: '#ffffff', fontSize: 16}}>טוען מפה...</Text>
        </View>
      );
    }
    
    return (
      <View style={[styles.mapViewContainer, {aspectRatio: selectedRoom.width / selectedRoom.height}]}>
        <WallMap
          ref={wallMapRef}
          routes={mapVisibleRoutes}
          onRoutePress={wallMapRoutePress}
          onRouteLongPress={wallMapRouteLongPress}
          onMapTap={wallMapTap}
          selectedRouteId={wallMapSelectedRouteId}
          wallWidth={selectedRoom.width}
          wallHeight={selectedRoom.height}
          onTransformChange={handleTransformChange}
          gesturesEnabled={true}
          room={selectedRoom}
          showSectorLabels={wallMapShowSectorLabels}
          onSectorPress={handleSectorPress}
          activeSectorId={activeSectorId}
        />
      </View>
    );
  };

  // Handler for sector label press - toggle sector filtering and zoom
  const handleSectorPress = useCallback((sector: Sector) => {
    setActiveSectorId(prev => {
      if (prev === sector.id) {
        // Deselect - pressing the same sector again removes the filter
        return null;
      } else {
        // Select this sector and zoom to it
        wallMapRef.current?.zoomToSector(sector.bounds);
        return sector.id;
      }
    });
  }, []);

  const renderFullMapView = () => {
    return (
    <View style={styles.mapSectionContainer}>
      <View style={styles.mapFrame}>
        <View
          style={styles.mapClip}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setMapFrameSize({ width, height });
          }}
        >
          {renderMapView()}
        </View>
      </View>
      
      <View style={styles.filterBarContainer}>
        <FiltersBar
          routeCount={filteredRoutes.length}
          visibleCount={visibleRoutes.length}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </View>
    </View>
  );
  };

  const renderListView = () => {
    return (
      <RoutesList
        routes={visibleRoutes}
        visibleRouteIds={visibleRouteIds}
        onRoutePress={movingRoute ? undefined : handleRoutePress}
        onRouteLongPress={movingRoute ? undefined : (editModeEnabled ? handleRouteLongPress : undefined)}
      />
    );
  };  

  // Render landscape split view (map and list side by side) - for tablets
  const renderLandscapeSplitView = () => (
    <View style={styles.landscapeContainer}>
      {/* Map Section - Left side */}
      <View style={styles.landscapeMapSection}>
        <View style={styles.mapFrame}>
          <View
            style={styles.mapClip}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              setMapFrameSize({ width, height });
            }}
          >
            {renderMapView()}
          </View>
        </View>
      </View>
      
      {/* List Section - Right side */}
      <View style={styles.landscapeListSection}>
        <View style={styles.filterBarContainer}>
          <View style={styles.filterBarWithActions}>
            <View style={styles.filterBarLeft}>
              <FiltersBar
                routeCount={filteredRoutes.length}
                visibleCount={visibleRoutes.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            </View>
            <View style={styles.filterBarRight}>
              {canAccessEditMode && (
                <TouchableOpacity
                  style={styles.filterBarActionButton}
                  onPress={handleOpenArchive}
                >
                  <Text style={styles.filterBarActionIcon}>🗑️</Text>
                </TouchableOpacity>
              )}
              {canAccessEditMode && (
                <TouchableOpacity
                  style={[
                    styles.filterBarActionButton,
                    editModeEnabled && styles.filterBarActionButtonActive
                  ]}
                  onPress={toggleEditMode}
                >
                  <Text style={styles.filterBarActionIcon}>
                    {editModeEnabled ? '✓' : '✏️'}
                  </Text>
                </TouchableOpacity>
              )}
              {editModeEnabled && (
                <TouchableOpacity
                  style={[styles.filterBarActionButton, styles.filterBarAddButton]}
                  onPress={handleAddRoute}
                >
                  <Text style={styles.filterBarAddIcon}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        {isLoading && (
          <View style={styles.listHeader}>
            <Text style={styles.loadingText}>טוען...</Text>
          </View>
        )}
        {renderListView()}
      </View>
    </View>
  );

  // Render phone landscape split view - compact horizontal layout for phones
  const renderPhoneLandscapeSplitView = () => (
    <View style={styles.phoneLandscapeContainer}>
      {/* Map Section - Takes most of the width */}
      <View style={styles.phoneLandscapeMapSection}>
        <View style={styles.phoneLandscapeMapFrame}>
          <View
            style={styles.mapClip}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              setMapFrameSize({ width, height });
            }}
          >
            {renderMapView()}
          </View>
        </View>
      </View>
      
      {/* Compact List Section - Right panel */}
      <View style={styles.phoneLandscapeListSection}>
        {/* Action bar with filter/sort and edit buttons */}
        <View style={styles.phoneLandscapeActionBar}>
          {/* Left side: Route count, sort and filter */}
          <View style={styles.phoneLandscapeActionLeft}>
            <Text style={styles.phoneLandscapeCountText}>
              {visibleRoutes.length}/{filteredRoutes.length}
            </Text>
            {/* Sort button - opens modal like portrait */}
            <TouchableOpacity
              style={styles.phoneLandscapeActionButton}
              onPress={() => setShowSortModal(true)}
            >
              <Ionicons name="swap-vertical-outline" size={16} color={theme.primary} />
              <Text style={styles.phoneLandscapeButtonLabel}>{t.common.sort}</Text>
            </TouchableOpacity>
            {/* Filter button */}
            <TouchableOpacity
              style={styles.phoneLandscapeActionButton}
              onPress={() => useFiltersStore.getState().setFilterSheetOpen(true)}
            >
              <Ionicons name="funnel-outline" size={16} color={theme.textSecondary} />
              <Text style={styles.phoneLandscapeButtonLabel}>{t.common.filter}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Right side: Edit mode toggle and add button */}
          <View style={styles.phoneLandscapeActionRight}>
            {canAccessEditMode && (
              <TouchableOpacity
                style={styles.phoneLandscapeActionButton}
                onPress={handleOpenArchive}
              >
                <Text style={styles.phoneLandscapeActionIcon}>🗑️</Text>
              </TouchableOpacity>
            )}
            {canAccessEditMode && (
              <TouchableOpacity
                style={[
                  styles.phoneLandscapeActionButton,
                  editModeEnabled && styles.phoneLandscapeActionButtonActive
                ]}
                onPress={toggleEditMode}
              >
                <Text style={styles.phoneLandscapeActionIcon}>
                  {editModeEnabled ? '✓' : '✏️'}
                </Text>
              </TouchableOpacity>
            )}
            {editModeEnabled && (
              <TouchableOpacity
                style={[styles.phoneLandscapeActionButton, styles.phoneLandscapeAddButton]}
                onPress={handleAddRoute}
              >
                <Text style={styles.phoneLandscapeAddIcon}>+</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* Compact list for phone landscape */}
        <RoutesList
          routes={visibleRoutes}
          visibleRouteIds={visibleRouteIds}
          onRoutePress={movingRoute ? undefined : handleRoutePress}
          onRouteLongPress={movingRoute ? undefined : (editModeEnabled ? handleRouteLongPress : undefined)}
          compact={true}
        />
      </View>

      {/* Sort Modal for phone landscape */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity 
          style={styles.sortModalOverlay} 
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModalContent}>
            <Text style={styles.sortModalTitle}>{t.common.sort}</Text>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortModalOption,
                  sortBy === option.value && styles.sortModalOptionActive,
                ]}
                onPress={() => {
                  setSortBy(option.value);
                  setShowSortModal(false);
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={sortBy === option.value ? theme.primary : theme.textSecondary}
                />
                <Text style={[
                  styles.sortModalOptionText,
                  sortBy === option.value && styles.sortModalOptionTextActive,
                ]}>
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  // Render portrait split view (map on top, list below)
  const renderPortraitSplitView = () => (
    <>
      {/* Map Section with FiltersBar positioned below */}
      <View style={styles.mapSectionContainer}>
        {/* Fixed-frame container with visible border - map only */}
        <View style={styles.mapFrame}>
          {/* Inner clipping container that ensures proper overflow handling */}
          <View
            style={styles.mapClip}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              setMapFrameSize({ width, height });
            }}
          >
            {renderMapView()}
          </View>
        </View>
        
        {/* FiltersBar positioned below the map with integrated action buttons */}
        <View style={styles.filterBarContainer}>
          <View style={styles.filterBarWithActions}>
            <View style={styles.filterBarLeft}>
              <FiltersBar
                routeCount={filteredRoutes.length}
                visibleCount={visibleRoutes.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            </View>
            <View style={styles.filterBarRight}>
              {canAccessEditMode && (
                <TouchableOpacity
                  style={styles.filterBarActionButton}
                  onPress={handleOpenArchive}
                >
                  <Text style={styles.filterBarActionIcon}>🗑️</Text>
                </TouchableOpacity>
              )}
              {canAccessEditMode && (
                <TouchableOpacity
                  style={[
                    styles.filterBarActionButton,
                    editModeEnabled && styles.filterBarActionButtonActive
                  ]}
                  onPress={toggleEditMode}
                >
                  <Text style={styles.filterBarActionIcon}>
                    {editModeEnabled ? '✓' : '✏️'}
                  </Text>
                </TouchableOpacity>
              )}
              {editModeEnabled && (
                <TouchableOpacity
                  style={[styles.filterBarActionButton, styles.filterBarAddButton]}
                  onPress={handleAddRoute}
                >
                  <Text style={styles.filterBarAddIcon}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
      
      {/* List Section */}
      <View style={styles.listSection}>
        {isLoading && (
          <View style={styles.listHeader}>
            <Text style={styles.loadingText}>טוען...</Text>
          </View>
        )}
        {renderListView()}
      </View>
    </>
  );

  const renderSplitView = () => {
    // Use horizontal layout for tablets in landscape
    if (mapLayoutMode === 'horizontal') {
      return renderLandscapeSplitView();
    }
    // Use compact horizontal layout for phones in landscape
    if (mapLayoutMode === 'phone-landscape') {
      return renderPhoneLandscapeSplitView();
    }
    // Use vertical layout for portrait mode
    return renderPortraitSplitView();
  };

  // In phone landscape, we need to protect left/right edges from notches and home indicators
  const safeAreaEdges = isPhoneLandscape ? ['top', 'left', 'right', 'bottom'] as const : ['top'] as const;

  return (
    <View style={styles.fullScreenContainer}>
      {/* Map Container — constrained between header and panel when not zoomed,
           extends full height behind the panel when zoomed past threshold */}
      <Animated.View 
        style={[styles.fullScreenMap, { top: headerHeight }, mapAnimatedStyle]}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setMapFrameSize({ width, height });
        }}
      >
        {selectedRoom ? (
          <WallMap
            ref={wallMapRef}
            routes={mapVisibleRoutes}
            onRoutePress={wallMapRoutePress}
            onRouteLongPress={wallMapRouteLongPress}
            onMapTap={wallMapTap}
            selectedRouteId={wallMapSelectedRouteId}
            wallWidth={selectedRoom.width}
            wallHeight={selectedRoom.height}
            onTransformChange={handleTransformChange}
            gesturesEnabled={true}
            room={selectedRoom}
            showSectorLabels={wallMapShowSectorLabels}
            onSectorPress={handleSectorPress}
            activeSectorId={activeSectorId}
          />
        ) : (
          <View style={styles.fullScreenLoadingContainer}>
            <Text style={{color: '#ffffff', fontSize: 16}}>טוען מפה...</Text>
          </View>
        )}
      </Animated.View>

      {/* Floating Header */}
      <SafeAreaView 
        style={styles.floatingHeader} 
        edges={['top']}
        onLayout={e => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setHeaderHeight(h);
        }}
      >
        <View style={styles.headerContent}>
          <BrandLogo variant="icon" color="white" size={24} />
          <Text style={styles.compactHeaderTitle}>מפת הקיר</Text>
          
          {/* Wall Selector - shows when there are published rooms */}
          {publishedRooms.length > 0 && (
            <WallSelector
              rooms={publishedRooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
              isAdmin={isAdmin && adminModeEnabled}
              onRefresh={refreshRooms}
              onEditRoom={isAdmin ? (roomId) => {
                navigation.navigate('WallEditor' as any, { roomId });
              } : undefined}
            />
          )}
        </View>
      </SafeAreaView>

      {/* Draggable Routes Panel or Inline Add Route Panel */}
      {addingRoute ? (
        <InlineAddRoutePanel
          phase={addingPhase}
          coordinates={addingCoordinates}
          onSave={handleAddRouteSaved}
          onCancel={handleCancelAdd}
        />
      ) : (
        <DraggableRoutesPanel
          routes={visibleRoutes}
          visibleRouteIds={visibleRouteIds}
          totalRouteCount={filteredRoutes.length}
          visibleRouteCount={visibleRoutes.length}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onRoutePress={movingRoute ? undefined : handleRoutePress}
          onRouteLongPress={movingRoute ? undefined : handleRouteLongPress}
          editModeEnabled={editModeEnabled}
          canAccessEditMode={canAccessEditMode}
          onToggleEditMode={toggleEditMode}
          onAddRoute={handleAddRoute}
          onOpenArchive={handleOpenArchive}
          isLoading={isLoading}
          movingRoute={!!movingRoute}
          onCancelMove={handleCancelMove}
          panelHeightSV={panelHeightSV}
        />
      )}

      {/* Filters Sheet */}
      <FiltersSheet
        availableColors={availableColors}
        availableGrades={availableGrades}
        availableDates={availableDates}
      />

      {/* Route Bottom Sheet (Legacy) */}
      <RouteBottomSheet
        visible={showBottomSheet}
        route={selectedRoute}
        onClose={handleCloseBottomSheet}
        onMarkTop={handleMarkTop}
        onRate={handleRate}
        onShare={handleShare}
        onReport={handleReport}
      />

      {/* Admin Edit Modal */}
      <RouteEditModal
        visible={showEditModal}
        route={editingRoute}
        onClose={handleEditModalClose}
        onSave={handleEditModalSave}
        onDelete={handleEditModalDelete}
        onMoveRoute={handleStartMoveRoute}
      />
    </View>
  );
}

const createStyles = (
  theme: any, 
  layout: ReturnType<typeof useResponsiveLayout>,
  insets: { top: number; bottom: number; left: number; right: number },
  roomBackgroundColor: string = '#1a1a2e' // Default room background
) => {
  const { isLandscape, isTablet, mapLayoutMode, width, height, scaleFactor } = layout;
  
  // Calculate safe padding for right side (Android navigation bar in landscape)
  const rightInset = Math.max(insets.right, 8);
  const bottomInset = Math.max(insets.bottom, 8);
  
  return StyleSheet.create({
    // New full-screen layout styles
    fullScreenContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    fullScreenMap: {
      position: 'absolute',
      // top is set dynamically via inline style
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: roomBackgroundColor,
    },
    fullScreenLoadingContainer: {
      flex: 1,
      backgroundColor: roomBackgroundColor,
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: theme.headerGradient || '#111',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'transparent',
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    // Original styles kept for backwards compatibility
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    compactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.headerGradient,
      paddingVertical: layout.isLandscape && !isTablet ? 6 : 10,
      paddingHorizontal: 12,
    },
    compactHeaderTitle: {
      fontSize: layout.isLandscape && !isTablet ? 16 : 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    contentArea: {
      flex: 1,
    },
    // Landscape layout: side by side (for tablets)
    landscapeContainer: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.background,
    },
    landscapeMapSection: {
      flex: 4, // Map takes more space
      padding: 12,
      justifyContent: 'center',
    },
    landscapeListSection: {
      flex: 2,
      borderStartWidth: 1,
      borderStartColor: theme.border,
      backgroundColor: theme.background,
      // Add padding for safe areas in landscape
      paddingEnd: isLandscape ? rightInset : 0,
      paddingTop: 8,
      paddingBottom: bottomInset,
    },
    // Phone landscape layout: compact horizontal
    phoneLandscapeContainer: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.background,
    },
    phoneLandscapeMapSection: {
      // Map section - 60% of width to give list more room
      flex: 0,
      width: '60%',
      padding: 4,
      paddingStart: Math.max(insets.left, 4),
      paddingEnd: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    phoneLandscapeMapFrame: {
      flex: 1,
      width: '100%',
      aspectRatio: 2560/1600,
      maxHeight: '100%', // Don't exceed container height
      maxWidth: '100%', // Don't exceed container width
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: roomBackgroundColor,
      overflow: 'hidden',
    },
    phoneLandscapeListSection: {
      // List takes remaining width - no header, starts from top
      flex: 1,
      minWidth: 120, // Ensure list is readable
      borderStartWidth: 1,
      borderStartColor: theme.border,
      backgroundColor: theme.background,
      // No extra padding - RoutesList handles its own compact padding
      // Safe area is handled by SafeAreaView edges
      paddingEnd: 0,
      paddingTop: 0, // List starts from very top
    },
    // Phone landscape action bar - replaces simple filter bar
    phoneLandscapeActionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
      gap: 2,
    },
    phoneLandscapeActionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    phoneLandscapeActionRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    phoneLandscapeCountText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    phoneLandscapeActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 2,
    },
    phoneLandscapeActionButtonActive: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    phoneLandscapeActionIcon: {
      fontSize: 12,
    },
    phoneLandscapeButtonLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: theme.text,
    },
    phoneLandscapeAddButton: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    phoneLandscapeAddIcon: {
      fontSize: 16,
      fontWeight: '700',
      color: '#ffffff',
    },
    // Sort modal styles for phone landscape
    sortModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    sortModalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      width: '90%',
      maxWidth: 400,
    },
    sortModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    sortModalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      gap: 12,
    },
    sortModalOptionActive: {
      backgroundColor: theme.primary + '20',
    },
    sortModalOptionText: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    sortModalOptionTextActive: {
      color: theme.primary,
    },
    phoneLandscapeFilterBar: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    phoneLandscapeFilterText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    // Dynamic map view styles
    loadingMapContainer: {
      backgroundColor: roomBackgroundColor,
      width: '100%',
      height: '100%',
      aspectRatio: 2560/1600,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mapViewContainer: {
      backgroundColor: roomBackgroundColor,
      width: '100%',
      height: '100%',
    },
    // Portrait layout: vertical stack
    mapSectionContainer: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 0,
      backgroundColor: theme.background,
      display: 'flex',
      flexDirection: 'column',
    },
    mapFrame: {
      aspectRatio: 2560/1600, // Exact aspect ratio of the wall map (16:10)
      width: '100%', // Take full width
      height: undefined, // Height will be calculated based on aspect ratio
      maxHeight: isLandscape ? height * 0.85 : undefined, // Limit height in landscape
      position: 'relative',
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: Math.round(20 * scaleFactor),
      backgroundColor: roomBackgroundColor, // Match wall map background color
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
      overflow: 'hidden', // Important for iOS
      marginBottom: isLandscape ? 0 : 12, // Space between map and filter bar in portrait
      padding: 0,
    },
    mapClip: {
      ...StyleSheet.absoluteFillObject,
      // Ensure clipping works on both iOS and Android
      overflow: 'hidden',
      borderRadius: Math.round(18 * scaleFactor), // Account for the border width (20-2)
      backgroundColor: roomBackgroundColor, // Match the wall map color
      width: '100%',
      height: '100%',
      aspectRatio: 2560/1600,
    },
    filterBarContainer: {
      marginHorizontal: 4,
      marginBottom: 8,
      borderRadius: Math.round(14 * scaleFactor),
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    // Filter bar with integrated action buttons
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
      gap: 6,
      paddingEnd: 8,
    },
    filterBarActionButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterBarActionButtonActive: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    filterBarActionIcon: {
      fontSize: 16,
    },
    filterBarAddButton: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    filterBarAddIcon: {
      fontSize: 22,
      fontWeight: '700',
      color: '#ffffff',
    },
  mapSection: {
    flex: 3,
    position: 'relative',
  },
  filtersOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    zIndex: 10,
    borderRadius: 12,
    backgroundColor: theme.isDark ? 'rgba(30, 30, 30, 0.96)' : 'rgba(255, 255, 255, 0.96)',
    borderWidth: 0.5,
    borderColor: theme.border,
    paddingVertical: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  listSection: {
    flex: 2,
    borderTopWidth: 0,
    backgroundColor: theme.background,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.background,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: 0.3,
  },
  loadingText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  actionButtons: {
    position: 'absolute',
    // Respect safe area insets for bottom and right positioning
    bottom: bottomInset + 16,
    right: rightInset + 8,
    flexDirection: 'column',
    gap: 8,
  },
  viewModeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.isDark ? 'rgba(45, 45, 45, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: theme.border,
  },
  activeViewMode: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  viewModeText: {
    fontSize: 20,
    color: theme.textSecondary,
  },
  activeViewModeText: {
    color: '#ffffff',
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  addButton: {
    backgroundColor: theme.success,
  },
  debugButton: {
    backgroundColor: theme.warning,
  },
  actionButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyMessageContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyMessageText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyMessageSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // Edit mode banner - inside SafeAreaView, not absolute positioned
  editModeBanner: {
    backgroundColor: theme.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Legacy admin banner styles (kept for reference)
  adminBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.warning,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 100,
    shadowColor: theme.warning,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  adminBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminBannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    flex: 1,
  },
  exitEditModeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginStart: 12,
  },
  exitEditModeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  editModeToggle: {
    position: 'absolute',
    // Respect safe area insets for bottom and right positioning
    bottom: bottomInset + 16,
    right: rightInset + 8,
    zIndex: 50,
  },
  editModeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  editModeButtonText: {
    fontSize: 24,
  },
  });
};
