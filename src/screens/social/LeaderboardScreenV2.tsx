/**
 * LeaderboardScreen - Improved Routes Points System with Competition Support
 *
 * This screen shows a leaderboard based on climbing points and active competitions.
 * Points are calculated based on the grades of routes completed by users.
 *
 * Features:
 * - Active competition banner with live leaderboard
 * - Time-based filtering (week/month/all time)
 * - Cached points for better performance
 * - Real-time updates
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "@/features/data/firebase";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { useAdmin } from "@/context/AdminContext";
import { useActiveCompetitions, useOpenRegistrationCompetitions, useCompletedCompetitionsWithResults, Competition } from "@/features/competitions";
import { ParticipantService } from "@/features/competitions/services/ParticipantService";
import { CompetitionService } from "@/features/competitions/services/CompetitionService";
import { ActiveCompetitionBanner } from "@/features/competitions/components/ActiveCompetitionBanner";
import { OpenRegistrationBanner } from "@/features/competitions/components/OpenRegistrationBanner";
import { CompletedCompetitionBanner } from "@/features/competitions/components/CompletedCompetitionBanner";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { CachedAvatar } from "@/components/ui/CachedAvatar";
import {
  useLeaderboardUsers,
  useLeaderboardLoading,
  useLeaderboardComputedAt,
  useLeaderboardActions,
  type LeaderboardUser,
} from "@/store/leaderboardStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useBlockedUsers } from "@/features/moderation/useBlockedUsers";

const { width: screenWidth } = Dimensions.get("window");

// Time filter options
// 'all' - all time including archived routes
// 'onWall' - only routes currently on the wall
type TimeFilter = 'onWall' | 'all';

// Points-per-grade math and the LeaderboardUser type now live in the leaderboard store
// (src/store/leaderboardStore.ts), which owns aggregation + caching.

export default function LeaderboardScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { isAdmin } = useAdmin();
  const layout = useResponsiveLayout();
  const { isBlocked } = useBlockedUsers();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, width } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  
  // State
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('onWall');
  const [activeCompetitionIndex, setActiveCompetitionIndex] = useState(0);

  const currentUserId = auth.currentUser?.uid;

  // Leaderboard data comes from the cached store (stale-while-revalidate) instead of a
  // full-collection re-scan on every mount / user-doc change.
  const fallbackName = t.social.user;
  const allUsers = useLeaderboardUsers(timeFilter);
  const { hydrate, ensureFresh, refresh } = useLeaderboardActions();
  const storeLoading = useLeaderboardLoading();
  const computedAt = useLeaderboardComputedAt(timeFilter);
  // Show the full-screen spinner only when there's nothing to render yet and either a
  // compute is in flight or this filter has never been computed (first ever load).
  const loading = allUsers.length === 0 && (storeLoading || computedAt === 0);

  // Responsive styles
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);

  // Active competitions
  const { competitions: activeCompetitions, hasActiveCompetition } = useActiveCompetitions();
  
  // Competitions with open registration
  const { competitions: openRegistrationCompetitions, hasOpenRegistration } = useOpenRegistrationCompetitions();

  // Completed competitions with visible results
  const { competitions: completedCompetitions, hasCompletedWithResults } = useCompletedCompetitionsWithResults();

  // Track which points_competition IDs the user is registered for
  const [registeredPointsCompIds, setRegisteredPointsCompIds] = useState<Set<string>>(new Set());
  // Non-active points competitions where user is registered (to show even when not active)
  const [userPointsCompetitions, setUserPointsCompetitions] = useState<Competition[]>([]);

  // Check registration for points_competition format
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;

    const checkRegistrations = async () => {
      try {
        // Get all competitions to find points_competitions
        const allComps = await CompetitionService.getAllCompetitions();
        const pointsComps = allComps.filter(c => c.format === 'points_competition' && c.status !== 'cancelled');
        
        const registeredIds = new Set<string>();
        const nonActiveRegistered: Competition[] = [];

        await Promise.all(pointsComps.map(async (comp) => {
          const participant = await ParticipantService.getParticipantByUserId(comp.id, currentUserId);
          if (participant && (participant.status === 'approved' || participant.status === 'pending')) {
            registeredIds.add(comp.id);
            // If not active, add to the displayed list for registered users
            if (comp.status !== 'active') {
              nonActiveRegistered.push(comp);
            }
          }
        }));

        if (!cancelled) {
          setRegisteredPointsCompIds(registeredIds);
          setUserPointsCompetitions(nonActiveRegistered);
        }
      } catch (error) {
        console.warn('Error checking points competition registrations:', error);
      }
    };

    checkRegistrations();
    return () => { cancelled = true; };
  }, [currentUserId, activeCompetitions, openRegistrationCompetitions]);

  // Hydrate from the persisted cache once, then keep the active filter fresh (TTL-guarded).
  // The store renders cached rankings instantly and revalidates in the background, replacing
  // the old full-collection scan that re-ran on every mount AND on every user-doc change.
  useEffect(() => {
    let active = true;
    (async () => {
      await hydrate();
      if (active) ensureFresh(timeFilter, fallbackName);
    })();
    return () => {
      active = false;
    };
  }, [timeFilter, fallbackName, hydrate, ensureFresh]);

  // Revalidate when the screen regains focus (the store no-ops if data is still fresh).
  useFocusEffect(
    useCallback(() => {
      ensureFresh(timeFilter, fallbackName);
    }, [timeFilter, fallbackName, ensureFresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(timeFilter, fallbackName);
    setRefreshing(false);
  };

  // Get users with points > 0
  const usersWithPoints = useMemo(
    () => allUsers.filter((user) => user.points > 0 && !isBlocked(user.id)),
    [allUsers, isBlocked]
  );

  // Calculate ranks with tie handling
  // If users have the same points, they share the same rank
  // BUT they are sorted by allTimePoints as tiebreaker (for display order)
  // Next rank skips to the correct position (e.g., 1,1,3 not 1,1,2)
  const usersWithRanks = useMemo(() => {
    // Sort by points first, then by allTimePoints as tiebreaker
    const sorted = [...usersWithPoints].sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      // Tiebreaker: sort by all-time points
      return b.allTimePoints - a.allTimePoints;
    });
    
    let currentRank = 1;
    
    return sorted.map((user, index) => {
      if (index === 0) {
        return { ...user, rank: 1 };
      }
      
      // If same points as previous user, same rank (tie)
      // Note: even with different allTimePoints, if points are same, they share rank
      if (user.points === sorted[index - 1].points) {
        return { ...user, rank: currentRank };
      }
      
      // Different points - rank is position + 1 (to account for ties)
      currentRank = index + 1;
      return { ...user, rank: currentRank };
    });
  }, [usersWithPoints]);

  const getCurrentUserRank = () => {
    const user = usersWithRanks.find((user) => user.id === currentUserId);
    return user?.rank || null;
  };

  const getCurrentUserStats = () => {
    return usersWithRanks.find((user) => user.id === currentUserId);
  };

  // Get top 3 for podium
  const topThree = useMemo(() => usersWithRanks.slice(0, 3), [usersWithRanks]);

  // Get users for the list (4th place onwards)
  const getRestOfUsers = () => {
    const currentUser = getCurrentUserStats();
    const currentUserRank = getCurrentUserRank();

    if (usersWithRanks.length <= 3) return [];

    // Show positions 4-13 (10 users) - using usersWithRanks which has rank property
    const restUsers = usersWithRanks.slice(3, 13);

    // If current user is not in the visible list and has points > 0, add them at the end
    if (
      currentUser &&
      currentUserRank &&
      currentUserRank > 13 &&
      currentUser.points > 0
    ) {
      restUsers.push(currentUser);
    }

    return restUsers;
  };

  // Combine active and open registration competitions for the carousel
  // Filter out points_competition for non-registered users, add registered non-active ones
  const allDisplayCompetitions = useMemo(() => {
    const activeIds = new Set(activeCompetitions.map(c => c.id));
    const openNotActive = openRegistrationCompetitions.filter(c => !activeIds.has(c.id));
    let combined = [...activeCompetitions, ...openNotActive];
    
    // Filter out points_competition for users who are not registered
    combined = combined.filter(c => {
      if (c.format === 'points_competition') {
        return registeredPointsCompIds.has(c.id);
      }
      return true;
    });

    // Add non-active points competitions where user IS registered (unique only)
    const existingIds = new Set(combined.map(c => c.id));
    userPointsCompetitions.forEach(c => {
      if (!existingIds.has(c.id)) {
        combined.push(c);
      }
    });

    return combined;
  }, [activeCompetitions, openRegistrationCompetitions, registeredPointsCompIds, userPointsCompetitions]);

  const hasMultipleCompetitions = allDisplayCompetitions.length > 1;

  // Handle carousel scroll
  const handleCompetitionScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (screenWidth - 30)); // Account for margin
    setActiveCompetitionIndex(index);
  }, []);

  const handleCompetitionPress = (competition: Competition) => {
    // Navigate to appropriate screen based on competition format
    if (competition.format === 'points_competition') {
      navigation.navigate('Competitions', {
        screen: 'PointsCompetition',
        params: { competitionId: competition.id }
      });
    } else {
      navigation.navigate('Competitions', {
        screen: 'ManageCompetition',
        params: { competitionId: competition.id, initialTab: 'leaderboard' }
      });
    }
  };

  const handleEnterResultsPress = (competition: Competition) => {
    // Open the full competition view (map + leaderboard tabs) so the judge sees the
    // wall map immediately and can enter results from it; the leaderboard is one tab away.
    navigation.navigate('Competitions', {
      screen: 'ManageCompetition',
      params: { competitionId: competition.id, initialTab: 'map' }
    });
  };

  const handleRegistrationPress = (competition: Competition) => {
    // Navigate to competition registration screen
    navigation.navigate('Competitions', {
      screen: 'CompetitionRegistration',
      params: { competitionId: competition.id }
    });
  };

  const handleManageCompetitions = () => {
    navigation.navigate('Competitions', { screen: 'CompetitionsList' });
  };

  const renderTimeFilterTabs = () => (
    <View style={styles.filterContainer}>
      {(['onWall', 'all'] as TimeFilter[]).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterTab,
            timeFilter === filter && styles.filterTabActive,
          ]}
          onPress={() => setTimeFilter(filter)}
        >
          <Text
            style={[
              styles.filterTabText,
              timeFilter === filter && styles.filterTabTextActive,
            ]}
          >
            {filter === 'onWall' ? t.social.onTheWall : t.social.allTime}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const handleUserPress = useCallback((userId: string, displayName?: string) => {
    navigation.navigate('UserProfile', { userId, displayName });
  }, [navigation]);

  const renderPodium = () => {
    if (topThree.length === 0) return null;

    // Podium colors
    const GOLD = "#f1c40f";
    const SILVER = "#95a5a6";
    const BRONZE = "#cd7f32";

    return (
      <View style={styles.podiumContainer}>
        <View style={styles.podiumRow}>
          {/* Second place */}
          {topThree[1] && (
            <TouchableOpacity 
              style={styles.podiumPlace}
              onPress={() => handleUserPress(topThree[1].id, topThree[1].displayName)}
              activeOpacity={0.7}
            >
              <BrandLogo variant="icon" color="white" size={50} tintColor={SILVER} />
              <CachedAvatar
                photoURL={topThree[1].photoURL}
                displayName={topThree[1].displayName}
                size={60}
                showBorder={false}
                style={styles.podiumAvatar}
              />
              <Text style={styles.podiumName} numberOfLines={1}>
                {topThree[1].displayName}
              </Text>
              <Text style={styles.podiumPoints}>{topThree[1].points} {t.social.pts}</Text>
            </TouchableOpacity>
          )}

          {/* First place */}
          {topThree[0] && (
            <TouchableOpacity 
              style={styles.podiumPlace}
              onPress={() => handleUserPress(topThree[0].id, topThree[0].displayName)}
              activeOpacity={0.7}
            >
              <BrandLogo variant="icon" color="white" size={70} tintColor={GOLD} />
              <CachedAvatar
                photoURL={topThree[0].photoURL}
                displayName={topThree[0].displayName}
                size={70}
                showBorder={false}
                style={styles.podiumAvatar}
              />
              <Text style={styles.podiumName} numberOfLines={1}>
                {topThree[0].displayName}
              </Text>
              <Text style={styles.podiumPoints}>{topThree[0].points} {t.social.pts}</Text>
            </TouchableOpacity>
          )}

          {/* Third place */}
          {topThree[2] && (
            <TouchableOpacity 
              style={styles.podiumPlace}
              onPress={() => handleUserPress(topThree[2].id, topThree[2].displayName)}
              activeOpacity={0.7}
            >
              <BrandLogo variant="icon" color="white" size={40} tintColor={BRONZE} />
              <CachedAvatar
                photoURL={topThree[2].photoURL}
                displayName={topThree[2].displayName}
                size={55}
                showBorder={false}
                style={styles.podiumAvatar}
              />
              <Text style={styles.podiumName} numberOfLines={1}>
                {topThree[2].displayName}
              </Text>
              <Text style={styles.podiumPoints}>{topThree[2].points} {t.social.pts}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Memoized leaderboard item for better performance
  const LeaderboardItem = memo(({ item, index, isCurrentUser, displayRank, onPress, t, styles }: {
    item: LeaderboardUser;
    index: number;
    isCurrentUser: boolean;
    displayRank: number;
    onPress: () => void;
    t: any;
    styles: any;
  }) => (
    <TouchableOpacity
      style={[
        styles.leaderboardItem,
        isCurrentUser && styles.currentUserItem,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rankContainer}>
        <Text style={styles.rankNumber}>{displayRank}</Text>
      </View>

      <CachedAvatar
        photoURL={item.photoURL}
        displayName={item.displayName}
        size={45}
        showBorder={false}
        style={styles.userAvatar}
      />

      <View style={styles.userInfo}>
        <Text
          style={[styles.userName, isCurrentUser && styles.currentUserName]}
        >
          {item.displayName || t.social.user}
          {isCurrentUser && <Text> {t.social.you}</Text>}
        </Text>
        <Text style={styles.userStat}>
          {item.points} {t.social.points} {item.routeCount ? `| ${item.routeCount} ${t.social.routes}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  ), (prev, next) => {
    return prev.item.id === next.item.id && 
           prev.item.points === next.item.points &&
           prev.item.photoURL === next.item.photoURL &&
           prev.isCurrentUser === next.isCurrentUser &&
           prev.displayRank === next.displayRank;
  });

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardUser; index: number }) => {
    const isCurrentUser = item.id === currentUserId;
    // Use pre-calculated rank, fallback to index + 4 for 4th place onwards
    const displayRank = item.rank || index + 4;

    return (
      <LeaderboardItem
        item={item}
        index={index}
        isCurrentUser={isCurrentUser}
        displayRank={displayRank}
        onPress={() => handleUserPress(item.id, item.displayName)}
        t={t}
        styles={styles}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <BrandLogo variant="icon" color="white" size={24} />
        <Text style={styles.headerTitle}>
          {hasActiveCompetition ? `🏆 ${t.social.competitions}` : `🏆 ${t.social.leaderboard}`}
        </Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={handleManageCompetitions}
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Competition Banners - Carousel when multiple competitions */}
        {allDisplayCompetitions.length > 0 && (
          <View>
            {hasMultipleCompetitions ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleCompetitionScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={styles.competitionsCarousel}
                  snapToInterval={screenWidth - 30}
                  decelerationRate="fast"
                >
                  {allDisplayCompetitions.map((competition) => (
                    <View key={competition.id} style={styles.competitionSlide}>
                      {competition.status === 'active' || competition.format === 'points_competition' ? (
                        <ActiveCompetitionBanner
                          competition={competition}
                          onPress={() => handleCompetitionPress(competition)}
                          onEnterResults={() => handleEnterResultsPress(competition)}
                          onRegisterPress={() => handleRegistrationPress(competition)}
                        />
                      ) : (
                        <OpenRegistrationBanner
                          competition={competition}
                          onRegisterPress={() => handleRegistrationPress(competition)}
                        />
                      )}
                    </View>
                  ))}
                </ScrollView>
                {/* Pagination Dots */}
                <View style={styles.paginationContainer}>
                  {allDisplayCompetitions.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === activeCompetitionIndex && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                {/* Single competition - show without carousel */}
                {allDisplayCompetitions.map((competition) => (
                  competition.status === 'active' || competition.format === 'points_competition' ? (
                    <ActiveCompetitionBanner
                      key={competition.id}
                      competition={competition}
                      onPress={() => handleCompetitionPress(competition)}
                      onEnterResults={() => handleEnterResultsPress(competition)}
                      onRegisterPress={() => handleRegistrationPress(competition)}
                    />
                  ) : (
                    <OpenRegistrationBanner
                      key={competition.id}
                      competition={competition}
                      onRegisterPress={() => handleRegistrationPress(competition)}
                    />
                  )
                ))}
              </>
            )}
          </View>
        )}

        {/* Completed Competition Banners - Show when results are visible */}
        {hasCompletedWithResults && completedCompetitions.map((competition) => (
          <CompletedCompetitionBanner
            key={competition.id}
            competition={competition}
            onPress={() => handleCompetitionPress(competition)}
          />
        ))}

        {/* Time Filter Tabs */}
        {renderTimeFilterTabs()}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>{t.social.loadingLeaderboard}</Text>
          </View>
        )}

        {/* Podium for top 3 */}
        {!loading && renderPodium()}

        {/* Rest of the leaderboard */}
        {!loading && (
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>{t.social.otherPlaces}</Text>
            {getRestOfUsers().map((user, index) => {
              return (
                <View key={user.id}>
                  {renderLeaderboardItem({ item: user, index })}
                </View>
              );
            })}
            {getRestOfUsers().length === 0 && usersWithRanks.length <= 3 && (
              <Text style={styles.emptyText}>{t.social.noMoreUsers}</Text>
            )}
          </View>
        )}

        {/* Current User Position (if not in top 13) */}
        {!loading && getCurrentUserRank() && getCurrentUserRank()! > 13 && (
          <View style={styles.currentUserSection}>
            <Text style={styles.currentUserSectionTitle}>{t.social.yourPosition}</Text>
            {renderLeaderboardItem({
              item: getCurrentUserStats()!,
              index: 0,
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number; top: number; bottom: number }) => {
  const { width: screenWidth } = Dimensions.get('window');
  const isLandscape = layout?.isLandscape ?? false;
  const isTablet = layout?.isTablet ?? false;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets?.left ?? 0, insets?.right ?? 0, 16) : 16;
  const contentMaxWidth = isLandscape ? Math.min((layout?.width ?? screenWidth) * 0.7, 600) : screenWidth;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.headerGradient,
      paddingVertical: isPhoneLandscape ? 8 : 14,
      paddingHorizontal: Math.max(horizontalPadding, 16),
    },
    headerTitle: {
      fontSize: isPhoneLandscape ? 18 : 20,
      fontWeight: "bold",
      color: '#fff',
      textAlign: "center",
    },
    manageButton: {
      position: 'absolute',
      right: horizontalPadding,
      padding: 8,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    scrollContainer: {
      flex: 1,
    },
    competitionsCarousel: {
      paddingHorizontal: isLandscape ? horizontalPadding : 0,
      alignItems: isLandscape ? 'center' : undefined,
    },
    competitionSlide: {
      width: isLandscape ? Math.min(contentMaxWidth, screenWidth - 60) : screenWidth - 30,
      marginHorizontal: 0,
      alignSelf: isLandscape ? 'center' : undefined,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 6,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
    },
    paginationDotActive: {
      backgroundColor: theme.primary,
      width: 20,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    filterContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: isPhoneLandscape ? 8 : 12,
      paddingHorizontal: horizontalPadding,
      backgroundColor: theme.surface,
      marginBottom: 10,
    },
    filterTab: {
      paddingHorizontal: isPhoneLandscape ? 16 : 20,
      paddingVertical: isPhoneLandscape ? 6 : 8,
      borderRadius: 20,
      marginHorizontal: 4,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    },
    filterTabActive: {
      backgroundColor: theme.buttonPrimary,
    },
    filterTabText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    filterTabTextActive: {
      color: '#fff',
      fontWeight: 'bold',
    },
    // Podium Styles
    podiumContainer: {
      backgroundColor: theme.surface,
      padding: isPhoneLandscape ? 15 : 20,
      marginBottom: 10,
      alignSelf: isLandscape ? 'center' : undefined,
      width: isLandscape ? contentMaxWidth : undefined,
      maxWidth: isLandscape ? 600 : undefined,
    },
    podiumRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "flex-end",
      minHeight: isPhoneLandscape ? 150 : 180,
    },
    podiumPlace: {
      alignItems: "center",
      marginHorizontal: 10,
      flex: 1,
    },
    podiumAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginTop: 8,
      marginBottom: 5,
      borderWidth: 3,
      borderColor: theme.surface,
    },
    podiumName: {
      fontSize: 12,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
      marginBottom: 2,
    },
    podiumPoints: {
      fontSize: 10,
      color: theme.textSecondary,
      marginBottom: 2,
      textAlign: "center",
    },
    podiumMedal: {
      fontSize: 20,
    },
    // List Styles
    listSection: {
      backgroundColor: theme.surface,
      marginTop: 10,
      paddingTop: 15,
      alignSelf: isLandscape ? 'center' : undefined,
      width: isLandscape ? contentMaxWidth : undefined,
      maxWidth: isLandscape ? 600 : undefined,
    },
    listTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      paddingHorizontal: horizontalPadding,
      marginBottom: 10,
    },
    leaderboardItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      marginVertical: 4,
      marginHorizontal: horizontalPadding,
      padding: isPhoneLandscape ? 12 : 16,
      borderRadius: 14,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    currentUserItem: {
      borderWidth: 2,
      borderColor: theme.secondary,
      backgroundColor: theme.isDark ? "rgba(155, 89, 182, 0.15)" : "#f8f4ff",
    },
    rankContainer: {
      alignItems: "center",
      marginEnd: 15,
      minWidth: 40,
    },
    rankNumber: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
    },
    userAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginEnd: 15,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    currentUserName: {
      color: theme.secondary,
    },
    userStat: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    emptyText: {
      textAlign: "center",
      color: theme.textSecondary,
      fontSize: 16,
      margin: horizontalPadding,
    },
    currentUserSection: {
      backgroundColor: theme.surface,
      marginTop: 10,
      paddingTop: 15,
      paddingBottom: 15,
      alignSelf: isLandscape ? 'center' : undefined,
      width: isLandscape ? contentMaxWidth : undefined,
      maxWidth: isLandscape ? 600 : undefined,
    },
    currentUserSectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.textSecondary,
      paddingHorizontal: horizontalPadding,
      marginBottom: 10,
    },
  });
};
