/**
 * @fileoverview Points Competition Screen
 * @description Main screen for the Points Competition format.
 * Shows existing wall map routes, allows self-entry of completions,
 * displays leaderboard. Syncs completions back to userRoutes.
 * 
 * Scoring: VB=1pt, V0=1pt, V1=1pt, V2=2pts ... V8=8pts (grade number = points, min 1)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useAuth } from '@/context/AuthContext';
import { useCompetition } from '../hooks/useCompetition';
import { ResultsService } from '../services/ResultsService';
import { ParticipantService } from '../services/ParticipantService';
import { FeedbackService } from '@/features/routes-map/services/FeedbackService';
import { useRoutesStore } from '@/store/routesStore';
import { useFiltersStore, filterRoutes } from '@/store/useFiltersStore';
import { useWallTapes } from '@/features/routes-map/hooks/useWallTapes';
import FiltersBar from '@/components/Filters/FiltersBar';
import FiltersSheet from '@/components/Filters/FiltersSheet';
import { useUserRouteStatus } from '@/hooks/useUserRouteStatus';
import { RouteDoc } from '@/features/routes-map/types/route';
import {
  POINTS_COMPETITION_GRADE_POINTS,
  calculatePointsCompetitionRoutePoints,
} from '../constants';
import { RouteResult, ParticipantResult, LeaderboardEntry, Competition, CompetitionRoute } from '../types';
import { CompetitionWallMap } from '../components';
import { usePublishedRooms, useEditorMap } from '@/features/wall-editor';
import { useUser } from '@/features/auth';
import { getRouteDisplayName } from '@/features/routes-map/utils/colors';
import {
  doc,
  onSnapshot,
  collection,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';

// Grade → color mapping for visual consistency
const GRADE_COLORS: Record<string, string> = {
  'VB': '#9CA3AF',
  'V0': '#22C55E',
  'V1': '#16A34A',
  'V2': '#EAB308',
  'V3': '#F97316',
  'V4': '#EF4444',
  'V5': '#DC2626',
  'V6': '#9333EA',
  'V7': '#7C3AED',
  'V8': '#1D4ED8',
  'V9': '#111827',
  'V10': '#111827',
};

export default function PointsCompetitionScreen() {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { competitionId } = route.params;

  // Competition data
  const { competition, loading: competitionLoading } = useCompetition(competitionId);

  // Wall routes from routesStore
  const wallRoutes = useRoutesStore((s) => s.routes);
  const initializeRoutes = useRoutesStore((s) => s.initializeRoutes);

  // User route status (for sync back to wall map)
  const { updateRouteStatus, getRouteStatus } = useUserRouteStatus();

  // Competition results for current user
  const [myResult, setMyResult] = useState<ParticipantResult | null>(null);
  const [isParticipant, setIsParticipant] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [processingRoute, setProcessingRoute] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'routes' | 'map' | 'leaderboard'>('routes');
  const [refreshing, setRefreshing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  // Route confirmation popup state (for map tab)
  const [confirmRoute, setConfirmRoute] = useState<RouteDoc | null>(null);
  // Feedback state for new route completions
  const [feedbackStarRating, setFeedbackStarRating] = useState(0);
  const [feedbackGrade, setFeedbackGrade] = useState('');

  const styles = createStyles(theme);
  const userId = user?.uid;

  // Room data for map display
  const { rooms: publishedRooms } = usePublishedRooms();
  const { room: specificRoom } = useEditorMap({ roomId: competition?.roomId });
  const { circleSize: userCircleSize } = useUser();
  const mapRoom = useMemo(() => {
    if (competition?.roomId && specificRoom) return specificRoom;
    return publishedRooms.length > 0 ? publishedRooms[0] : null;
  }, [competition?.roomId, specificRoom, publishedRooms]);

  // Convert wall routes to CompetitionRoute format for map display
  const mapRoutes = useMemo((): CompetitionRoute[] => {
    return wallRoutes
      .filter(r => r.status === 'active' && r.xNorm > 0 && r.yNorm > 0)
      .map((r, idx) => ({
        id: r.id,
        competitionId: competitionId || '',
        routeNumber: idx + 1,
        grade: r.grade || 'V0',
        basePoints: calculatePointsCompetitionRoutePoints(r.grade || 'V0'),
        xNorm: r.xNorm,
        yNorm: r.yNorm,
        color: r.color,
        isActive: true,
        setBy: r.setter,
        createdAt: r.createdAt?.toDate?.() || new Date(),
      }));
  }, [wallRoutes, competitionId]);

  // Filter-related state for map tab
  const { filters, sorting, searchQuery, resetFilters } = useFiltersStore();

  // Available colors and grades for filter UI
  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    wallRoutes.forEach(r => { if (r.color && r.status === 'active') colors.add(r.color); });
    return Array.from(colors);
  }, [wallRoutes]);

  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    wallRoutes.forEach(r => { if (r.grade && r.status === 'active') grades.add(r.grade); });
    return Array.from(grades);
  }, [wallRoutes]);

  // Ensure wall routes are loaded
  useEffect(() => {
    initializeRoutes();
  }, [initializeRoutes]);

  // Check if user is a participant
  useEffect(() => {
    if (!competitionId || !userId) {
      setIsParticipant(false);
      return;
    }
    
    let cancelled = false;
    ParticipantService.getParticipantByUserId(competitionId, userId)
      .then((p) => {
        if (!cancelled) {
          setIsParticipant(p !== null && p.status === 'approved');
        }
      })
      .catch(() => {
        if (!cancelled) setIsParticipant(false);
      });

    return () => { cancelled = true; };
  }, [competitionId, userId]);

  // Subscribe to my results
  useEffect(() => {
    if (!competitionId || !userId) {
      setMyResult(null);
      setLoadingResults(false);
      return;
    }

    const resultRef = doc(db, 'competitions', competitionId, 'results', userId);
    const unsubscribe = onSnapshot(
      resultRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMyResult({
            id: docSnap.id,
            competitionId: data.competitionId,
            participantId: docSnap.id,
            participantName: data.participantName || data.userName || 'Unknown',
            userName: data.userName || data.participantName || 'Unknown',
            photoURL: data.photoURL || null,
            category: data.category,
            categoryName: data.categoryName,
            routes: data.routes || {},
            routesCompleted: data.routesCompleted || 0,
            totalPoints: data.totalPoints || 0,
            top7Points: data.top7Points || 0,
            lastUpdated: data.lastUpdated?.toDate() || new Date(),
          });
        } else {
          setMyResult(null);
        }
        setLoadingResults(false);
      },
      () => {
        setMyResult(null);
        setLoadingResults(false);
      }
    );

    return () => unsubscribe();
  }, [competitionId, userId]);

  // Subscribe to leaderboard
  useEffect(() => {
    if (!competitionId) return;

    const unsubscribe = ResultsService.subscribeToPointsCompetitionLeaderboard(
      competitionId,
      (entries) => setLeaderboard(entries)
    );

    return () => unsubscribe();
  }, [competitionId]);

  // Wall-tape catalog for tolerant wallTape filter matching
  const { tapes: wallTapesCatalog } = useWallTapes();

  // Get map of completed route IDs in competition
  const completedRouteIds = useMemo(() => {
    const ids = new Set<string>();
    if (myResult?.routes) {
      const routeValues = Array.isArray(myResult.routes) 
        ? myResult.routes 
        : Object.values(myResult.routes);
      routeValues.forEach((r: RouteResult) => {
        if (r.completed && r.routeId) {
          ids.add(r.routeId);
        }
      });
    }
    return ids;
  }, [myResult]);

  // Apply filters to map routes (must be after completedRouteIds)
  const filteredMapRoutes = useMemo((): CompetitionRoute[] => {
    const activeWallRoutes = wallRoutes.filter(r => r.status === 'active' && r.xNorm > 0 && r.yNorm > 0);
    const filtersForMap = { ...filters, showOnlyVisibleOnMap: false, status: ['active' as const] };
    const filtered = filterRoutes(activeWallRoutes, filtersForMap, { sortBy: 'grade', sortOrder: 'asc' }, '', undefined, completedRouteIds, wallTapesCatalog);
    const filteredIds = new Set(filtered.map(r => r.id));
    return mapRoutes.filter(mr => filteredIds.has(mr.id));
  }, [wallRoutes, mapRoutes, filters, completedRouteIds, wallTapesCatalog]);

  // Calculate total points
  const totalPoints = useMemo(() => {
    let sum = 0;
    if (myResult?.routes) {
      const routeValues = Array.isArray(myResult.routes) 
        ? myResult.routes 
        : Object.values(myResult.routes);
      routeValues.forEach((r: RouteResult) => {
        if (r.completed) {
          sum += r.points || 0;
        }
      });
    }
    return sum;
  }, [myResult]);

  // Sort routes by grade (ascending)
  const sortedRoutes = useMemo(() => {
    const activeRoutes = wallRoutes.filter(r => r.status === 'active');
    return [...activeRoutes].sort((a, b) => {
      const gradeOrder = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];
      const aIdx = gradeOrder.indexOf(a.grade);
      const bIdx = gradeOrder.indexOf(b.grade);
      return aIdx - bIdx;
    });
  }, [wallRoutes]);

  // Handle marking a route as completed in the competition
  const handleToggleRoute = useCallback(async (wallRoute: RouteDoc, feedbackData?: { starRating: number; suggestedGrade: string }) => {
    if (!userId || !competitionId || !competition) return;
    if (processingRoute) return;

    const isCompleted = completedRouteIds.has(wallRoute.id);
    setProcessingRoute(wallRoute.id);

    try {
      if (isCompleted) {
        // Undo: remove the route result
        await ResultsService.removeRouteResult(competitionId, userId, wallRoute.id);
      } else {
        // Mark as completed
        const grade = wallRoute.grade || 'V0';
        // Use index in sorted routes as route number key (points_competition uses routeId for lookup)
        const routeIndex = sortedRoutes.findIndex(r => r.id === wallRoute.id);
        const routeNumber = routeIndex >= 0 ? routeIndex + 1 : 0;
        const points = calculatePointsCompetitionRoutePoints(grade);

        await ResultsService.enterRouteResult(
          competitionId,
          userId,
          routeNumber,
          {
            routeId: wallRoute.id,
            completed: true,
            attempts: 1,
            grade,
          },
          userId,
          true, // self-report
          competition
        );

        // Sync back to wall map: if route not already sent on wall, mark it and add feedback
        const wallStatus = getRouteStatus(wallRoute.id);
        if (wallStatus === 'unsent' || wallStatus === 'project') {
          try {
            await updateRouteStatus(wallRoute.id, 'sent');

            // Add feedback to route so it counts in statistics
            if (feedbackData && feedbackData.starRating > 0) {
              await FeedbackService.addFeedbackToRoute(wallRoute.id, {
                userId,
                userDisplayName: user?.displayName || '',
                userPhotoURL: user?.photoURL || '',
                starRating: feedbackData.starRating,
                suggestedGrade: feedbackData.suggestedGrade || grade,
                comment: '',
                isCompleted: true,
              });
            } else {
              // Minimal feedback for statistics
              await FeedbackService.addFeedbackToRoute(wallRoute.id, {
                userId,
                userDisplayName: user?.displayName || '',
                userPhotoURL: user?.photoURL || '',
                starRating: 3,
                suggestedGrade: grade,
                comment: '',
                isCompleted: true,
              });
            }
          } catch (syncError) {
            // Non-critical: log but don't fail the competition action
            console.warn('Could not sync route to wall map:', syncError);
          }
        }
      }
    } catch (error: any) {
      console.error('Error toggling route:', error);
      Alert.alert(
        t.common.error,
        error.message || t.competitionExt.cannotSaveScore
      );
    } finally {
      setProcessingRoute(null);
    }
  }, [userId, competitionId, competition, processingRoute, completedRouteIds, getRouteStatus, updateRouteStatus, t, user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Handle join points competition
  const handleJoinCompetition = useCallback(async () => {
    if (!userId || !competitionId || !user) return;

    Alert.alert(
      t.competitionExt.pointsCompetitionJoin,
      t.competitionExt.pointsCompetitionJoinConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.competitionExt.pointsCompetitionJoin,
          onPress: async () => {
            setIsJoining(true);
            try {
              await ParticipantService.joinPointsCompetition(competitionId, userId, {
                displayName: user.displayName || '',
                email: user.email || undefined,
                photoURL: user.photoURL || undefined,
              });
              setIsParticipant(true);
              Alert.alert(t.common.success, t.competitionExt.pointsCompetitionJoined);
            } catch (error: any) {
              console.error('Error joining competition:', error);
              Alert.alert(t.common.error, error.message || t.competitionExt.pointsCompetitionJoinError);
            } finally {
              setIsJoining(false);
            }
          },
        },
      ]
    );
  }, [userId, competitionId, user, t]);

  // Competition state checks
  const isActive = competition?.status === 'active';
  const isCompleted = competition?.status === 'completed' || competition?.status === 'closed';

  // Loading state
  if (competitionLoading || loadingResults) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t.competitionExt.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!competition) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyText}>{t.competitionExt.competitionNotFound}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Route item renderer
  const renderRouteItem = ({ item }: { item: RouteDoc }) => {
    const isRouteCompleted = completedRouteIds.has(item.id);
    const grade = item.grade || 'V0';
    const points = calculatePointsCompetitionRoutePoints(grade);
    const gradeColor = GRADE_COLORS[grade] || theme.textSecondary;
    const isProcessing = processingRoute === item.id;
    const routeName = getRouteDisplayName(item, language, t);

    return (
      <TouchableOpacity
        style={[
          styles.routeItem,
          isRouteCompleted && styles.routeItemCompleted,
        ]}
        onPress={() => {
          if (!isActive || !isParticipant) return;
          if (isRouteCompleted) {
            // Undo - toggle directly
            handleToggleRoute(item);
          } else {
            // Show confirmation popup
            setFeedbackStarRating(0);
            setFeedbackGrade(item.grade || '');
            setConfirmRoute(item);
          }
        }}
        disabled={!isActive || !isParticipant || isProcessing}
        activeOpacity={0.7}
      >
        <View style={[styles.gradeCircle, { backgroundColor: gradeColor }]}>
          <Text style={styles.gradeText}>{grade}</Text>
        </View>

        <View style={styles.routeInfo}>
          <Text style={[styles.routeName, isRouteCompleted && styles.routeNameCompleted]}>
            {routeName}
          </Text>
          {item.setter && (
            <Text style={styles.routeSetter}>{item.setter}</Text>
          )}
        </View>

        <View style={styles.routeRight}>
          <Text style={[styles.pointsBadge, isRouteCompleted && styles.pointsBadgeCompleted]}>
            {points} {language === 'he' ? "נק'" : 'pts'}
          </Text>
          
          {isProcessing ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: 8 }} />
          ) : isRouteCompleted ? (
            <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
          ) : (
            isActive && isParticipant && (
              <Ionicons name="ellipse-outline" size={28} color={theme.textSecondary} />
            )
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Leaderboard item renderer
  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.userId === userId;
    const rankEmoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '';

    return (
      <View style={[styles.leaderboardItem, isMe && styles.leaderboardItemMe]}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>
            {rankEmoji || `#${item.rank}`}
          </Text>
        </View>
        <View style={styles.leaderboardInfo}>
          <Text style={[styles.leaderboardName, isMe && styles.leaderboardNameMe]}>
            {item.participantName || item.userName || 'Unknown'}
            {isMe ? (language === 'he' ? ' (אתה)' : ' (You)') : ''}
          </Text>
          <Text style={styles.leaderboardStats}>
            {item.routesCompleted} {t.competition.routesCompleted}
          </Text>
        </View>
        <Text style={[styles.leaderboardPoints, isMe && styles.leaderboardPointsMe]}>
          {item.totalPoints || item.points || 0}
        </Text>
      </View>
    );
  };

  // Header component for routes list
  const RoutesListHeader = () => (
    <View style={styles.scoreHeader}>
      {/* Score summary card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{totalPoints}</Text>
            <Text style={styles.scoreLabel}>
              {language === 'he' ? 'נקודות' : 'Points'}
            </Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{completedRouteIds.size}</Text>
            <Text style={styles.scoreLabel}>
              {language === 'he' ? 'הושלמו' : 'Completed'}
            </Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{sortedRoutes.length}</Text>
            <Text style={styles.scoreLabel}>
              {language === 'he' ? 'סה"כ מסלולים' : 'Total Routes'}
            </Text>
          </View>
        </View>
      </View>

      {/* Status banners */}
      {!isActive && !isCompleted && (
        <View style={styles.statusBanner}>
          <Ionicons name="time-outline" size={20} color="#F59E0B" />
          <Text style={styles.statusBannerText}>
            {t.competitionExt.pointsCompetitionNotStarted}
          </Text>
        </View>
      )}
      {isCompleted && (
        <View style={[styles.statusBanner, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
          <Ionicons name="trophy-outline" size={20} color="#6366F1" />
          <Text style={[styles.statusBannerText, { color: '#6366F1' }]}>
            {t.competitionExt.pointsCompetitionEnded}
          </Text>
        </View>
      )}
      {isActive && isParticipant === false && (
        <View style={styles.joinBanner}>
          <View style={styles.joinBannerTextRow}>
            <Ionicons name="person-add-outline" size={20} color={theme.primary} />
            <Text style={[styles.statusBannerText, { color: theme.primary, flex: 1 }]}>
              {t.competitionExt.pointsCompetitionNotRegistered}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoinCompetition}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.joinButtonText}>
                {t.competitionExt.pointsCompetitionJoin}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Scoring explanation */}
      <View style={styles.scoringInfo}>
        <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
        <Text style={styles.scoringInfoText}>
          {t.competitionExt.pointsCompetitionGradePoints}: V0=1, V1=1, V2=2 ... V8=8
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            ⭐ {competition.name}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'routes' && styles.tabActive]}
          onPress={() => setActiveTab('routes')}
        >
          <Ionicons
            name="list-outline"
            size={20}
            color={activeTab === 'routes' ? theme.primary : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>
            {t.competitionExt.pointsCompetitionRoutesHeader}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'map' && styles.tabActive]}
          onPress={() => setActiveTab('map')}
        >
          <Ionicons
            name="map-outline"
            size={20}
            color={activeTab === 'map' ? theme.primary : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>
            {language === 'he' ? 'מפה' : 'Map'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Ionicons
            name="podium-outline"
            size={20}
            color={activeTab === 'leaderboard' ? theme.primary : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
            {t.competitionExt.pointsCompetitionLeaderboard}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'routes' ? (
        <FlatList
          data={sortedRoutes}
          keyExtractor={(item) => item.id}
          renderItem={renderRouteItem}
          ListHeaderComponent={<RoutesListHeader />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>{t.competitionExt.pointsCompetitionNoRoutes}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : activeTab === 'map' ? (
        <View style={{ flex: 1 }}>
          {/* Filters bar for map */}
          <FiltersBar
            routeCount={mapRoutes.length}
            visibleCount={filteredMapRoutes.length}
          />
          <FiltersSheet
            availableColors={availableColors}
            availableGrades={availableGrades}
          />

          {mapRoom && filteredMapRoutes.length > 0 ? (
            <View style={{ flex: 1 }}>
              <CompetitionWallMap
                routes={filteredMapRoutes}
                wallWidth={mapRoom.width || 1000}
                wallHeight={mapRoom.height || 667}
                format={competition.format}
                isEditing={false}
                onRoutePress={(cr) => {
                  const wallRoute = wallRoutes.find(r => r.id === cr.id);
                  if (wallRoute && isActive && isParticipant) {
                    // If already completed, toggle directly (undo)
                    if (completedRouteIds.has(wallRoute.id)) {
                      handleToggleRoute(wallRoute);
                    } else {
                      // Show confirmation popup with feedback fields
                      setFeedbackStarRating(0);
                      setFeedbackGrade(wallRoute.grade || 'V0');
                      setConfirmRoute(wallRoute);
                    }
                  }
                }}
                userCompletedRoutes={Array.from(completedRouteIds)}
                circleSize={userCircleSize}
                room={mapRoom}
              />
              <View style={styles.mapLegend}>
                <Text style={styles.mapLegendText}>
                  {filteredMapRoutes.length}/{mapRoutes.length} {language === 'he' ? 'מסלולים על המפה' : 'routes on map'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>
                {language === 'he' ? 'אין מסלולים להצגה על המפה' : 'No routes to display on map'}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.participantId}
          renderItem={renderLeaderboardItem}
          ListHeaderComponent={
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardTitle}>
                {t.competitionExt.pointsCompetitionLeaderboard}
              </Text>
              <Text style={styles.leaderboardSubtitle}>
                {leaderboard.length} {t.competition.participants}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="podium-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>{t.competition.noResultsYet}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Route completion confirmation popup */}
      <Modal
        visible={confirmRoute !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRoute(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setConfirmRoute(null)}
        >
          <View style={styles.confirmPopup}>
            {confirmRoute && (() => {
              const grade = confirmRoute.grade || 'V0';
              const points = calculatePointsCompetitionRoutePoints(grade);
              const gradeColor = GRADE_COLORS[grade] || theme.primary;
              const routeName = getRouteDisplayName(confirmRoute, language, t);
              const isNewRoute = getRouteStatus(confirmRoute.id) === 'unsent' || getRouteStatus(confirmRoute.id) === 'project';

              return (
                <>
                  <View style={styles.confirmHeader}>
                    <View style={[styles.confirmGradeCircle, { backgroundColor: gradeColor }]}>
                      <Text style={styles.confirmGradeText}>{grade}</Text>
                    </View>
                    <View style={styles.confirmInfo}>
                      <Text style={styles.confirmRouteName}>{routeName}</Text>
                      <Text style={styles.confirmPoints}>
                        {points} {language === 'he' ? "נקודות" : 'points'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.confirmQuestion}>
                    {language === 'he' ? 'סגרת את המסלול?' : 'Did you complete this route?'}
                  </Text>

                  {/* Star rating - only for routes not yet completed on wall */}
                  {isNewRoute && (
                    <View style={styles.feedbackSection}>
                      <Text style={styles.feedbackLabel}>
                        {language === 'he' ? 'דירוג כוכבים' : 'Star Rating'}
                      </Text>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <TouchableOpacity
                            key={star}
                            onPress={() => setFeedbackStarRating(star)}
                          >
                            <Ionicons
                              name={star <= feedbackStarRating ? 'star' : 'star-outline'}
                              size={32}
                              color={star <= feedbackStarRating ? '#F59E0B' : theme.textSecondary}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.feedbackLabel}>
                        {language === 'he' ? 'דירוג מוצע' : 'Grade Consensus'}
                      </Text>
                      <View style={styles.gradeOptions}>
                        {['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8'].map(g => (
                          <TouchableOpacity
                            key={g}
                            style={[
                              styles.gradeOption,
                              feedbackGrade === g && styles.gradeOptionSelected,
                            ]}
                            onPress={() => setFeedbackGrade(g)}
                          >
                            <Text style={[
                              styles.gradeOptionText,
                              feedbackGrade === g && styles.gradeOptionTextSelected,
                            ]}>{g}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.confirmButtons}>
                    <TouchableOpacity
                      style={styles.confirmCancelButton}
                      onPress={() => setConfirmRoute(null)}
                    >
                      <Text style={styles.confirmCancelText}>
                        {language === 'he' ? 'סגור' : 'Close'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmCompleteButton,
                        isNewRoute && feedbackStarRating === 0 && styles.confirmButtonDisabled,
                      ]}
                      disabled={isNewRoute && feedbackStarRating === 0}
                      onPress={() => {
                        const route = confirmRoute;
                        setConfirmRoute(null);
                        handleToggleRoute(route, isNewRoute ? { starRating: feedbackStarRating, suggestedGrade: feedbackGrade } : undefined);
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.confirmCompleteText}>
                        {language === 'he' ? 'סגרתי!' : 'Completed!'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
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
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 12,
      color: theme.textSecondary,
      fontSize: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 4,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    placeholder: {
      width: 32,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    tabText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    listContent: {
      paddingBottom: 100,
    },
    scoreHeader: {
      padding: 16,
      gap: 12,
    },
    scoreCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    scoreItem: {
      alignItems: 'center',
    },
    scoreValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.text,
    },
    scoreLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    scoreDivider: {
      width: 1,
      height: 36,
      backgroundColor: theme.border,
    },
    statusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: 'rgba(245,158,11,0.1)',
    },
    statusBannerText: {
      flex: 1,
      fontSize: 14,
      color: '#F59E0B',
      fontWeight: '500',
    },
    joinBanner: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: `${theme.primary}15`,
      gap: 12,
    },
    joinBannerTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    joinButton: {
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    joinButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    scoringInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 4,
    },
    scoringInfoText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    routeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    routeItemCompleted: {
      backgroundColor: theme.isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)',
    },
    gradeCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gradeText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 14,
    },
    routeInfo: {
      flex: 1,
      marginLeft: 12,
    },
    routeName: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    routeNameCompleted: {
      color: '#22C55E',
    },
    routeSetter: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    routeRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pointsBadge: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    pointsBadgeCompleted: {
      color: '#22C55E',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    // Leaderboard styles
    leaderboardHeader: {
      padding: 16,
    },
    leaderboardTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
    leaderboardSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    leaderboardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    leaderboardItemMe: {
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)',
    },
    rankContainer: {
      width: 44,
      alignItems: 'center',
    },
    rankText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    leaderboardInfo: {
      flex: 1,
      marginLeft: 8,
    },
    leaderboardName: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    leaderboardNameMe: {
      color: theme.primary,
      fontWeight: '700',
    },
    leaderboardStats: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    leaderboardPoints: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
    leaderboardPointsMe: {
      color: theme.primary,
    },
    mapLegend: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      right: 12,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
      borderRadius: 10,
      padding: 10,
      alignItems: 'center',
    },
    mapLegendText: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '500',
    },
    // Confirmation popup styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    confirmPopup: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      width: '85%',
      maxWidth: 360,
    },
    confirmHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    confirmGradeCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    confirmGradeText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
    },
    confirmInfo: {
      marginLeft: 12,
      flex: 1,
    },
    confirmRouteName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    confirmPoints: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    confirmQuestion: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    feedbackSection: {
      marginBottom: 12,
    },
    feedbackLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
      textAlign: 'center',
    },
    starsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 14,
    },
    gradeOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
    },
    gradeOption: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    gradeOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    gradeOptionText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    gradeOptionTextSelected: {
      color: '#fff',
    },
    confirmButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    confirmCancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    confirmCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    confirmCompleteButton: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: '#22C55E',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    confirmButtonDisabled: {
      opacity: 0.5,
    },
    confirmCompleteText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fff',
    },
  });
