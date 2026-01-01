import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Theme
import { useTheme } from '@/features/theme/ThemeContext';

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

// Admin Context
import { useAdmin } from '../../../context/AdminContext';

// Types
import { RouteDoc, MapTransforms } from '../types/route';
import { RoutesService } from '../services/RoutesService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type RootStackParamList = {
  RoutesMap: undefined;
  AddRoute: undefined;
  RouteDetails: {
    route: any;
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoutesMap'>;

/**
 * RoutesMapScreen עם האדריכלות החדשה
 * משתמש ב-WallMap, FiltersBar, RoutesList ו-Zustand store
 * עם תמיכה לחזרה מדורגת בתאימות לקומפוננטים הישנים
 */
export default function RoutesMapScreen() {
  const navigation = useNavigation<NavigationProp>();
  
  // Theme
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  // Admin Mode
  const { isAdmin, adminModeEnabled } = useAdmin();
  
  // UI State
  const [selectedRoute, setSelectedRoute] = useState<RouteDoc | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteDoc | null>(null);
  const [movingRoute, setMovingRoute] = useState<RouteDoc | null>(null); // Route being moved
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'split'>('split');
  const [mapFrameSize, setMapFrameSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [sortBy, setSortBy] = useState<SortOption>('grade-asc');
  
  // Data
  const { routes, isLoading, error } = useFirebaseRoutes();
  
  // Filters Store
  const { getFilteredRoutes, isFilterSheetOpen, filters } = useFiltersStore();

  // Filtered routes based on current filters
  const filteredRoutes = useMemo(() => {
    console.log('[RoutesMapScreen] Recalculating filteredRoutes with filters:', {
      colors: filters.colors,
      gradeRange: filters.gradeRange,
    });
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
    const sorted = sortRoutes(routesToShow);

    console.log(`[Viewport] ${sorted.length}/${filteredRoutes.length} routes visible in bounds [${viewportBounds.leftN.toFixed(2)}-${viewportBounds.rightN.toFixed(2)}, ${viewportBounds.topN.toFixed(2)}-${viewportBounds.bottomN.toFixed(2)}]`);

    return sorted;
  }, [filteredRoutes, viewportBounds, viewMode, sortRoutes]);

  // Handlers
  const handleRoutePress = useCallback((route: RouteDoc) => {
    console.log('🔗 opening route details', route.id, route.color);
    navigation.navigate('RouteDetails', { 
      route: {
        id: route.id,
        name: route.name,
        grade: route.grade,
        color: route.color,
        difficulty: route.grade,
        description: `מסלול ${route.name} ברמת קושי ${route.grade}`,
        coordinates: {
          x: route.xNorm,
          y: route.yNorm,
        },
        createdAt: route.createdAt || new Date(),
        createdBy: route.setter || 'system',
        wallId: 'default-wall',
      }
    });
  }, [navigation]);

  const handleRouteLongPress = useCallback((route: RouteDoc) => {
    console.log('🔧 LongPress on route:', route.id, 'adminModeEnabled:', adminModeEnabled);
    if (adminModeEnabled) {
      console.log('🔧 Admin: opening edit modal for route', route.id);
      setEditingRoute(route);
      setShowEditModal(true);
    } else {
      console.log('🔧 Admin mode not enabled, ignoring long press');
    }
  }, [adminModeEnabled]);

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
    console.log('📍 handleStartMoveRoute called');
    console.log('📍 route:', route?.id, route?.name);
    try {
      setMovingRoute(route);
      console.log('📍 setMovingRoute completed');
      Alert.alert(
        'הזזת מסלול',
        'לחץ על המיקום החדש במפה',
        [{ text: 'הבנתי', style: 'default' }]
      );
      console.log('📍 Alert shown');
    } catch (error) {
      console.error('📍 Error in handleStartMoveRoute:', error);
    }
  }, []);

  // Handle tap on map to place moved route
  const handleMapTap = useCallback(async (coordinates: { xImg: number; yImg: number }) => {
    console.log('📍 handleMapTap called with:', coordinates);
    console.log('📍 movingRoute:', movingRoute?.id);
    
    if (!movingRoute) {
      console.log('📍 No movingRoute, returning');
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

    console.log('📍 Moving route to new position:', coordinates);
    console.log('📍 mapFrameSize:', mapFrameSize);
    
    // Calculate normalized coordinates
    const wallWidth = 2560;
    const wallHeight = 1600;
    
    // Convert image coordinates to normalized (0-1)
    // xImg and yImg are in image coordinate space  
    const imageWidth = mapFrameSize.width || 377;
    const imageHeight = mapFrameSize.height || 236;
    
    console.log('📍 Using image dimensions:', { imageWidth, imageHeight });
    console.log('📍 Raw coordinates:', coordinates);
    
    // Make sure coordinates are within image bounds
    const clampedXImg = Math.max(0, Math.min(imageWidth, coordinates.xImg));
    const clampedYImg = Math.max(0, Math.min(imageHeight, coordinates.yImg));
    
    console.log('📍 Clamped image coordinates:', { clampedXImg, clampedYImg });
    
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

    console.log('📍 Calculated normalized coordinates:', { clampedX, clampedY });

    try {
      console.log('📍 Calling RoutesService.updateRoute...');
      await RoutesService.updateRoute(movingRoute.id, {
        xNorm: clampedX,
        yNorm: clampedY,
      });
      console.log('📍 Route updated successfully');
      Alert.alert('הצלחה', 'המסלול הוזז בהצלחה');
    } catch (error) {
      console.error('📍 Error moving route:', error);
      Alert.alert('שגיאה', 'לא ניתן להזיז את המסלול');
    } finally {
      console.log('📍 Setting movingRoute to null');
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
      />
    );
  };  const renderSplitView = () => (
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
              console.log('[RoutesMapScreen] frame layout', { width, height });
            }}
          >
            {renderMapView()}
          </View>
        </View>
        
        {/* FiltersBar positioned below the map */}
        <View style={styles.filterBarContainer}>
          <FiltersBar
            routeCount={filteredRoutes.length}
            visibleCount={visibleRoutes.length}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Content Area */}
      <View style={styles.contentArea}>
        {viewMode === 'map' && renderFullMapView()}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'split' && renderSplitView()}
        {renderEmptyMessage()}
      </View>

      {/* Action Buttons - Add Route Button (Admin Only in Edit Mode) */}
      {adminModeEnabled && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.addButton]}
            onPress={handleAddRoute}
            testID="fab-add-route"
          >
            <Text style={styles.actionButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filters Sheet */}
      <FiltersSheet
        availableColors={availableColors}
        availableGrades={availableGrades}
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

      {/* Moving Route Banner */}
      {movingRoute && (
        <View style={styles.movingBanner}>
          <Text style={styles.movingBannerText}>📍 לחץ על המיקום החדש במפה</Text>
          <TouchableOpacity onPress={handleCancelMove} style={styles.cancelMoveButton}>
            <Text style={styles.cancelMoveButtonText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Admin Mode Banner */}
      {adminModeEnabled && !movingRoute && (
        <View style={styles.adminBanner}>
          <Text style={styles.adminBannerText}>🔧 מצב עריכה פעיל - לחץ ארוך לעריכה | + להוספה</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  contentArea: {
    flex: 1,
  },
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
    position: 'relative',
    borderWidth: 2,
    borderColor: theme.border,
    borderRadius: 20,
    backgroundColor: '#01467D', // Match exact wall map background color
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden', // Important for iOS
    marginBottom: 12,    // Space between map and filter bar
    padding: 0,
  },
  mapClip: {
    ...StyleSheet.absoluteFillObject,
    // Ensure clipping works on both iOS and Android
    overflow: 'hidden',
    borderRadius: 18,    // Account for the border width (20-2)
    backgroundColor: '#01467D', // Exact match for the wall map color
    width: '100%',
    height: '100%',
    aspectRatio: 2560/1600,
  },
  filterBarContainer: {
    marginHorizontal: 4,
    marginBottom: 8,
    borderRadius: 14,
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
    bottom: 24,
    right: 16,
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
  adminBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.warning,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 100,
    shadowColor: theme.warning,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  adminBannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  movingBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
