import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Dimensions
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// New Architecture Components
import WallMap from '../../../components/WallMap/WallMap';
import { FiltersBar, FiltersSheet } from '../../../components/Filters';
import { RoutesList } from '../../../components/Lists';

import RouteBottomSheet from '../components/RouteBottomSheet';

// Store and Hooks
import { useFiltersStore } from '../../../store/useFiltersStore';
import { useFirebaseRoutes } from '../hooks/useFirebaseRoutes';

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
  
  // UI State
  const [selectedRoute, setSelectedRoute] = useState<RouteDoc | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'split'>('split');
  const [mapFrameSize, setMapFrameSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  
  // Data
  const { routes, isLoading, error } = useFirebaseRoutes();
  
  // Filters Store
  const { getFilteredRoutes, isFilterSheetOpen } = useFiltersStore();

  // Filtered routes based on current filters
  const filteredRoutes = useMemo(() => {
    return getFilteredRoutes(routes);
  }, [routes, getFilteredRoutes]);

  // Viewport bounds for visible routes (normalized 0-1)
  const [viewportBounds, setViewportBounds] = useState({ 
    leftN: 0, 
    rightN: 1, 
    topN: 0, 
    bottomN: 1 
  });

  // Routes visible in the current viewport
  const visibleRoutes = useMemo(() => {
    if (viewMode === 'list') {
      // In list mode, show all filtered routes
      return filteredRoutes;
    }
    
    // Filter routes by viewport bounds
    const visible = filteredRoutes.filter(route => (
      route.xNorm >= viewportBounds.leftN &&
      route.xNorm <= viewportBounds.rightN &&
      route.yNorm >= viewportBounds.topN &&
      route.yNorm <= viewportBounds.bottomN
    ));

    console.log('[RoutesMapScreen] Visible routes calculation:', {
      totalRoutes: routes.length,
      filteredRoutes: filteredRoutes.length,
      visibleRoutes: visible.length,
      viewportBounds,
      sampleRoutes: filteredRoutes.slice(0, 3).map(r => ({ 
        id: r.id, 
        x: r.xNorm, 
        y: r.yNorm,
        visible: r.xNorm >= viewportBounds.leftN && r.xNorm <= viewportBounds.rightN && 
                r.yNorm >= viewportBounds.topN && r.yNorm <= viewportBounds.bottomN
      }))
    });

    return visible;
  }, [filteredRoutes, viewportBounds, viewMode, routes.length]);

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
    // Debug: current transform
    console.log('[RoutesMapScreen] Transform change:', {
      scale: Number(transform.scale.toFixed(3)),
      tx: Number(transform.translateX.toFixed(1)),
      ty: Number(transform.translateY.toFixed(1)),
      frameSize: mapFrameSize,
      currentViewportBounds: viewportBounds
    });

    // Use the container size (frame size) to calculate image dimensions
    const containerWidth = mapFrameSize.width || 0;
    const containerHeight = mapFrameSize.height || 0;
    
    if (containerWidth <= 0 || containerHeight <= 0) {
      return;
    }

    // Wall map dimensions (from wallWidth and wallHeight props)
    const wallWidth = 2560;
    const wallHeight = 1600;
    const wallAspectRatio = wallHeight / wallWidth;

    // Calculate how the image fits within the container (like contain)
    let imageWidth = containerWidth;
    let imageHeight = containerWidth * wallAspectRatio;

    // If height exceeds container, fit by height
    if (imageHeight > containerHeight) {
      imageHeight = containerHeight;
      imageWidth = containerHeight / wallAspectRatio;
    }

    // Calculate base offset to center the image
    const baseOffsetX = (containerWidth - imageWidth) / 2;
    const baseOffsetY = (containerHeight - imageHeight) / 2;

    // Calculate visible area in image coordinates
    const scaledImageWidth = imageWidth * transform.scale;
    const scaledImageHeight = imageHeight * transform.scale;

    // Calculate actual image position considering base offset and transform
    const imageX = baseOffsetX + transform.translateX;
    const imageY = baseOffsetY + transform.translateY;

    // Calculate visible boundaries in image coordinates
    const leftVisible = Math.max(0, -imageX);
    const topVisible = Math.max(0, -imageY);
    const rightVisible = Math.min(scaledImageWidth, containerWidth - imageX);
    const bottomVisible = Math.min(scaledImageHeight, containerHeight - imageY);

    // Convert back to unscaled image coordinates
    const leftImg = leftVisible / transform.scale;
    const topImg = topVisible / transform.scale;
    const rightImg = rightVisible / transform.scale;
    const bottomImg = bottomVisible / transform.scale;

    // Convert to normalized coordinates (0-1) relative to the wall map
  // Add a small dynamic padding so route circles that are partially visible are included
  // Match RouteCircle sizing: size = max(24, 32 / sqrt(scale))
  const safeScale = Math.max(0.1, transform.scale || 1);
  const circleSizeScreen = Math.max(24, 32 / Math.sqrt(safeScale));
  const approxCircleRadiusScreen = circleSizeScreen / 2;
    // Convert screen radius to image-space (before scale) and then to normalized units
    const radiusImg = approxCircleRadiusScreen / Math.max(1e-6, transform.scale);
    const padXN = radiusImg / Math.max(1e-6, imageWidth);
    const padYN = radiusImg / Math.max(1e-6, imageHeight);

    const newBounds = {
      leftN: Math.max(0, Math.min(1, leftImg / imageWidth - padXN)),
      rightN: Math.max(0, Math.min(1, rightImg / imageWidth + padXN)),
      topN: Math.max(0, Math.min(1, topImg / imageHeight - padYN)),
      bottomN: Math.max(0, Math.min(1, bottomImg / imageHeight + padYN))
    };

    console.log('[RoutesMapScreen] Bounds calculation:', {
      container: { width: containerWidth, height: containerHeight },
      image: { width: imageWidth, height: imageHeight },
      baseOffset: { x: baseOffsetX, y: baseOffsetY },
      imagePosition: { x: imageX, y: imageY },
      visible: { left: leftVisible, top: topVisible, right: rightVisible, bottom: bottomVisible },
      bounds: newBounds
    });

    setViewportBounds(prev => {
      const changed =
        Math.abs(prev.leftN - newBounds.leftN) > 0.01 ||
        Math.abs(prev.rightN - newBounds.rightN) > 0.01 ||
        Math.abs(prev.topN - newBounds.topN) > 0.01 ||
        Math.abs(prev.bottomN - newBounds.bottomN) > 0.01;
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
        onRoutePress={handleRoutePress}
        selectedRouteId={selectedRoute?.id}
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
          availableColors={availableColors}
          availableGrades={availableGrades}
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
            availableColors={availableColors}
            availableGrades={availableGrades}
          />
        </View>
      </View>
      
      {/* List Section */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            מסלולים ({visibleRoutes.length})
          </Text>
          {isLoading && <Text style={styles.loadingText}>טוען...</Text>}
        </View>
        {renderListView()}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Content Area */}
      <View style={styles.contentArea}>
        {viewMode === 'map' && renderFullMapView()}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'split' && renderSplitView()}
        {renderEmptyMessage()}
      </View>

      {/* Action Buttons - Only Add Route Button */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.addButton]}
          onPress={handleAddRoute}
          testID="fab-add-route"
        >
          <Text style={styles.actionButtonText}>+</Text>
        </TouchableOpacity>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentArea: {
    flex: 1,
  },
  mapSectionContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: '#f8f8f8',
    display: 'flex',
    flexDirection: 'column',
  },
  mapFrame: {
    aspectRatio: 2560/1600, // Exact aspect ratio of the wall map (16:10)
    width: '100%', // Take full width
    height: undefined, // Height will be calculated based on aspect ratio
    position: 'relative',
    borderWidth: 3,
    borderColor: '#3b82f6',
    borderRadius: 24,
    backgroundColor: '#01467D', // Match exact wall map background color
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden', // Important for iOS
    marginBottom: 12,    // Space between map and filter bar
    padding: 0,
  },
  mapClip: {
    ...StyleSheet.absoluteFillObject,
    // Ensure clipping works on both iOS and Android
    overflow: 'hidden',
    borderRadius: 21,    // Account for the border width (24-3)
    backgroundColor: '#01467D', // Exact match for the wall map color
    width: '100%',
    height: '100%',
    aspectRatio: 2560/1600,
  },
  filterBarContainer: {
    marginHorizontal: 4,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 5,
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
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  listSection: {
    flex: 2,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeViewMode: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  viewModeText: {
    fontSize: 20,
    color: '#6b7280',
  },
  activeViewModeText: {
    color: '#ffffff',
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addButton: {
    backgroundColor: '#10b981',
  },
  debugButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
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
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyMessageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyMessageSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
