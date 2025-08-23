import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// New Architecture Components
import WallMap from '../../../components/WallMap/WallMap';
import { FiltersBar, FiltersSheet } from '../../../components/Filters';
import { RoutesList } from '../../../components/Lists';

// Existing Components (for compatibility)
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
  
  // Data
  const { routes, isLoading, error } = useFirebaseRoutes();
  
  // Filters Store
  const { getFilteredRoutes, isFilterSheetOpen } = useFiltersStore();

  // Filtered routes based on current filters
  const filteredRoutes = useMemo(() => {
    return getFilteredRoutes(routes);
  }, [routes, getFilteredRoutes]);

  // Handlers
  const handleRoutePress = useCallback((route: RouteDoc) => {
    setSelectedRoute(route);
    setShowBottomSheet(true);
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

  const handleDebug = useCallback(() => {
    Alert.alert(
      'מידע דיבוג',
      `מסלולים נטענו: ${routes.length}\n` +
      `טוען: ${isLoading}\n` +
      `שגיאה: ${error ? error.message : 'אין'}\n` +
      `מסלולים מסוננים: ${filteredRoutes.length}`
    );
  }, [routes, isLoading, error, filteredRoutes]);

  const availableColors = useMemo(() => {
    const colors = new Set(routes.map(route => route.color).filter(Boolean));
    return Array.from(colors);
  }, [routes]);

  const availableGrades = useMemo(() => {
    const grades = new Set(routes.map(route => route.grade).filter(Boolean));
    return Array.from(grades).sort();
  }, [routes]);

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
    <WallMap
      routes={filteredRoutes}
      onRoutePress={handleRoutePress}
      selectedRouteId={selectedRoute?.id}
      wallWidth={2560}
      wallHeight={1600}
    />
  );

  const renderListView = () => (
    <RoutesList
      routes={filteredRoutes}
      onRoutePress={handleRoutePress}
    />
  );

  const renderSplitView = () => (
    <>
      <View style={styles.mapSection}>
        {renderMapView()}
      </View>
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            מסלולים ({filteredRoutes.length})
          </Text>
          {isLoading && <Text style={styles.loadingText}>טוען...</Text>}
        </View>
        {renderListView()}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Filters Bar */}
      <FiltersBar
        availableColors={availableColors}
        availableGrades={availableGrades}
      />

      {/* Content Area */}
      <View style={styles.contentArea}>
        {viewMode === 'map' && renderMapView()}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'split' && renderSplitView()}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'map' && styles.activeViewMode]}
          onPress={() => setViewMode('map')}
        >
          <Text style={[styles.viewModeText, viewMode === 'map' && styles.activeViewModeText]}>🗺️</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'split' && styles.activeViewMode]}
          onPress={() => setViewMode('split')}
        >
          <Text style={[styles.viewModeText, viewMode === 'split' && styles.activeViewModeText]}>⚏</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewMode]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewModeText, viewMode === 'list' && styles.activeViewModeText]}>📋</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.debugButton]}
          onPress={handleDebug}
        >
          <Text style={styles.actionButtonText}>🐛</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.addButton]}
          onPress={handleAddRoute}
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
  mapSection: {
    flex: 3,
    position: 'relative',
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
});
