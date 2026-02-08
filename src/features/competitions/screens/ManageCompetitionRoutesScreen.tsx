/**
 * @fileoverview Manage Competition Routes Screen
 * @description Add and manage routes for a competition, with wall map for positioning
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import { useLanguage } from '@/features/language/LanguageContext';
import { ROUTE_COLORS, getColorTranslationKey, getContrastTextColor } from '@/features/routes-map/utils/colors';
import {
  useCompetition,
  useCompetitionRoutes,
} from '@/features/competitions/hooks/useCompetition';
import { CompetitionRoutesService } from '@/features/competitions/services/CompetitionRoutesService';
import { CompetitionRoute } from '@/features/competitions/types';
import { NATIONAL_LEAGUE_GRADE_POINTS, TOTEMTITION_SETTINGS, isZoneTopFormat } from '@/features/competitions/constants';
import CompetitionWallMap from '@/features/competitions/components/CompetitionWallMap';
import { usePublishedRooms } from '@/features/wall-editor/hooks/usePublishedRooms';
import { useEditorMap } from '@/features/wall-editor/hooks/useEditorMap';
import { snapNormToNearestWall } from '@/utils/snapToWall';

// Wall dimensions (should match your actual wall)
const WALL_WIDTH = 1000;
const WALL_HEIGHT = 667;

type ViewMode = 'list' | 'map';

const AVAILABLE_GRADES = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
  '4', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '6c+',
  '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b',
];

export default function ManageCompetitionRoutesScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const { user } = useAuth();
  const rolesContext = useRolesContext();

  const { competition, loading: compLoading } = useCompetition(competitionId);
  const { routes, loading: routesLoading, refresh } = useCompetitionRoutes(competitionId);

  // Load room data for the dynamic wall map
  const { rooms: publishedRooms } = usePublishedRooms();
  const { room: specificRoom } = useEditorMap({ roomId: competition?.roomId });
  const mapRoom = useMemo(() => {
    if (competition?.roomId && specificRoom) return specificRoom;
    return publishedRooms.length > 0 ? publishedRooms[0] : null;
  }, [competition?.roomId, specificRoom, publishedRooms]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newRouteNumber, setNewRouteNumber] = useState('');

  // Check if this is Totemtition format (no grades needed)
  const isTotemtition = competition?.format === 'totemtition';
  const isZoneTop = competition?.format ? isZoneTopFormat(competition.format) : false;
  const [selectedGrade, setSelectedGrade] = useState('V3');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Per-route points for zone_top format
  const defaultTop = competition?.settings?.defaultPointsTop ?? 25;
  const defaultZone = competition?.settings?.defaultPointsZone ?? 10;
  const [newRoutePointsTop, setNewRoutePointsTop] = useState('');
  const [newRoutePointsZone, setNewRoutePointsZone] = useState('');
  
  // Edit route modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CompetitionRoute | null>(null);
  const [editPointsTop, setEditPointsTop] = useState('');
  const [editPointsZone, setEditPointsZone] = useState('');
  
  // View mode: list or map
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Selected route for map placement
  const [selectedRouteForPlacement, setSelectedRouteForPlacement] = useState<CompetitionRoute | null>(null);
  const [isPlacingRoute, setIsPlacingRoute] = useState(false);
  
  // Color picker modal
  const [showColorModal, setShowColorModal] = useState(false);
  const [selectedRouteForColor, setSelectedRouteForColor] = useState<CompetitionRoute | null>(null);

  const styles = createStyles(theme);

  // Check if user has permission to manage routes
  if (!rolesContext.canManageCompetitionRoutes) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-forward" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>מסלולי תחרות</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>אין הרשאה לגישה</Text>
          <Text style={styles.errorSubtext}>
            רק שופטים, שופטים ראשיים, ומנהלים יכולים לנהל מסלולים
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const loading = compLoading || routesLoading;

  const handleAddRoute = async () => {
    if (!newRouteNumber.trim() || !user) {
      Alert.alert('שגיאה', 'יש להזין מספר מסלול');
      return;
    }

    const routeNum = parseInt(newRouteNumber);
    if (isNaN(routeNum) || routeNum < 1) {
      Alert.alert('שגיאה', 'מספר מסלול לא תקין');
      return;
    }

    // Check if route number already exists
    if (routes.some(r => r.routeNumber === routeNum)) {
      Alert.alert('שגיאה', 'מסלול עם מספר זה כבר קיים');
      return;
    }

    setIsSubmitting(true);
    try {
      // For Totemtition, use 'TOTEM' as grade placeholder (points are calculated dynamically)
      const gradeToUse = isTotemtition ? 'TOTEM' : isZoneTop ? 'ZT' : selectedGrade;
      
      // Build per-route points for zone/top formats
      const routeData: {
        number: number;
        grade: string;
        xNorm: number;
        yNorm: number;
        pointsTop?: number;
        pointsZone?: number;
      } = {
        number: routeNum,
        grade: gradeToUse,
        xNorm: 0,
        yNorm: 0,
      };

      if (isZoneTop) {
        routeData.pointsTop = newRoutePointsTop ? parseFloat(newRoutePointsTop) : defaultTop;
        routeData.pointsZone = newRoutePointsZone ? parseFloat(newRoutePointsZone) : defaultZone;
      }

      await CompetitionRoutesService.addRoute(
        competitionId, 
        routeData,
        user.uid
      );

      setShowAddModal(false);
      setNewRouteNumber('');
      setNewRoutePointsTop('');
      setNewRoutePointsZone('');
      refresh();
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן להוסיף את המסלול');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMultipleRoutes = async () => {
    if (!competition || !user) return;
    
    const routeCount = competition.settings.maxRoutes;
    const formatLabel = isTotemtition ? '1000 נקודות לכל מסלול' : isZoneTop ? `T${defaultTop}/Z${defaultZone}` : 'V0-V8';

    Alert.alert(
      'הוספת מסלולים',
      `להוסיף ${routeCount} מסלולים (${formatLabel})?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const grades = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'];
              
              for (let i = 1; i <= competition.settings.maxRoutes; i++) {
                // For Totemtition - use 'TOTEM' grade, zone/top - use 'ZT', others - distribute grades
                let grade: string;
                if (isTotemtition) {
                  grade = 'TOTEM';
                } else if (isZoneTop) {
                  grade = 'ZT';
                } else {
                  // Assign grades in a balanced way
                  const gradeIndex = Math.min(Math.floor((i - 1) / (competition.settings.maxRoutes / grades.length)), grades.length - 1);
                  grade = grades[gradeIndex];
                }
                
                if (!routes.some(r => r.routeNumber === i)) {
                  const routeData: any = {
                    number: i,
                    grade,
                    xNorm: 0,
                    yNorm: 0,
                  };

                  // Add default zone/top points
                  if (isZoneTop) {
                    routeData.pointsTop = defaultTop;
                    routeData.pointsZone = defaultZone;
                  }

                  await CompetitionRoutesService.addRoute(
                    competitionId, 
                    routeData,
                    user.uid
                  );
                }
              }
              
              refresh();
              Alert.alert('הצלחה', 'המסלולים נוספו בהצלחה');
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן להוסיף את המסלולים');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteRoute = (routeToDelete: CompetitionRoute) => {
    Alert.alert(
      'מחיקת מסלול',
      `האם למחוק את מסלול ${routeToDelete.routeNumber}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await CompetitionRoutesService.deleteRoute(competitionId, routeToDelete.id);
              refresh();
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן למחוק את המסלול');
            }
          },
        },
      ]
    );
  };

  // Handle placing route on map
  const handleMapTap = useCallback(async (coordinates: { xNorm: number; yNorm: number }) => {
    if (!selectedRouteForPlacement) return;
    
    // Snap to nearest wall if room data is available
    let { xNorm, yNorm } = coordinates;
    if (mapRoom) {
      const snapped = snapNormToNearestWall(xNorm, yNorm, mapRoom);
      if (snapped.snapped) {
        xNorm = snapped.xNorm;
        yNorm = snapped.yNorm;
      }
    }

    setIsSubmitting(true);
    try {
      await CompetitionRoutesService.updateRoute(
        competitionId,
        selectedRouteForPlacement.id,
        {
          xNorm,
          yNorm,
        }
      );
      
      // Move to next unplaced route or exit placement mode
      const nextUnplaced = routes.find(r => 
        r.id !== selectedRouteForPlacement.id && 
        (!r.xNorm || !r.yNorm || r.xNorm === 0 || r.yNorm === 0)
      );
      
      if (nextUnplaced) {
        setSelectedRouteForPlacement(nextUnplaced);
      } else {
        setSelectedRouteForPlacement(null);
        setIsPlacingRoute(false);
        Alert.alert('הצלחה', 'כל המסלולים מוקמו על המפה');
      }
      
      refresh();
    } catch (error) {
      console.error('Error placing route:', error);
      Alert.alert('שגיאה', 'לא ניתן למקם את המסלול');
    } finally {
      setIsSubmitting(false);
    }
  }, [competitionId, selectedRouteForPlacement, routes, refresh, mapRoom]);

  // Start placing routes on map
  const handleStartPlacingRoutes = () => {
    const unplacedRoutes = routes.filter(r => !r.xNorm || !r.yNorm || r.xNorm === 0 || r.yNorm === 0);
    if (unplacedRoutes.length === 0) {
      Alert.alert('שים לב', 'כל המסלולים כבר ממוקמים על המפה');
      setViewMode('map');
      return;
    }
    
    setSelectedRouteForPlacement(unplacedRoutes[0]);
    setIsPlacingRoute(true);
    setViewMode('map');
  };

  // Handle route press on map (for repositioning)
  const handleRoutePress = useCallback((route: CompetitionRoute) => {
    if (isPlacingRoute) {
      setSelectedRouteForPlacement(route);
    }
  }, [isPlacingRoute]);

  // Handle color change for a route
  const handleOpenColorPicker = (route: CompetitionRoute) => {
    setSelectedRouteForColor(route);
    setShowColorModal(true);
  };

  // Handle editing route points (zone_top format)
  const handleOpenEditRoute = (route: CompetitionRoute) => {
    setEditingRoute(route);
    setEditPointsTop(String(route.pointsTop ?? defaultTop));
    setEditPointsZone(String(route.pointsZone ?? defaultZone));
    setShowEditModal(true);
  };

  const handleSaveEditRoute = async () => {
    if (!editingRoute) return;

    const pTop = parseFloat(editPointsTop);
    const pZone = parseFloat(editPointsZone);
    if (isNaN(pTop) || isNaN(pZone) || pTop < 0 || pZone < 0) {
      Alert.alert(t.competitions?.error || 'שגיאה', t.competitions?.invalidPoints || 'ערך ניקוד לא תקין');
      return;
    }

    setIsSubmitting(true);
    try {
      await CompetitionRoutesService.updateRoute(
        competitionId,
        editingRoute.id,
        { pointsTop: pTop, pointsZone: pZone }
      );
      setShowEditModal(false);
      setEditingRoute(null);
      refresh();
    } catch (error) {
      Alert.alert(t.competitions?.error || 'שגיאה', 'לא ניתן לעדכן את הניקוד');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorSelect = async (colorHex: string) => {
    if (!selectedRouteForColor) return;
    
    setIsSubmitting(true);
    try {
      await CompetitionRoutesService.updateRoute(
        competitionId,
        selectedRouteForColor.id,
        { color: colorHex }
      );
      setShowColorModal(false);
      setSelectedRouteForColor(null);
      refresh();
    } catch (error) {
      console.error('Error updating route color:', error);
      Alert.alert('שגיאה', 'לא ניתן לעדכן את צבע המסלול');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get routes positioned on map
  const positionedRoutes = routes.filter(r => r.xNorm && r.yNorm && r.xNorm > 0 && r.yNorm > 0);
  const unpositionedRoutes = routes.filter(r => !r.xNorm || !r.yNorm || r.xNorm === 0 || r.yNorm === 0);

  const handleDeleteAllRoutes = () => {
    Alert.alert(
      'מחיקת כל המסלולים',
      'האם אתה בטוח? פעולה זו לא ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק הכל',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              for (const r of routes) {
                await CompetitionRoutesService.deleteRoute(competitionId, r.id);
              }
              refresh();
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן למחוק את המסלולים');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderRouteItem = ({ item }: { item: CompetitionRoute }) => {
    // Display logic per format
    const isTotemRoute = item.grade === 'TOTEM';
    const isZoneTopRoute = item.grade === 'ZT' || (isZoneTop && item.grade !== 'TOTEM');
    const routeColor = item.color || '#3b82f6'; // Default blue if no color set

    let displayGrade: string;
    let pointsLabel: string;

    if (isTotemRoute) {
      displayGrade = '🎯';
      pointsLabel = '1000÷N נק\'';
    } else if (isZoneTopRoute) {
      const pTop = item.pointsTop ?? defaultTop;
      const pZone = item.pointsZone ?? defaultZone;
      displayGrade = `T${pTop}`;
      pointsLabel = `Z${pZone} / T${pTop}`;
    } else {
      const points = NATIONAL_LEAGUE_GRADE_POINTS[item.grade] || 100;
      displayGrade = item.grade;
      pointsLabel = `${points} נקודות`;
    }
    
    return (
      <View style={styles.routeItem}>
        <View style={[styles.routeNumber, { backgroundColor: routeColor }]}>
          <Text style={[styles.routeNumberText, { color: getContrastTextColor(routeColor) }]}>
            {item.routeNumber}
          </Text>
        </View>
        <View style={styles.routeInfo}>
          <Text style={styles.routeGrade}>{displayGrade}</Text>
          <Text style={styles.routePoints}>{pointsLabel}</Text>
        </View>
        {/* Edit points button - zone_top format */}
        {isZoneTop && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleOpenEditRoute(item)}
          >
            <Ionicons name="pencil" size={16} color={theme.primary} />
          </TouchableOpacity>
        )}
        {/* Color picker button - only for head judges and admins */}
        {(rolesContext.isHeadJudge || rolesContext.isAdmin) && (
          <TouchableOpacity
            style={[styles.colorBtn, { backgroundColor: routeColor }]}
            onPress={() => handleOpenColorPicker(item)}
          >
            <Ionicons name="color-palette" size={16} color={getContrastTextColor(routeColor)} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteRoute(item)}
        >
          <Ionicons name="trash-outline" size={20} color={theme.error || '#e74c3c'} />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (isPlacingRoute) {
              setIsPlacingRoute(false);
              setSelectedRouteForPlacement(null);
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-forward" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isPlacingRoute ? `מיקום מסלול ${selectedRouteForPlacement?.routeNumber}` : '🗺️ מסלולי תחרות'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
          onPress={() => {
            setViewMode('list');
            setIsPlacingRoute(false);
            setSelectedRouteForPlacement(null);
          }}
        >
          <Ionicons 
            name="list" 
            size={18} 
            color={viewMode === 'list' ? '#fff' : theme.primary} 
          />
          <Text style={[styles.viewModeBtnText, viewMode === 'list' && styles.viewModeBtnTextActive]}>
            רשימה
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'map' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons 
            name="map" 
            size={18} 
            color={viewMode === 'map' ? '#fff' : theme.primary} 
          />
          <Text style={[styles.viewModeBtnText, viewMode === 'map' && styles.viewModeBtnTextActive]}>
            מפה
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{routes.length}</Text>
          <Text style={styles.statLabel}>מסלולים</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{positionedRoutes.length}</Text>
          <Text style={styles.statLabel}>על המפה</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {competition?.settings.maxRoutes || 30}
          </Text>
          <Text style={styles.statLabel}>מקסימום</Text>
        </View>
      </View>

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>הוסף מסלול</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bulkBtn}
              onPress={handleAddMultipleRoutes}
            >
              <Ionicons name="copy" size={18} color={theme.primary} />
              <Text style={styles.bulkBtnText}>הוסף מרובים</Text>
            </TouchableOpacity>

            {routes.length > 0 && (
              <TouchableOpacity
                style={styles.deleteAllBtn}
                onPress={handleDeleteAllRoutes}
              >
                <Ionicons name="trash" size={18} color="#e74c3c" />
              </TouchableOpacity>
            )}
          </View>

          {/* Map placement button */}
          {routes.length > 0 && (
            <TouchableOpacity
              style={styles.mapPlacementBtn}
              onPress={handleStartPlacingRoutes}
            >
              <Ionicons name="location" size={20} color="#fff" />
              <Text style={styles.mapPlacementBtnText}>
                מקם מסלולים על המפה ({unpositionedRoutes.length} לא ממוקמים)
              </Text>
            </TouchableOpacity>
          )}

          {/* Routes List */}
          <FlatList
            data={routes.sort((a, b) => a.routeNumber - b.routeNumber)}
            keyExtractor={(item) => item.id}
            renderItem={renderRouteItem}
            extraData={routes.map(r => `${r.id}-${r.color}`).join(',')}
            contentContainerStyle={styles.listContent}
            numColumns={2}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={64} color={theme.textSecondary} />
                <Text style={styles.emptyText}>אין מסלולים עדיין</Text>
                <Text style={styles.emptySubtext}>
                  הוסף מסלולים לתחרות
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <View style={styles.mapContainer}>
          {routes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={64} color={theme.textSecondary} />
              <Text style={styles.emptyText}>אין מסלולים</Text>
              <Text style={styles.emptySubtext}>
                הוסף מסלולים קודם ברשימה
              </Text>
            </View>
          ) : (
            <>
              <CompetitionWallMap
                routes={positionedRoutes}
                wallWidth={mapRoom?.width || WALL_WIDTH}
                wallHeight={mapRoom?.height || WALL_HEIGHT}
                format={competition?.format || 'national_league'}
                isEditing={isPlacingRoute}
                onMapTap={isPlacingRoute ? handleMapTap : undefined}
                onRoutePress={handleRoutePress}
                selectedRouteId={selectedRouteForPlacement?.id}
                room={mapRoom}
              />
              
              {/* Placement mode controls */}
              {isPlacingRoute && (
                <View style={styles.placementControls}>
                  <Text style={styles.placementText}>
                    לחץ על המפה למיקום מסלול {selectedRouteForPlacement?.routeNumber}
                  </Text>
                  <View style={styles.placementButtons}>
                    {unpositionedRoutes.length > 0 && (
                      <TouchableOpacity
                        style={styles.skipBtn}
                        onPress={() => {
                          const currentIndex = unpositionedRoutes.findIndex(
                            r => r.id === selectedRouteForPlacement?.id
                          );
                          const nextIndex = (currentIndex + 1) % unpositionedRoutes.length;
                          setSelectedRouteForPlacement(unpositionedRoutes[nextIndex]);
                        }}
                      >
                        <Text style={styles.skipBtnText}>דלג</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.cancelPlacementBtn}
                      onPress={() => {
                        setIsPlacingRoute(false);
                        setSelectedRouteForPlacement(null);
                      }}
                    >
                      <Text style={styles.cancelPlacementBtnText}>סיום</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Start placement button when not in placement mode */}
              {!isPlacingRoute && unpositionedRoutes.length > 0 && (
                <TouchableOpacity
                  style={styles.startPlacementBtn}
                  onPress={handleStartPlacingRoutes}
                >
                  <Ionicons name="location" size={20} color="#fff" />
                  <Text style={styles.startPlacementBtnText}>
                    מקם {unpositionedRoutes.length} מסלולים
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Loading overlay */}
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>מעבד...</Text>
        </View>
      )}

      {/* Add Route Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>הוספת מסלול</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>מספר מסלול</Text>
              <TextInput
                style={styles.input}
                value={newRouteNumber}
                onChangeText={setNewRouteNumber}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={theme.textSecondary}
                textAlign="center"
              />
            </View>

            {/* Hide grade selection for Totemtition and Zone/Top formats */}
            {!isTotemtition && !isZoneTop && (
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>דרגת קושי</Text>
                <View style={styles.gradesGrid}>
                  {['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'].map((grade) => (
                    <TouchableOpacity
                      key={grade}
                      style={[
                        styles.gradeOption,
                        selectedGrade === grade && styles.gradeOptionSelected,
                      ]}
                      onPress={() => setSelectedGrade(grade)}
                    >
                      <Text style={[
                        styles.gradeOptionText,
                        selectedGrade === grade && styles.gradeOptionTextSelected,
                      ]}>
                        {grade}
                      </Text>
                      <Text style={styles.gradePoints}>
                        {NATIONAL_LEAGUE_GRADE_POINTS[grade]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Show Totemtition scoring info */}
            {isTotemtition && (
              <View style={styles.totemtitionInfo}>
                <Text style={styles.totemtitionInfoText}>
                  🎯 מסלולי תחרוטוטם: 1000 נקודות מחולקות בין כל המשלימים
                </Text>
              </View>
            )}

            {/* Zone/Top per-route points */}
            {isZoneTop && (
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>{t.competitions?.pointsTopLabel || 'נקודות ל-Top'}</Text>
                <TextInput
                  style={styles.input}
                  value={newRoutePointsTop}
                  onChangeText={setNewRoutePointsTop}
                  keyboardType="decimal-pad"
                  placeholder={String(defaultTop)}
                  placeholderTextColor={theme.textSecondary}
                  textAlign="center"
                />
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>{t.competitions?.pointsZoneLabel || 'נקודות ל-Zone'}</Text>
                <TextInput
                  style={styles.input}
                  value={newRoutePointsZone}
                  onChangeText={setNewRoutePointsZone}
                  keyboardType="decimal-pad"
                  placeholder={String(defaultZone)}
                  placeholderTextColor={theme.textSecondary}
                  textAlign="center"
                />
                <Text style={styles.zoneTopHint}>
                  {t.competitions?.perRoutePointsHint || 'השאר ריק לשימוש בברירת מחדל'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddRoute}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>הוסף מסלול</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowColorModal(false);
          setSelectedRouteForColor(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                בחר צבע למסלול {selectedRouteForColor?.routeNumber}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowColorModal(false);
                  setSelectedRouteForColor(null);
                }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.colorGrid}>
              {ROUTE_COLORS.map((colorHex) => {
                const colorKey = getColorTranslationKey(colorHex);
                const colorName = t.colors[colorKey as keyof typeof t.colors] || colorKey;
                
                return (
                  <TouchableOpacity
                    key={colorHex}
                    style={[
                      styles.colorOption,
                      { backgroundColor: colorHex },
                      selectedRouteForColor?.color === colorHex && styles.colorOptionSelected,
                    ]}
                    onPress={() => handleColorSelect(colorHex)}
                  >
                    <Text style={[styles.colorOptionText, { color: getContrastTextColor(colorHex) }]}>
                      {colorName}
                    </Text>
                    {selectedRouteForColor?.color === colorHex && (
                      <Ionicons name="checkmark" size={18} color={getContrastTextColor(colorHex)} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Route Points Modal (zone_top) */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingRoute(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t.competitions?.editRoutePoints || 'עריכת ניקוד'} - {t.competitions?.routeLabel || 'מסלול'} {editingRoute?.routeNumber}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingRoute(null);
                }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>{t.competitions?.pointsTopLabel || 'נקודות ל-Top'}</Text>
              <TextInput
                style={styles.input}
                value={editPointsTop}
                onChangeText={setEditPointsTop}
                keyboardType="decimal-pad"
                placeholder={String(defaultTop)}
                placeholderTextColor={theme.textSecondary}
                textAlign="center"
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>{t.competitions?.pointsZoneLabel || 'נקודות ל-Zone'}</Text>
              <TextInput
                style={styles.input}
                value={editPointsZone}
                onChangeText={setEditPointsZone}
                keyboardType="decimal-pad"
                placeholder={String(defaultZone)}
                placeholderTextColor={theme.textSecondary}
                textAlign="center"
              />
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSaveEditRoute}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{t.competitions?.saveResult || 'שמור'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    placeholder: {
      width: 32,
    },
    statsBar: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      padding: 12,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      padding: 16,
      gap: 8,
    },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.buttonPrimary,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 6,
    },
    addBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    bulkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    bulkBtnText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    deleteAllBtn: {
      backgroundColor: '#e74c3c20',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#e74c3c',
    },
    listContent: {
      padding: 8,
      paddingBottom: 100,
    },
    routeItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      margin: 4,
    },
    routeNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    routeNumberText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    routeInfo: {
      flex: 1,
      marginLeft: 12,
    },
    routeGrade: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    routePoints: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    deleteBtn: {
      padding: 8,
    },
    editBtn: {
      padding: 8,
      marginRight: 4,
    },
    zoneTopHint: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: '#fff',
      marginTop: 12,
      fontSize: 14,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
    inputSection: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'right',
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
    },
    gradesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    gradeOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    gradeOptionSelected: {
      backgroundColor: theme.primary,
    },
    gradeOptionText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    gradeOptionTextSelected: {
      color: '#fff',
    },
    gradePoints: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 2,
    },
    submitBtn: {
      backgroundColor: theme.buttonPrimary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Error container styles
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    errorSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    backBtn: {
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: theme.buttonPrimary,
      borderRadius: 8,
    },
    backBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Totemtition info box
    totemtitionInfo: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    totemtitionInfoText: {
      fontSize: 14,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 22,
    },
    // View mode toggle
    viewModeToggle: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 4,
    },
    viewModeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
    },
    viewModeBtnActive: {
      backgroundColor: theme.primary,
    },
    viewModeBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
    },
    viewModeBtnTextActive: {
      color: '#fff',
    },
    // Map container
    mapContainer: {
      flex: 1,
      marginTop: 8,
    },
    // Map placement button
    mapPlacementBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#3b82f6',
      marginHorizontal: 16,
      marginBottom: 8,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 8,
    },
    mapPlacementBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    // Placement controls
    placementControls: {
      position: 'absolute',
      bottom: 20,
      left: 16,
      right: 16,
      backgroundColor: 'rgba(59, 130, 246, 0.95)',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
    },
    placementText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      textAlign: 'center',
    },
    placementButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    skipBtn: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 10,
    },
    skipBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    cancelPlacementBtn: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      backgroundColor: '#fff',
      borderRadius: 10,
    },
    cancelPlacementBtnText: {
      color: '#3b82f6',
      fontSize: 14,
      fontWeight: '600',
    },
    startPlacementBtn: {
      position: 'absolute',
      bottom: 20,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#3b82f6',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    startPlacementBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    // Color picker styles
    colorBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
      borderWidth: 2,
      borderColor: 'rgba(0,0,0,0.1)',
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'center',
      paddingVertical: 10,
    },
    colorOption: {
      width: '30%',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: theme.primary,
      borderWidth: 3,
    },
    colorOptionText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
