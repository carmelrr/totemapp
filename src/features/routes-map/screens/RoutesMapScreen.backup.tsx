import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import MapViewport from '../components/MapViewport';
import RouteMarkersLayer from '../components/RouteMarkersLayer';
import MapControls from '../components/MapControls';
import FilterSheet from '../components/FilterSheet';
import RouteBottomSheet from '../components/RouteBottomSheet';

import { useFirebaseRoutes } from '../hooks/useFirebaseRoutes';
import { useVisibleRoutes, useRouteFilters } from '../hooks/useVisibleRoutes';
// We no longer use useMapTransforms directly here.  MapViewport manages
// transforms internally and exposes them via onTransformsReady.

import { RouteDoc, RouteFilters, RouteSortBy, MapTransforms } from '../types/route';
import { RoutesService } from '../services/RoutesService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type RootStackParamList = {
  RoutesMap: undefined;
  AddRoute: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoutesMap'>;

export default function RoutesMapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [screenDimensions, setScreenDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6, // Reserve space for list
  });
  const [imageDimensions, setImageDimensions] = useState({
    imgW: 0,
    imgH: 0,
  });
  const [currentTransforms, setCurrentTransforms] = useState<MapTransforms>({
    translateX: 0,
    translateY: 0,
    scale: 1,
  });

  // State for UI components
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteDoc | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Filters and sorting
  const defaultFilters = useRouteFilters();
  const [filters, setFilters] = useState<RouteFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState<RouteSortBy>('distance');

  // Data
  const { routes, isLoading, error } = useFirebaseRoutes();

  /**
   * The controls and shared values returned by MapViewport.  Initially null
   * until MapViewport notifies us via onTransformsReady.
   */
  const [mapControls, setMapControls] = useState<any>(null);

  // Visible routes based on viewport and filters
  const visibleRoutes = useVisibleRoutes({
    routes,
    transforms: currentTransforms,
    screenWidth: screenDimensions.width,
    screenHeight: screenDimensions.height,
    imageWidth: imageDimensions.imgW,
    imageHeight: imageDimensions.imgH,
    filters,
    sortBy,
  });

  // Handlers
  const handleMapMeasured = useCallback((dimensions: { imgW: number; imgH: number }) => {
    console.log('Map measured:', dimensions);
    setImageDimensions(dimensions);
  }, []);

  /**
   * Update currentTransforms only when the difference exceeds a small epsilon.
   * This prevents infinite update loops caused by tiny floating‑point changes
   * during animations.
   */
  const handleTransformChange = useCallback((next: MapTransforms) => {
    const EPS = 0.05;
    setCurrentTransforms((prev) => {
      const near = (a: number, b: number) => Math.abs(a - b) < EPS;
      if (near(prev.scale, next.scale) && near(prev.translateX, next.translateX) && near(prev.translateY, next.translateY)) {
        return prev;
      }
      return next;
    });
  }, []);

  /**
   * Capture the transforms and actions from MapViewport.  We store the
   * reference only once; the map container will update its own shared
   * values internally.  To avoid re-renders, this callback is memoized.
   */
  const handleTransformsReady = useCallback((transforms: any) => {
    setMapControls(transforms);
  }, []);

  const handleMarkerPress = useCallback((route: RouteDoc) => {
    setSelectedRoute(route);
    setSelectedRouteId(route.id);
    setShowBottomSheet(true);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setShowBottomSheet(false);
    setSelectedRoute(null);
    setSelectedRouteId(null);
  }, []);

  // Don't render map content until we have valid dimensions
  const isMapReady = imageDimensions.imgW > 0 && imageDimensions.imgH > 0;

  console.log('RoutesMapScreen render - isMapReady:', isMapReady, 'imageDimensions:', imageDimensions);

  const handleMarkTop = useCallback(async (route: RouteDoc) => {
    try {
      await RoutesService.incrementTops(route.id);
      Alert.alert('Success', 'Route marked as topped!');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark route as topped');
    }
  }, []);

  const handleRate = useCallback(async (route: RouteDoc, rating: number) => {
    try {
      await RoutesService.updateRoute(route.id, { rating });
      Alert.alert('Success', 'Route rated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to rate route');
    }
  }, []);

  const handleShare = useCallback((route: RouteDoc) => {
    Alert.alert('Share', `Sharing route: ${route.name}`);
  }, []);

  const handleReport = useCallback((route: RouteDoc) => {
    Alert.alert('Report', `Reporting route: ${route.name}`);
  }, []);

  const handleAddRoute = useCallback(() => {
    navigation.navigate('AddRoute');
  }, [navigation]);

  const handleDebug = useCallback(() => {
    // For now, just show an alert with route data summary
    Alert.alert(
      'Debug Info',
      `Routes loaded: ${routes.length}\n` +
      `Loading: ${isLoading}\n` +
      `Error: ${error ? error.message : 'None'}\n` +
      `Image dimensions: ${imageDimensions.imgW.toFixed(1)} x ${imageDimensions.imgH.toFixed(1)}\n` +
      `Current transform: scale=${currentTransforms.scale.toFixed(2)}, x=${currentTransforms.translateX.toFixed(1)}, y=${currentTransforms.translateY.toFixed(1)}`
    );
  }, [routes, isLoading, error, imageDimensions, currentTransforms]);

  const renderRouteItem = useCallback(({ item }: { item: RouteDoc }) => (
    <TouchableOpacity
      style={styles.routeListItem}
      onPress={() => handleMarkerPress(item)}
    >
      <View style={[styles.routeColorIndicator, { backgroundColor: item.color }]} />
      <View style={styles.routeItemContent}>
        <Text style={styles.routeItemName}>{item.name}</Text>
        <Text style={styles.routeItemGrade}>{item.grade}</Text>
      </View>
      <View style={styles.routeItemStats}>
        <Text style={styles.routeItemStat}>⭐ {item.rating.toFixed(1)}</Text>
        <Text style={styles.routeItemStat}>🏆 {item.tops}</Text>
      </View>
    </TouchableOpacity>
  ), [handleMarkerPress]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading routes: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Section */}
      <View style={styles.mapSection}>
        <MapViewport
          onMeasured={handleMapMeasured}
          onTransformChange={handleTransformChange}
          onTransformsReady={handleTransformsReady}
        >
          {isMapReady && mapControls && (
            <RouteMarkersLayer
              routes={visibleRoutes}
              imageWidth={imageDimensions.imgW}
              imageHeight={imageDimensions.imgH}
              scale={mapControls.scale}
              translateX={mapControls.translateX}
              translateY={mapControls.translateY}
              onMarkerPress={handleMarkerPress}
              selectedRouteId={selectedRouteId}
            />
          )}
        </MapViewport>

        {/* Map Controls */}
        <MapControls
          // Provide no-op functions when mapControls is not ready to avoid
          // calling undefined functions on press.  Once mapControls is set,
          // the real zoomIn/zoomOut/resetView functions will be used.
          onZoomIn={mapControls?.zoomIn ?? (() => {})}
          onZoomOut={mapControls?.zoomOut ?? (() => {})}
          onReset={mapControls?.resetView ?? (() => {})}
        />

        {/* Header Buttons */}
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilterSheet(true)}
          >
            <Text style={styles.headerButtonText}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.debugButton]}
            onPress={handleDebug}
          >
            <Text style={[styles.headerButtonText, styles.debugButtonText]}>Debug</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.addButton]}
            onPress={handleAddRoute}
          >
            <Text style={[styles.headerButtonText, styles.addButtonText]}>Add Route</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Routes List Section */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            Routes in View ({visibleRoutes.length})
          </Text>
          {isLoading && <Text style={styles.loadingText}>Loading...</Text>}
        </View>

        <FlatList
          data={visibleRoutes}
          renderItem={renderRouteItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>

      {/* Filter Sheet */}
      <FilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        filters={filters}
        sortBy={sortBy}
        onFiltersChange={setFilters}
        onSortChange={setSortBy}
      />

      {/* Route Bottom Sheet */}
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
  mapSection: {
    flex: 3,
    position: 'relative',
  },
  listSection: {
    flex: 2,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  headerButtons: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addButton: {
    backgroundColor: '#3b82f6',
  },
  debugButton: {
    backgroundColor: '#f59e0b',
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  addButtonText: {
    color: '#ffffff',
  },
  debugButtonText: {
    color: '#ffffff',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
  listContent: {
    paddingHorizontal: 16,
  },
  routeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  routeColorIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  routeItemContent: {
    flex: 1,
  },
  routeItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  routeItemGrade: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  routeItemStats: {
    alignItems: 'flex-end',
  },
  routeItemStat: {
    fontSize: 12,
    color: '#6b7280',
    marginVertical: 1,
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
  },
});
