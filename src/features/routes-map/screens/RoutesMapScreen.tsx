import React, { useState, useCallback, useMemo, useEffect } from 'react';
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

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Theme
import { useTheme } from '@/features/theme/ThemeContext';

// Responsive Layout Hook
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

// New Architecture Components
import WallMap from '../../../components/WallMap/WallMap';
import { FiltersBar, FiltersSheet } from '../../../components/Filters';
import { RoutesList } from '../../../components/Lists';
import type { SortOption } from '../../../components/Filters/FiltersBar';

import RouteBottomSheet from '../components/RouteBottomSheet';
import RouteEditModal from '../components/RouteEditModal';

// Store and Hooks
import { useFiltersStore } from '../../../store/useFiltersStore';
import { useFirebaseRoutes } from '../hooks/useFirebaseRoutes';

// Language
import { useLanguage } from '@/features/language';

// Admin Context and Roles
import { useAdmin } from '../../../context/AdminContext';
import { useRolesContext } from '../../../features/roles';

// Types
import { RouteDoc, MapTransforms } from '../types/route';
import { RoutesService } from '../services/RoutesService';

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
  
  // Create styles with theme, layout, and insets
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  
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
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'split'>('split');
  const [mapFrameSize, setMapFrameSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [sortBy, setSortBy] = useState<SortOption>('grade-asc');
  const [showSortModal, setShowSortModal] = useState(false);
  
  // Sort options for modal
  const sortOptions = useMemo(() => [
    { value: 'grade-asc' as SortOption, label: t.common.gradeEasyToHard, icon: '📈' },
    { value: 'grade-desc' as SortOption, label: t.common.gradeHardToEasy, icon: '📉' },
    { value: 'popularity' as SortOption, label: t.common.mostPopular, icon: '⭐' },
  ], [t]);
  
  // Data
  const { routes, isLoading, error } = useFirebaseRoutes();
  
  // Filters Store
  const { getFilteredRoutes, isFilterSheetOpen, filters } = useFiltersStore();

  // Filtered routes based on current filters
  const filteredRoutes = useMemo(() => {
    return getFilteredRoutes(routes);
  }, [routes, getFilteredRoutes, filters]);

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
  const visibleRoutes = useMemo(() => {
    let routesToShow: RouteDoc[];
    
    if (viewMode === 'list') {
      // In list mode, show all filtered routes
      routesToShow = filteredRoutes;
    } else {
      // Filter routes by viewport bounds
      routesToShow = filteredRoutes.filter(route => (
        route.xNorm >= viewportBounds.leftN &&
        route.xNorm <= viewportBounds.rightN &&
        route.yNorm >= viewportBounds.topN &&
        route.yNorm <= viewportBounds.bottomN
      ));
    }

    // Apply sorting
    return sortRoutes(routesToShow);
  }, [filteredRoutes, viewportBounds, viewMode, sortRoutes]);

  // Handlers
  const handleRoutePress = useCallback((route: RouteDoc) => {
    // In edit mode, open edit modal instead of navigating
    if (editModeEnabled) {
      setEditingRoute(route);
      setShowEditModal(true);
      return;
    }
    
    navigation.navigate('RouteDetails', { 
      route: {
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
        // Community feedback stats
        averageStarRating: route.averageStarRating || 0,
        calculatedGrade: route.calculatedGrade || null,
        feedbackCount: route.feedbackCount || 0,
        completionCount: route.completionCount || 0,
      }
    });
  }, [navigation, editModeEnabled]);

  const handleRouteLongPress = useCallback((route: RouteDoc) => {
    // Long press opens edit modal if user has edit permissions (admin or route setter)
    if (canAccessEditMode) {
      setEditingRoute(route);
      setShowEditModal(true);
    }
  }, [canAccessEditMode]);

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

  // Handle tap on map to place moved route
  const handleMapTap = useCallback(async (coordinates: { xImg: number; yImg: number }) => {
    if (!movingRoute) {
      return;
    }

    // Validate coordinates
    if (typeof coordinates.xImg !== 'number' || typeof coordinates.yImg !== 'number' ||
        isNaN(coordinates.xImg) || isNaN(coordinates.yImg)) {
      console.error('📍 Invalid coordinates received:', coordinates);
      Alert.alert('שגיאה', 'קואורדינטות לא תקינות');
      setMovingRoute(null);
      return;
    }
    
    // Calculate normalized coordinates
    const wallWidth = 2560;
    const wallHeight = 1600;
    
    // Convert image coordinates to normalized (0-1)
    // xImg and yImg are in image coordinate space  
    const imageWidth = mapFrameSize.width || 377;
    const imageHeight = mapFrameSize.height || 236;
    
    // Make sure coordinates are within image bounds
    const clampedXImg = Math.max(0, Math.min(imageWidth, coordinates.xImg));
    const clampedYImg = Math.max(0, Math.min(imageHeight, coordinates.yImg));
    
    const xNorm = clampedXImg / imageWidth;
    const yNorm = clampedYImg / imageHeight;

    // Validate normalized coordinates
    if (isNaN(xNorm) || isNaN(yNorm)) {
      console.error('📍 Invalid normalized coordinates:', { xNorm, yNorm });
      Alert.alert('שגיאה', 'שגיאה בחישוב קואורדינטות');
      setMovingRoute(null);
      return;
    }

    // Clamp values to 0-1 range
    const clampedX = Math.max(0, Math.min(1, xNorm));
    const clampedY = Math.max(0, Math.min(1, yNorm));

    try {
      await RoutesService.updateRoute(movingRoute.id, {
        xNorm: clampedX,
        yNorm: clampedY,
      });
      Alert.alert('הצלחה', 'המסלול הוזז בהצלחה');
    } catch (error) {
      console.error('📍 Error moving route:', error);
      Alert.alert('שגיאה', 'לא ניתן להזיז את המסלול');
    } finally {
      setMovingRoute(null);
    }
  }, [movingRoute, mapFrameSize]);

  // Cancel moving route
  const handleCancelMove = useCallback(() => {
    setMovingRoute(null);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setShowBottomSheet(false);
    setSelectedRoute(null);
  }, []);

  const handleMarkTop = useCallback(async (route: RouteDoc) => {
    try {
      await RoutesService.incrementTops(route.id);
      Alert.alert('הצלחה', 'המסלול סומן כטופס!');
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בסימון המסלול');
    }
  }, []);

  const handleRate = useCallback(async (route: RouteDoc, rating: number) => {
    try {
      await RoutesService.updateRoute(route.id, { rating });
      Alert.alert('הצלחה', 'המסלול דורג!');
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בדירוג המסלול');
    }
  }, []);

  const handleShare = useCallback((route: RouteDoc) => {
    Alert.alert('שיתוף', `שיתוף מסלול: ${route.name}`);
  }, []);

  const handleReport = useCallback((route: RouteDoc) => {
    Alert.alert('דיווח', `דיווח על מסלול: ${route.name}`);
  }, []);

  const handleAddRoute = useCallback(() => {
    navigation.navigate('AddRoute');
  }, [navigation]);

  const handleOpenArchive = useCallback(() => {
    navigation.navigate('RoutesArchive' as any);
  }, [navigation]);

  const handleTransformChange = useCallback((transform: { scale: number; translateX: number; translateY: number }) => {
    const containerWidth = mapFrameSize.width || 0;
    const containerHeight = mapFrameSize.height || 0;
    
    if (containerWidth <= 0 || containerHeight <= 0) {
      return;
    }

    const { scale, translateX, translateY } = transform;
    
    // Wall map dimensions
    const wallWidth = 2560;
    const wallHeight = 1600;
    const wallAspectRatio = wallHeight / wallWidth;

    // Calculate how the image fits within the container (object-fit: contain)
    // This must match the calculation in WallMap.tsx
    let imageWidth = containerWidth;
    let imageHeight = containerWidth * wallAspectRatio;

    if (imageHeight > containerHeight) {
      imageHeight = containerHeight;
      imageWidth = containerHeight / wallAspectRatio;
    }

    // The scaled image dimensions
    const scaledImgW = imageWidth * scale;
    const scaledImgH = imageHeight * scale;
    
    // Calculate the offset from the image being centered
    // When image is smaller than container, it's centered
    // When image is larger, translateX/Y range from (container - scaledImg) to 0
    
    // The visible portion in image coordinates (unscaled)
    // translateX is the position of the scaled image's left edge relative to container's left edge
    // So the visible left edge of the image is at: -translateX / scale
    // And the visible right edge is at: (-translateX + containerWidth) / scale
    // But we need to clamp to actual image bounds
    
    const leftImg = Math.max(0, Math.min(imageWidth, -translateX / scale));
    const topImg = Math.max(0, Math.min(imageHeight, -translateY / scale));
    const rightImg = Math.max(0, Math.min(imageWidth, (-translateX + containerWidth) / scale));
    const bottomImg = Math.max(0, Math.min(imageHeight, (-translateY + containerHeight) / scale));
    
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

    console.log('[RoutesMapScreen] Viewport bounds:', {
      scale: scale.toFixed(2),
      translate: { x: translateX.toFixed(1), y: translateY.toFixed(1) },
      image: { w: imageWidth.toFixed(0), h: imageHeight.toFixed(0) },
      container: { w: containerWidth.toFixed(0), h: containerHeight.toFixed(0) },
      boundsImg: { left: leftImg.toFixed(0), right: rightImg.toFixed(0), top: topImg.toFixed(0), bottom: bottomImg.toFixed(0) },
      bounds: {
        left: newBounds.leftN.toFixed(3),
        right: newBounds.rightN.toFixed(3),
        top: newBounds.topN.toFixed(3),
        bottom: newBounds.bottomN.toFixed(3)
      }
    });

    setViewportBounds(prev => {
      const changed =
        Math.abs(prev.leftN - newBounds.leftN) > 0.005 ||
        Math.abs(prev.rightN - newBounds.rightN) > 0.005 ||
        Math.abs(prev.topN - newBounds.topN) > 0.005 ||
        Math.abs(prev.bottomN - newBounds.bottomN) > 0.005;
      return changed ? newBounds : prev;
    });
  }, [mapFrameSize.width, mapFrameSize.height]);

  // Calculate initial viewport bounds when map frame size is available
  useEffect(() => {
    if (mapFrameSize.width > 0 && mapFrameSize.height > 0) {
      // Call handleTransformChange with initial transform (scale: 1, no translation)
      handleTransformChange({ scale: 1, translateX: 0, translateY: 0 });
    }
  }, [mapFrameSize.width, mapFrameSize.height, handleTransformChange]);

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
    const colors = new Set(routes.map(route => route.color).filter(Boolean));
    return Array.from(colors);
  }, [routes]);

  const availableGrades = useMemo(() => {
    const grades = new Set(routes.map(route => route.grade).filter(Boolean));
    return Array.from(grades).sort();
  }, [routes]);

  // חילוץ תאריכים ייחודיים מהמסלולים בפורמט YYYY-MM-DD
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    routes.forEach(route => {
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

  const renderMapView = () => (
    <View style={{backgroundColor: '#01467D', width: '100%', height: '100%', aspectRatio: 2560/1600}}>
      <WallMap
        routes={filteredRoutes}
        onRoutePress={movingRoute ? undefined : handleRoutePress}
        onRouteLongPress={movingRoute ? undefined : handleRouteLongPress}
        onMapTap={movingRoute ? handleMapTap : undefined}
        selectedRouteId={movingRoute?.id || selectedRoute?.id}
        wallWidth={2560}
        wallHeight={1600}
        onTransformChange={handleTransformChange}
        gesturesEnabled={true}
      />
    </View>
  );

  const renderFullMapView = () => (
    <View style={styles.mapSectionContainer}>
      <View style={styles.mapFrame}>
        <View
          style={styles.mapClip}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setMapFrameSize({ width, height });
            console.log('[RoutesMapScreen] frame layout', { width, height });
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

  const renderListView = () => {
    console.log('[RoutesMapScreen] Rendering list with:', {
      visibleRoutesCount: visibleRoutes.length,
      visibleRouteIds: visibleRoutes.map(r => r.id.slice(-6)),
      sampleVisibleRoute: visibleRoutes[0] ? {
        id: visibleRoutes[0].id.slice(-6),
        name: visibleRoutes[0].name,
        grade: visibleRoutes[0].grade
      } : null
    });
    
    return (
      <RoutesList
        routes={visibleRoutes}
        visibleRouteIds={visibleRoutes.map(r => r.id)}
        onRoutePress={handleRoutePress}
        onRouteLongPress={handleRouteLongPress}
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
              console.log('[RoutesMapScreen] landscape frame layout', { width, height });
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
              console.log('[RoutesMapScreen] phone landscape frame layout', { width, height });
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
              <Text style={styles.phoneLandscapeActionIcon}>↕️</Text>
              <Text style={styles.phoneLandscapeButtonLabel}>{t.common.sort}</Text>
            </TouchableOpacity>
            {/* Filter button */}
            <TouchableOpacity
              style={styles.phoneLandscapeActionButton}
              onPress={() => useFiltersStore.getState().setFilterSheetOpen(true)}
            >
              <Text style={styles.phoneLandscapeActionIcon}>⚙️</Text>
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
          visibleRouteIds={visibleRoutes.map(r => r.id)}
          onRoutePress={handleRoutePress}
          onRouteLongPress={handleRouteLongPress}
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
                <Text style={styles.sortModalOptionIcon}>{option.icon}</Text>
                <Text style={[
                  styles.sortModalOptionText,
                  sortBy === option.value && styles.sortModalOptionTextActive,
                ]}>
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Text style={styles.sortModalCheckmark}>✓</Text>
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
              console.log('[RoutesMapScreen] portrait frame layout', { width, height });
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
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
      {/* Edit Mode Banner - now inside SafeAreaView and with simpler text */}
      {editModeEnabled && !movingRoute && (
        <View style={styles.editModeBanner}>
          <Text style={styles.editModeBannerText}>
            {isAdmin ? '🔧' : '🧗'} מצב עריכה פעיל - לחץ ארוך לעריכה
          </Text>
        </View>
      )}

      {/* Moving Route Banner */}
      {movingRoute && (
        <View style={styles.movingBanner}>
          <Text style={styles.movingBannerText}>📍 לחץ על המיקום החדש במפה</Text>
          <TouchableOpacity onPress={handleCancelMove} style={styles.cancelMoveButton}>
            <Text style={styles.cancelMoveButtonText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content Area */}
      <View style={styles.contentArea}>
        {viewMode === 'map' && renderFullMapView()}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'split' && renderSplitView()}
        {renderEmptyMessage()}
      </View>

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
    </SafeAreaView>
  );
}

const createStyles = (
  theme: any, 
  layout: ReturnType<typeof useResponsiveLayout>,
  insets: { top: number; bottom: number; left: number; right: number }
) => {
  const { isLandscape, isTablet, mapLayoutMode, width, height, scaleFactor } = layout;
  
  // Calculate safe padding for right side (Android navigation bar in landscape)
  const rightInset = Math.max(insets.right, 8);
  const bottomInset = Math.max(insets.bottom, 8);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      flex: 3,
      padding: 12,
      justifyContent: 'center',
    },
    landscapeListSection: {
      flex: 2,
      borderLeftWidth: 1,
      borderLeftColor: theme.border,
      backgroundColor: theme.background,
      // Add padding for safe areas in landscape
      paddingRight: isLandscape ? rightInset : 0,
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
      // Map takes 55% of available width - balanced with list
      flex: 0,
      width: '63%',
      padding: 6,
      paddingLeft: Math.max(insets.left, 6),
      paddingRight: 4,
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
      backgroundColor: '#01467D',
      overflow: 'hidden',
    },
    phoneLandscapeListSection: {
      // List takes remaining 45% of width - more space for content
      flex: 1,
      minWidth: 140, // Ensure list is readable
      borderLeftWidth: 1,
      borderLeftColor: theme.border,
      backgroundColor: theme.background,
      // No extra padding - RoutesList handles its own compact padding
      // Safe area is handled by SafeAreaView edges
      paddingRight: 0,
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
    },
    sortModalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      minWidth: 250,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    sortModalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    sortModalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 4,
    },
    sortModalOptionActive: {
      backgroundColor: theme.primaryLight || `${theme.primary}20`,
    },
    sortModalOptionIcon: {
      fontSize: 16,
      marginRight: 10,
    },
    sortModalOptionText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    sortModalOptionTextActive: {
      fontWeight: '600',
      color: theme.primary,
    },
    sortModalCheckmark: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: '700',
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
      backgroundColor: '#01467D', // Match exact wall map background color
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
      backgroundColor: '#01467D', // Exact match for the wall map color
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
      paddingRight: 8,
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
  editModeBannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
    marginLeft: 12,
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
    backgroundColor: theme.primary,
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
  // Moving banner - now inside SafeAreaView flow, not absolute
  movingBanner: {
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  movingBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  cancelMoveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 12,
  },
  cancelMoveButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  });
};
