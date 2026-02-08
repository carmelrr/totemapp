/**
 * @fileoverview Manage Competition Screen (Admin)
 * @description Detailed competition management with tabs
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';\nimport { useLanguage } from '@/features/language';
import { useAdmin } from '@/context/AdminContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import { useAuth } from '@/context/AuthContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import {
  useCompetition,
  useParticipants,
  useCompetitionLeaderboard,
  useCompetitionRoutes,
} from '@/features/competitions/hooks/useCompetition';
import { CompetitionService } from '@/features/competitions/services/CompetitionService';
import { ResultsService } from '@/features/competitions/services/ResultsService';
import { CompetitionStatus, CompetitionRoute } from '@/features/competitions/types';
import { CompetitionLeaderboard, CompetitionWallMap } from '@/features/competitions/components';
import { useCurrentUser } from '@/store';
import {
  COMPETITION_STATUS_INFO,
  COMPETITION_FORMAT_INFO,
} from '@/features/competitions/constants';
import { useCompetitionMapRoutes } from '@/features/competitions/hooks/useCompetitionMapRoutes';
import { usePublishedRooms } from '@/features/wall-editor/hooks/usePublishedRooms';
import { useEditorMap } from '@/features/wall-editor/hooks/useEditorMap';

// Wall dimensions (should match your actual wall)
const WALL_WIDTH = 1000;
const WALL_HEIGHT = 667;

type TabType = 'overview' | 'participants' | 'leaderboard' | 'map';

export default function ManageCompetitionScreen() {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId, initialTab } = route.params;
  const { isAdmin } = useAdmin();
  const rolesContext = useRolesContext();
  const currentUser = useCurrentUser();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'overview');
  const [isUpdating, setIsUpdating] = useState(false);

  const { competition, loading } = useCompetition(competitionId);
  const { participants, loading: participantsLoading } = useParticipants(competitionId);
  // Pass competition format for correct scoring calculation
  const { entries: leaderboard, loading: leaderboardLoading } = useCompetitionLeaderboard(
    competitionId,
    undefined,
    competition?.format as 'national_league' | 'totemtition' | 'custom'
  );
  
  // Get competition routes for the map
  const {
    routes: mapRoutes,
    userCompletedRoutes,
    routeCompletionCounts,
    loading: routesLoading,
  } = useCompetitionMapRoutes({
    competitionId,
    userId: user?.uid,
    format: competition?.format,
  });

  // Load room data for the new dynamic wall map
  // If competition has a roomId, load that specific room; otherwise use the first published room
  const { rooms: publishedRooms } = usePublishedRooms();
  const { room: specificRoom } = useEditorMap({ roomId: competition?.roomId });
  const mapRoom = useMemo(() => {
    if (competition?.roomId && specificRoom) return specificRoom;
    return publishedRooms.length > 0 ? publishedRooms[0] : null;
  }, [competition?.roomId, specificRoom, publishedRooms]);

  const styles = createStyles(theme);
  const hasFixedNamesRef = useRef(false);
  const hasSyncedCategoriesRef = useRef(false);

  // Handle route press on map - navigate to scoring for totemtition
  // Must be defined before any early returns to maintain hook order
  const handleMapRoutePress = useCallback((route: CompetitionRoute) => {
    if (!competition) return;
    
    // For totemtition, navigate to enter results for this route
    if (competition.format === 'totemtition' && competition.status === 'active') {
      navigation.navigate('JudgeEntry', { 
        competitionId,
        selectedRouteNumber: route.routeNumber,
      });
    }
  }, [competition, competitionId, navigation]);

  // Get positioned routes for the map
  // Must be defined before any early returns
  const positionedRoutes = mapRoutes.filter(r => r.xNorm && r.yNorm && r.xNorm > 0 && r.yNorm > 0);

  // Fix missing participant names when leaderboard loads
  useEffect(() => {
    if (!leaderboardLoading && leaderboard.length > 0 && !hasFixedNamesRef.current) {
      // Check if any entries have "Unknown" name
      const hasUnknownNames = leaderboard.some(
        (entry) => entry.participantName === 'Unknown' || !entry.participantName
      );
      if (hasUnknownNames) {
        hasFixedNamesRef.current = true;
        ResultsService.fixMissingParticipantNames(competitionId).catch((err) => {
          console.log('Failed to fix missing names:', err);
        });
      }
    }
  }, [leaderboard, leaderboardLoading, competitionId]);

  // Sync missing categories when leaderboard loads (for Totemtition scoring)
  useEffect(() => {
    if (!leaderboardLoading && leaderboard.length > 0 && !hasSyncedCategoriesRef.current) {
      // Check if any entries are missing category
      const hasMissingCategories = leaderboard.some((entry) => !entry.category);
      if (hasMissingCategories) {
        hasSyncedCategoriesRef.current = true;
        ResultsService.syncResultCategories(competitionId).catch((err) => {
          console.log('Failed to sync categories:', err);
        });
      }
    }
  }, [leaderboard, leaderboardLoading, competitionId]);

  // Check if user has permission to view this management screen
  const hasManagementAccess = rolesContext.isJudgeRole;
  
  // Check if user is a viewer only (can see map and leaderboard, but not admin features)
  // Users coming to view leaderboard or map without management access are viewers
  const isViewerOnly = !hasManagementAccess && (initialTab === 'leaderboard' || initialTab === 'map');

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>טוען תחרות...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!competition) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>התחרות לא נמצאה</Text>
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

  // Check permission for national league competitions
  // Allow viewer-only access for leaderboard tab
  if (competition.format === 'national_league' && !hasManagementAccess && !isViewerOnly) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-forward" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {competition.name}
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>אין הרשאה לגישה</Text>
          <Text style={styles.errorSubtext}>
            רק שופטים, שופטים ראשיים, ומנהלים יכולים לנהל תחרויות
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

  const statusInfo = COMPETITION_STATUS_INFO[competition.status];
  const formatInfo = COMPETITION_FORMAT_INFO[competition.format];
  
  // Check if this is a Totemtition format competition
  const isTotemtition = competition.format === 'totemtition';

  const handleStatusChange = async (newStatus: CompetitionStatus) => {
    const statusLabels: Record<CompetitionStatus, string> = {
      draft: 'טיוטה',
      upcoming: 'פתוחה להרשמה',
      active: 'פעילה',
      closed: 'סגורה',
      completed: 'הסתיימה',
      cancelled: 'בוטלה',
    };

    Alert.alert(
      'שינוי סטטוס',
      `לשנות את הסטטוס ל"${statusLabels[newStatus]}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await CompetitionService.updateCompetitionStatus(competitionId, newStatus);
              Alert.alert('הצלחה', 'הסטטוס עודכן בהצלחה');
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן לעדכן את הסטטוס');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  // Handle toggle registration for Totemtition
  const handleToggleRegistration = async () => {
    const isOpen = competition.registrationStatus === 'open';
    const action = isOpen ? 'לסגור' : 'לפתוח';
    
    Alert.alert(
      `${isOpen ? 'סגירת' : 'פתיחת'} הרשמה`,
      `האם ${action} את ההרשמה לתחרות?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            setIsUpdating(true);
            try {
              if (isOpen) {
                await CompetitionService.closeRegistration(competitionId);
                Alert.alert('הצלחה', 'ההרשמה נסגרה');
              } else {
                await CompetitionService.openRegistration(competitionId);
                Alert.alert('הצלחה', 'ההרשמה נפתחה - משתמשים יכולים להירשם כעת');
              }
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן לעדכן את מצב ההרשמה');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  // Handle toggle results visibility
  const handleToggleResultsVisibility = async () => {
    const isVisible = competition.resultsVisible ?? (competition.status === 'active');
    const action = isVisible ? 'להסתיר' : 'להציג';
    
    console.log('[ManageCompetitionScreen] Toggle visibility pressed:', {
      currentResultsVisible: competition.resultsVisible,
      computedIsVisible: isVisible,
      action,
    });
    
    Alert.alert(
      `${isVisible ? 'הסתרת' : 'הצגת'} תוצאות`,
      `האם ${action} את התוצאות לכל המשתמשים?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            setIsUpdating(true);
            try {
              if (isVisible) {
                await CompetitionService.hideResults(competitionId);
                Alert.alert('הצלחה', 'התוצאות הוסתרו מהמשתמשים');
              } else {
                await CompetitionService.showResults(competitionId);
                Alert.alert('הצלחה', 'התוצאות מוצגות כעת לכל המשתמשים');
              }
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן לעדכן את הצגת התוצאות');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>סטטוס תחרות</Text>
        
        <View style={styles.statusRow}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
            <Text style={styles.statusLabel}>{statusInfo.label}</Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.statusActions}>
            {competition.status === 'draft' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#27ae60' }]}
                onPress={() => handleStatusChange('upcoming')}
              >
                <Text style={styles.actionBtnText}>פתח להרשמה</Text>
              </TouchableOpacity>
            )}
            {competition.status === 'upcoming' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#3498db' }]}
                onPress={() => handleStatusChange('active')}
              >
                <Text style={styles.actionBtnText}>התחל תחרות</Text>
              </TouchableOpacity>
            )}
            {competition.status === 'active' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#9b59b6' }]}
                onPress={() => handleStatusChange('completed')}
              >
                <Text style={styles.actionBtnText}>סיים תחרות</Text>
              </TouchableOpacity>
            )}
            {competition.status !== 'cancelled' && competition.status !== 'completed' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#e74c3c' }]}
                onPress={() => handleStatusChange('cancelled')}
              >
                <Text style={styles.actionBtnText}>בטל תחרות</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Results Visibility Control - Only for completed competitions */}
        {isAdmin && (competition.status === 'completed' || competition.status === 'closed') && (
          <View style={styles.resultsVisibilitySection}>
            <View style={styles.resultsVisibilityRow}>
              <View style={styles.resultsVisibilityInfo}>
                <Ionicons 
                  name={competition.resultsVisible ? 'eye' : 'eye-off'} 
                  size={24} 
                  color={competition.resultsVisible ? '#27ae60' : theme.textSecondary} 
                />
                <View style={styles.resultsVisibilityText}>
                  <Text style={styles.resultsVisibilityTitle}>
                    {competition.resultsVisible ? 'תוצאות גלויות' : 'תוצאות מוסתרות'}
                  </Text>
                  <Text style={styles.resultsVisibilityDesc}>
                    {competition.resultsVisible 
                      ? 'כל המשתמשים יכולים לראות את התוצאות'
                      : 'רק מנהלים יכולים לראות את התוצאות'
                    }
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: competition.resultsVisible ? '#e74c3c' : '#27ae60' }
                ]}
                onPress={handleToggleResultsVisibility}
                disabled={isUpdating}
              >
                <Text style={styles.toggleButtonText}>
                  {competition.resultsVisible ? 'הסתר' : 'הצג'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>פרטי תחרות</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>פורמט:</Text>
          <Text style={styles.infoValue}>{formatInfo.icon} {formatInfo.label}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>תאריך התחלה:</Text>
          <Text style={styles.infoValue}>
            {competition.startDate.toLocaleDateString('he-IL')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>תאריך סיום:</Text>
          <Text style={styles.infoValue}>
            {competition.endDate.toLocaleDateString('he-IL')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>מסלולים:</Text>
          <Text style={styles.infoValue}>{competition.settings.maxRoutes}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>TOP לניקוד:</Text>
          <Text style={styles.infoValue}>TOP{competition.settings.topRoutesForScoring}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>קנס ניסיון:</Text>
          <Text style={styles.infoValue}>{competition.settings.attemptPenalty} נקודות</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{participants.length}</Text>
          <Text style={styles.statLabel}>משתתפים</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {/* Manage Participants - Only for Judge roles */}
        {rolesContext.canManageParticipants && (
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('ManageParticipants', { competitionId })}
          >
            <Ionicons name="people" size={28} color={theme.primary} />
            <Text style={styles.quickActionText}>ניהול משתתפים</Text>
          </TouchableOpacity>
        )}

        {/* Manage Routes - Only for Judge roles */}
        {rolesContext.canManageCompetitionRoutes && (
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('ManageCompetitionRoutes', { competitionId })}
          >
            <Ionicons name="map" size={28} color={theme.primary} />
            <Text style={styles.quickActionText}>מסלולי תחרות</Text>
          </TouchableOpacity>
        )}

        {/* Manage Categories - Only for Head Judge and Admin */}
        {(rolesContext.isHeadJudge || rolesContext.isAdmin) && (
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('ManageCategories', { competitionId })}
          >
            <Ionicons name="layers" size={28} color={theme.primary} />
            <Text style={styles.quickActionText}>ניהול קטגוריות</Text>
          </TouchableOpacity>
        )}

        {/* Enter Results - Only for Judge roles */}
        {rolesContext.canEnterResults && (
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('JudgeEntry', { competitionId })}
          >
            <Ionicons name="create" size={28} color={theme.primary} />
            <Text style={styles.quickActionText}>הזנת תוצאות</Text>
          </TouchableOpacity>
        )}

        {/* Registration Management - For Totemtition and National League formats */}
        {(isTotemtition || competition.format === 'national_league') && rolesContext.canManageParticipants && (
          <TouchableOpacity
            style={[
              styles.quickAction,
              competition.registrationStatus === 'open' && styles.quickActionActive
            ]}
            onPress={handleToggleRegistration}
          >
            <Ionicons 
              name={competition.registrationStatus === 'open' ? 'lock-open' : 'lock-closed'} 
              size={28} 
              color={competition.registrationStatus === 'open' ? '#27ae60' : theme.primary} 
            />
            <Text style={styles.quickActionText}>
              {competition.registrationStatus === 'open' ? 'סגור הרשמה' : 'פתח הרשמה'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderParticipantsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('ManageParticipants', { competitionId })}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>הוסף משתתפים</Text>
      </TouchableOpacity>

      {participantsLoading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : participants.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyText}>אין משתתפים עדיין</Text>
        </View>
      ) : (
        participants.slice(0, 10).map((p) => (
          <View key={p.id} style={styles.listItem}>
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{p.userName}</Text>
              <Text style={styles.listItemSubtitle}>
                {p.category ? `קטגוריה: ${p.category}` : 'ללא קטגוריה'}
              </Text>
            </View>
            <View style={[
              styles.statusDot,
              { backgroundColor: p.status === 'approved' ? '#27ae60' : '#f39c12' }
            ]} />
          </View>
        ))
      )}

      {participants.length > 10 && (
        <TouchableOpacity
          style={styles.viewAllBtn}
          onPress={() => navigation.navigate('ManageParticipants', { competitionId })}
        >
          <Text style={styles.viewAllText}>צפה בכל {participants.length} המשתתפים →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLeaderboardTab = () => {
    if (!competition) {
      return (
        <View style={styles.tabContent}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      );
    }

    // Check if results are visible to non-admin users
    // Results are always visible when competition is active
    // After completion, admin controls visibility
    const isResultsVisible = competition.status === 'active' || 
                              competition.resultsVisible === true || 
                              isAdmin;

    console.log('[ManageCompetitionScreen] Results visibility check:', {
      status: competition.status,
      resultsVisible: competition.resultsVisible,
      isAdmin,
      isResultsVisible,
    });

    if (!isResultsVisible) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.resultsHiddenContainer}>
            <Ionicons name="eye-off" size={64} color={theme.textSecondary} />
            <Text style={styles.resultsHiddenTitle}>התוצאות מוסתרות</Text>
            <Text style={styles.resultsHiddenText}>
              מנהל התחרות עדיין לא פרסם את התוצאות הסופיות
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <CompetitionLeaderboard
          competition={competition}
          currentUserId={currentUser?.uid}
          onParticipantPress={(participantId) => {
            console.log('Pressed participant:', participantId);
          }}
        />
      </View>
    );
  };

  // Render map tab
  const renderMapTab = () => {
    if (!competition) {
      return (
        <View style={styles.tabContent}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      );
    }

    if (routesLoading) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.mapLoadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.mapLoadingText}>{t.competitionExt.loadingRouteMap}</Text>
          </View>
        </View>
      );
    }

    if (positionedRoutes.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.mapEmptyContainer}>
            <Ionicons name="map-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.mapEmptyTitle}>{t.competitionExt.noRoutesOnMap}</Text>
            <Text style={styles.mapEmptyText}>
              {rolesContext.isJudgeRole 
                ? t.competitionExt.noRoutesOnMap
                : t.competitionExt.noRoutesOnMap}
            </Text>
            {rolesContext.isJudgeRole && (
              <TouchableOpacity
                style={styles.goToRoutesBtn}
                onPress={() => navigation.navigate('ManageCompetitionRoutes', { competitionId })}
              >
                <Ionicons name="map" size={18} color="#fff" />
                <Text style={styles.goToRoutesBtnText}>{t.competitionExt.competitionRoutesTitle}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Determine if map is interactive based on format and status
    const isInteractive = competition.format === 'totemtition' && competition.status === 'active';
    const screenHeight = Dimensions.get('window').height;

    return (
      <View style={[styles.mapTabContent, { height: screenHeight - 250 }]}>
        <CompetitionWallMap
          routes={positionedRoutes}
          wallWidth={mapRoom?.width || WALL_WIDTH}
          wallHeight={mapRoom?.height || WALL_HEIGHT}
          format={competition.format}
          isEditing={false}
          onRoutePress={isInteractive ? handleMapRoutePress : undefined}
          userCompletedRoutes={userCompletedRoutes}
          routeCompletionCounts={routeCompletionCounts}
          room={mapRoom}
        />
        
        {/* Map legend */}
        <View style={styles.mapLegend}>
          <Text style={styles.mapLegendTitle}>
            {competition.format === 'national_league' 
              ? `🏅 ${COMPETITION_FORMAT_INFO.national_league.label}` 
              : `🎯 ${COMPETITION_FORMAT_INFO.totemtition.label}`}
          </Text>
          <Text style={styles.mapLegendText}>
            {competition.format === 'totemtition' && competition.status === 'active'
              ? t.competitionExt.tapToPlaceBadge
              : `${positionedRoutes.length} ${t.competitionExt.routesCount}`}
          </Text>
        </View>
      </View>
    );
  };

  // Build tabs array - judges tab removed (roles are global now, not per-competition)
  // For viewer-only users, show map and leaderboard tabs (not overview/participants which are admin-only)
  // Add map tab when competition is active and has routes
  const allTabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'overview', label: t.competitionExt.tabOverview, icon: 'home' },
    { key: 'participants', label: t.competitionExt.tabParticipants, icon: 'people' },
    { key: 'map', label: t.competitionExt.tabMap, icon: 'map' },
    { key: 'leaderboard', label: t.competitionExt.tabLeaderboard, icon: 'trophy' },
  ];
  
  // Filter tabs based on user permissions
  let tabs = allTabs;
  
  if (isViewerOnly) {
    // Viewer-only users can see map and leaderboard tabs
    // Map helps competitors see route locations during active competition
    tabs = allTabs.filter(tab => tab.key === 'leaderboard' || tab.key === 'map');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <BrandLogo variant="icon" color="white" size={24} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {competition.name}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? theme.primary : theme.textSecondary}
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      {activeTab === 'map' ? (
        // Map tab needs different container (not scrollable)
        <>
          {isUpdating && (
            <View style={styles.updatingOverlay}>
              <ActivityIndicator color={theme.primary} />
              <Text style={styles.updatingText}>מעדכן...</Text>
            </View>
          )}
          {renderMapTab()}
        </>
      ) : (
        <ScrollView style={styles.scrollContent}>
          {isUpdating && (
            <View style={styles.updatingOverlay}>
              <ActivityIndicator color={theme.primary} />
              <Text style={styles.updatingText}>מעדכן...</Text>
            </View>
          )}
          
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'participants' && renderParticipantsTab()}
          {activeTab === 'leaderboard' && renderLeaderboardTab()}
        </ScrollView>
      )}
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
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 18,
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
      backgroundColor: theme.buttonPrimary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 24,
    },
    backBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.headerGradient,
    },
    backButton: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#fff',
    },
    placeholder: {
      width: 40,
    },
    tabsContainer: {
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabsContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.background,
      gap: 6,
    },
    tabActive: {
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
    },
    tabText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    scrollContent: {
      flex: 1,
    },
    tabContent: {
      padding: 16,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'right',
      marginBottom: 16,
    },
    statusRow: {
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    statusBadgeLarge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 8,
    },
    statusIcon: {
      fontSize: 18,
    },
    statusLabel: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    statusActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    actionBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: 'bold',
    },
    resultsVisibilitySection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    resultsVisibilityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resultsVisibilityInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    resultsVisibilityText: {
      flex: 1,
    },
    resultsVisibilityTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text,
    },
    resultsVisibilityDesc: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    toggleButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    toggleButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: 'bold',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    quickActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickAction: {
      width: '48%',
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    quickActionActive: {
      borderWidth: 2,
      borderColor: '#27ae60',
    },
    quickActionText: {
      fontSize: 13,
      color: theme.text,
      textAlign: 'center',
      marginTop: 8,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.buttonPrimary,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
      marginBottom: 16,
    },
    addButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 12,
    },
    resultsHiddenContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 24,
    },
    resultsHiddenTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    resultsHiddenText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    listItemContent: {
      flex: 1,
    },
    listItemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'right',
    },
    listItemSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 2,
    },
    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    viewAllBtn: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    viewAllText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    leaderboardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    rankBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
    rankText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    leaderboardContent: {
      flex: 1,
    },
    leaderboardName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'right',
    },
    leaderboardDetails: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 2,
    },
    leaderboardPoints: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.primary,
    },
    updatingOverlay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      margin: 16,
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    updatingText: {
      fontSize: 14,
      color: theme.text,
    },
    // Map tab styles
    mapTabContent: {
      flex: 1,
    },
    mapLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    mapLoadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    mapEmptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
    },
    mapEmptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
    },
    mapEmptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    goToRoutesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.buttonPrimary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginTop: 20,
      gap: 8,
    },
    goToRoutesBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    mapLegend: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    mapLegendTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    mapLegendText: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.8)',
      marginTop: 4,
    },
  });
