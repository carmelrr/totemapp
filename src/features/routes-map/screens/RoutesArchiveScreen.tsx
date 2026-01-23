/**
 * RoutesArchiveScreen - מסך ארכיון/פח אשפה למסלולים
 * מציג מסלולים שנמחקו עם אפשרות לשחזור או מחיקה לצמיתות
 * מסלולים נמחקים אוטומטית אחרי שבועיים
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Theme
import { useTheme } from '@/features/theme/ThemeContext';

// Language
import { useLanguage } from '@/features/language';

// Components
import WallMap from '@/components/WallMap/WallMap';

// Types and Services
import { RouteDoc } from '../types/route';
import { RoutesService } from '../services/RoutesService';

// Colors
import { getColorHex } from '@/constants/colors';

export default function RoutesArchiveScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage() as { t: any };
  const insets = useSafeAreaInsets();

  // State
  const [archivedRoutes, setArchivedRoutes] = useState<RouteDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Subscribe to archived routes
  useEffect(() => {
    setIsLoading(true);
    
    // Also clean up expired routes on screen load
    RoutesService.cleanupExpiredArchivedRoutes();
    
    const unsubscribe = RoutesService.subscribeArchivedRoutes(
      (routes) => {
        setArchivedRoutes(routes);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error loading archived routes:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Restore route handler
  const handleRestoreRoute = useCallback(async (route: RouteDoc) => {
    Alert.alert(
      t.archive?.restoreTitle || 'שחזור מסלול',
      t.archive?.restoreMessage || `האם לשחזר את המסלול "${route.name}"?`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.archive?.restore || 'שחזר',
          onPress: async () => {
            try {
              await RoutesService.restoreRoute(route.id);
              Alert.alert(
                t.common.success || 'הצלחה',
                t.archive?.restoreSuccess || 'המסלול שוחזר בהצלחה'
              );
            } catch (error) {
              console.error('Error restoring route:', error);
              Alert.alert(t.common.error, t.errors?.saveFailed || 'שגיאה בשחזור המסלול');
            }
          },
        },
      ]
    );
  }, [t]);

  // Permanent delete handler
  const handlePermanentDelete = useCallback(async (route: RouteDoc) => {
    Alert.alert(
      t.archive?.permanentDeleteTitle || 'מחיקה לצמיתות',
      t.archive?.permanentDeleteMessage || `האם למחוק לצמיתות את המסלול "${route.name}"? פעולה זו בלתי הפיכה!`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.archive?.deletePermanently || 'מחק לצמיתות',
          style: 'destructive',
          onPress: async () => {
            try {
              await RoutesService.deleteRoute(route.id);
              Alert.alert(
                t.common.success || 'הצלחה',
                t.archive?.deleteSuccess || 'המסלול נמחק לצמיתות'
              );
            } catch (error) {
              console.error('Error deleting route permanently:', error);
              Alert.alert(t.common.error, t.errors?.saveFailed || 'שגיאה במחיקת המסלול');
            }
          },
        },
      ]
    );
  }, [t]);

  // Route press handler
  const handleRoutePress = useCallback((route: RouteDoc) => {
    setSelectedRouteId(route.id === selectedRouteId ? null : route.id);
  }, [selectedRouteId]);

  // Get display grade
  const getDisplayGrade = (route: RouteDoc): string => {
    return route.calculatedGrade || route.grade || '';
  };

  // Render route item
  const renderRouteItem = useCallback(({ item: route }: { item: RouteDoc }) => {
    const daysRemaining = RoutesService.getDaysUntilDeletion(route);
    const isSelected = selectedRouteId === route.id;
    const colorHex = getColorHex(route.color) || route.color;

    return (
      <TouchableOpacity
        style={[
          styles.routeCard,
          isSelected && styles.routeCardSelected,
          { borderLeftColor: colorHex, borderLeftWidth: 4 }
        ]}
        onPress={() => handleRoutePress(route)}
        activeOpacity={0.7}
      >
        <View style={styles.routeHeader}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeName}>{route.name}</Text>
            <View style={styles.routeMeta}>
              <View style={[styles.gradeBadge, { backgroundColor: colorHex }]}>
                <Text style={styles.gradeText}>{getDisplayGrade(route)}</Text>
              </View>
              {route.setter && (
                <Text style={styles.setterText}>🧗 {route.setter}</Text>
              )}
            </View>
          </View>
          
          <View style={styles.daysRemaining}>
            <Ionicons 
              name="time-outline" 
              size={16} 
              color={daysRemaining <= 3 ? '#EF4444' : '#6B7280'} 
            />
            <Text style={[
              styles.daysText,
              daysRemaining <= 3 && styles.daysTextUrgent
            ]}>
              {daysRemaining} {t.archive?.daysLeft || 'ימים'}
            </Text>
          </View>
        </View>

        {/* Route Stats */}
        <View style={styles.routeStats}>
          {route.averageStarRating && route.averageStarRating > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statValue}>{route.averageStarRating.toFixed(1)}</Text>
            </View>
          )}
          {route.completionCount && route.completionCount > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>🏆</Text>
              <Text style={styles.statValue}>{route.completionCount}</Text>
            </View>
          )}
        </View>

        {/* Action buttons when selected */}
        {isSelected && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={() => handleRestoreRoute(route)}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.restoreButtonText}>
                {t.archive?.restore || 'שחזר'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handlePermanentDelete(route)}
            >
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.deleteButtonText}>
                {t.archive?.deletePermanently || 'מחק לצמיתות'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedRouteId, handleRoutePress, handleRestoreRoute, handlePermanentDelete, t]);

  // Selected route for map
  const selectedRoute = useMemo(() => {
    return archivedRoutes.find(r => r.id === selectedRouteId);
  }, [archivedRoutes, selectedRouteId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: '#374151' }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Ionicons name="trash-bin" size={24} color="#fff" />
          <Text style={styles.headerTitle}>
            {t.archive?.title || 'ארכיון מסלולים'}
          </Text>
        </View>
        
        {/* View mode toggle */}
        <TouchableOpacity
          style={styles.viewModeButton}
          onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
        >
          <Ionicons 
            name={viewMode === 'list' ? 'map' : 'list'} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#3B82F6" />
        <Text style={styles.infoText}>
          {t.archive?.infoText || 'מסלולים בארכיון נמחקים לצמיתות אחרי 14 יום'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : archivedRoutes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          <Text style={styles.emptyTitle}>
            {t.archive?.emptyTitle || 'הארכיון ריק'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t.archive?.emptySubtitle || 'אין מסלולים מחוקים'}
          </Text>
        </View>
      ) : viewMode === 'map' ? (
        // Map view
        <View style={styles.mapContainer}>
          <WallMap
            routes={archivedRoutes}
            wallWidth={2560}
            wallHeight={1600}
            selectedRouteId={selectedRouteId || undefined}
            onRoutePress={handleRoutePress}
            gesturesEnabled={true}
          />
          
          {/* Selected route info overlay */}
          {selectedRoute && (
            <View style={styles.mapOverlay}>
              <View style={styles.overlayContent}>
                <Text style={styles.overlayTitle}>{selectedRoute.name}</Text>
                <Text style={styles.overlayGrade}>{getDisplayGrade(selectedRoute)}</Text>
                <Text style={styles.overlayDays}>
                  {RoutesService.getDaysUntilDeletion(selectedRoute)} {t.archive?.daysLeft || 'ימים למחיקה'}
                </Text>
                
                <View style={styles.overlayButtons}>
                  <TouchableOpacity
                    style={[styles.overlayButton, styles.restoreButtonSmall]}
                    onPress={() => handleRestoreRoute(selectedRoute)}
                  >
                    <Text style={styles.overlayButtonText}>{t.archive?.restore || 'שחזר'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.overlayButton, styles.deleteButtonSmall]}
                    onPress={() => handlePermanentDelete(selectedRoute)}
                  >
                    <Text style={styles.overlayButtonText}>{t.archive?.deletePermanently || 'מחק'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : (
        // List view
        <FlatList
          data={archivedRoutes}
          keyExtractor={(item) => item.id}
          renderItem={renderRouteItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#3B82F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeCardSelected: {
    backgroundColor: '#F3F4F6',
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  setterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  daysRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  daysText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  daysTextUrgent: {
    color: '#EF4444',
    fontWeight: '700',
  },
  routeStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  restoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
  },
  restoreButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  mapContainer: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  overlayContent: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    padding: 16,
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  overlayGrade: {
    fontSize: 16,
    color: '#D1D5DB',
    marginTop: 4,
  },
  overlayDays: {
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 8,
  },
  overlayButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  overlayButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  restoreButtonSmall: {
    backgroundColor: '#10B981',
  },
  deleteButtonSmall: {
    backgroundColor: '#EF4444',
  },
  overlayButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
