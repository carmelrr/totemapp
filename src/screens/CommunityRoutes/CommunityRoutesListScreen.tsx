// src/screens/CommunityRoutes/CommunityRoutesListScreen.tsx
// Main screen showing list of community routes with filtering and sorting

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, lightTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  useCommunityRoutes,
  useUserSentRoutes,
  CommunityRoute,
  CommunityRouteFilters,
  getDaysUntilExpiration,
  isExpiringSoon,
  V_GRADES,
  CompletionFilter,
} from '@/features/community-routes';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useRouteNavigationStore } from '@/store/useRouteNavigationStore';

type Theme = typeof lightTheme;
type SortOption = 'newest' | 'oldest' | 'top-rated' | 'most-sends' | 'easy-to-hard' | 'hard-to-easy' | 'most-repeats';

export const CommunityRoutesListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, width } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  
  const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
    { key: 'easy-to-hard', label: t.community.easyToHard, icon: 'trending-up-outline' },
    { key: 'hard-to-easy', label: t.community.hardToEasy, icon: 'trending-down-outline' },
    { key: 'top-rated', label: t.community.topRated, icon: 'star-outline' },
    { key: 'most-repeats', label: t.common?.mostRepeats || 'הכי חזרות', icon: 'repeat-outline' },
    { key: 'newest', label: t.community.new, icon: 'time-outline' },
    { key: 'oldest', label: t.community.oldest, icon: 'calendar-outline' },
  ];
  
  const [filters, setFilters] = useState<CommunityRouteFilters>({ sortBy: 'newest' });
  const { routes: rawRoutes, loading, refresh } = useCommunityRoutes(filters);
  // Get all routes without filters to build filter options
  const { routes: allRoutes } = useCommunityRoutes({ sortBy: 'newest' });
  const [refreshing, setRefreshing] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // User's sent routes for completion filtering (from communityRouteSends collection)
  const { sentRouteIds: completedRouteIds } = useUserSentRoutes();
  
  // Apply completion filter locally
  const routes = useMemo(() => {
    if (!filters.completionStatus || filters.completionStatus === 'all') {
      return rawRoutes;
    }
    if (filters.completionStatus === 'completed') {
      return rawRoutes.filter(route => completedRouteIds.has(route.id));
    }
    return rawRoutes.filter(route => !completedRouteIds.has(route.id));
  }, [rawRoutes, filters.completionStatus, completedRouteIds]);

  // Get unique grades from ALL routes for filter options (sorted by difficulty)
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    allRoutes.forEach(r => {
      if (r.grade) {
        grades.add(r.grade);
      }
    });
    // Sort by V_GRADES order
    return Array.from(grades).sort((a, b) => {
      const idxA = V_GRADES.indexOf(a);
      const idxB = V_GRADES.indexOf(b);
      return idxA - idxB;
    });
  }, [allRoutes]);

  // Get unique creators from ALL routes for filter options
  const uniqueCreators = useMemo(() => {
    const creators = new Map<string, string>();
    allRoutes.forEach(r => {
      if (r.createdBy && r.creatorName) {
        creators.set(r.createdBy, r.creatorName);
      }
    });
    return Array.from(creators.entries()).map(([id, name]) => ({ id, name }));
  }, [allRoutes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleSortChange = (sortBy: SortOption) => {
    setFilters((prev) => ({ ...prev, sortBy }));
    setShowSortModal(false);
  };

  const toggleFilterGrade = (grade: string) => {
    setFilters((prev) => {
      const currentGrades = prev.filterGrades || [];
      if (currentGrades.includes(grade)) {
        return { ...prev, filterGrades: currentGrades.filter(g => g !== grade) };
      } else {
        return { ...prev, filterGrades: [...currentGrades, grade] };
      }
    });
  };

  const toggleFilterCreator = (creatorId: string) => {
    setFilters((prev) => {
      const currentCreators = prev.filterCreators || [];
      if (currentCreators.includes(creatorId)) {
        return { ...prev, filterCreators: currentCreators.filter(c => c !== creatorId) };
      } else {
        return { ...prev, filterCreators: [...currentCreators, creatorId] };
      }
    });
  };

  const setCompletionFilter = (status: CompletionFilter) => {
    setFilters((prev) => ({ ...prev, completionStatus: status }));
  };

  const clearFilters = () => {
    setFilters((prev) => ({ ...prev, filterGrades: undefined, filterCreators: undefined, completionStatus: undefined }));
    setShowFilterModal(false);
  };

  const hasActiveFilters = (filters.filterGrades && filters.filterGrades.length > 0) || 
                           (filters.filterCreators && filters.filterCreators.length > 0) ||
                           (filters.completionStatus && filters.completionStatus !== 'all');
  
  const activeFiltersCount = (filters.filterGrades?.length || 0) + 
                             (filters.filterCreators?.length || 0) +
                             (filters.completionStatus && filters.completionStatus !== 'all' ? 1 : 0);

  const handleRoutePress = (route: CommunityRoute) => {
    // Set route list for swipe navigation
    useRouteNavigationStore.getState().setNavigationList(routes.map(r => r.id));
    navigation.navigate('CommunityRouteDetail', { routeId: route.id });
  };

  const handleAddRoute = () => {
    navigation.navigate('AddCommunityRoute');
  };

  const renderRouteCard = ({ item }: { item: CommunityRoute }) => {
    const daysLeft = getDaysUntilExpiration(item.expiresAt);
    const expiringSoon = isExpiringSoon(item.expiresAt);

    return (
      <TouchableOpacity
        style={[styles.routeCard, { backgroundColor: theme.surface }]}
        onPress={() => handleRoutePress(item)}
        activeOpacity={0.8}
      >
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.routeImage}
            resizeMode="cover"
          />
          {/* Expiration badge */}
          <View
            style={[
              styles.expirationBadge,
              expiringSoon && styles.expirationBadgeWarning,
            ]}
          >
            <Ionicons
              name="time-outline"
              size={isPhoneLandscape ? 9 : 12}
              color={expiringSoon ? theme.error : '#fff'}
            />
            <Text
              style={[
                styles.expirationText,
                expiringSoon && styles.expirationTextWarning,
              ]}
            >
              {daysLeft} {t.community.daysLeft}
            </Text>
          </View>
          {/* Grade badge */}
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeText}>{item.grade}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.routeInfo}>
          <Text style={[styles.routeName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.routeMeta}>
            <Text style={[styles.creatorName, { color: theme.textSecondary }]}>
              {t.community.by} {item.creatorName}
            </Text>
            {item.gymName && (
              <Text style={[styles.gymName, { color: theme.textSecondary }]}>
                ðŸ“ {item.gymName}
              </Text>
            )}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="star" size={isPhoneLandscape ? 10 : 14} color={theme.starColor} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                {item.averageStarRating ? item.averageStarRating.toFixed(1) : '-'}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle" size={isPhoneLandscape ? 10 : 14} color={theme.success} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                {item.sentCount || 0}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Sort and Filter buttons */}
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.surface }]}
          onPress={() => setShowSortModal(true)}
        >
          <Ionicons name="swap-vertical-outline" size={18} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.text }]}>
            {t.community.sort}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.actionButton, 
            { backgroundColor: theme.surface },
            hasActiveFilters && { borderColor: theme.primary, borderWidth: 2 }
          ]}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons 
            name={hasActiveFilters ? "funnel" : "funnel-outline"} 
            size={18} 
            color={hasActiveFilters ? theme.primary : theme.textSecondary} 
          />
          <Text style={[styles.actionButtonText, { color: theme.text }]}>
            {t.community.filter}
          </Text>
          {hasActiveFilters && (
            <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.filterBadgeText}>
                {activeFiltersCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSortModal = () => (
    <Modal
      visible={showSortModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSortModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={() => setShowSortModal(false)}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            {t.community.sort}
          </Text>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.modalOption,
                filters.sortBy === option.key && { backgroundColor: theme.primary + '20' }
              ]}
              onPress={() => handleSortChange(option.key)}
            >
              <Ionicons
                name={option.icon as any}
                size={20}
                color={filters.sortBy === option.key ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.modalOptionText,
                  { color: filters.sortBy === option.key ? theme.primary : theme.text },
                ]}
              >
                {option.label}
              </Text>
              {filters.sortBy === option.key && (
                <Ionicons name="checkmark" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderFilterModal = () => {
    const isGradeSelected = (grade: string) => filters.filterGrades?.includes(grade) || false;
    const isCreatorSelected = (creatorId: string) => filters.filterCreators?.includes(creatorId) || false;
    
    return (
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowFilterModal(false)}
          >
            <View />
          </TouchableOpacity>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, maxHeight: '70%', position: 'absolute' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t.community.filter}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {hasActiveFilters && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={[styles.clearFilterText, { color: theme.primary }]}>
                      {t.community.clearFilters}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Filter by Completion Status */}
              <Text style={[styles.filterSectionTitle, { color: theme.textSecondary }]}>
                {t.filters.completionStatus}
              </Text>
              <View style={styles.completionOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.completionChip,
                    { borderColor: theme.border, backgroundColor: theme.card },
                    (!filters.completionStatus || filters.completionStatus === 'all') && { backgroundColor: theme.success, borderColor: theme.success }
                  ]}
                  onPress={() => setCompletionFilter('all')}
                >
                  <Text style={[
                    styles.completionChipText,
                    { color: theme.textSecondary },
                    (!filters.completionStatus || filters.completionStatus === 'all') && { color: '#ffffff' }
                  ]}>
                    {t.filters.showAll}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.completionChip,
                    { borderColor: theme.border, backgroundColor: theme.card },
                    filters.completionStatus === 'completed' && { backgroundColor: theme.success, borderColor: theme.success }
                  ]}
                  onPress={() => setCompletionFilter('completed')}
                >
                  <Text style={[
                    styles.completionChipText,
                    { color: theme.textSecondary },
                    filters.completionStatus === 'completed' && { color: '#ffffff' }
                  ]}>
                    âœ“ {t.filters.showCompleted}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.completionChip,
                    { borderColor: theme.border, backgroundColor: theme.card },
                    filters.completionStatus === 'not-completed' && { backgroundColor: theme.success, borderColor: theme.success }
                  ]}
                  onPress={() => setCompletionFilter('not-completed')}
                >
                  <Text style={[
                    styles.completionChipText,
                    { color: theme.textSecondary },
                    filters.completionStatus === 'not-completed' && { color: '#ffffff' }
                  ]}>
                    {t.filters.showNotCompleted}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Filter by Grade */}
              <Text style={[styles.filterSectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>
                {t.community.filterByGrade}
              </Text>
              {uniqueGrades.map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[
                    styles.modalOption,
                    isGradeSelected(grade) && { backgroundColor: theme.primary + '20' }
                  ]}
                  onPress={() => toggleFilterGrade(grade)}
                >
                  <Ionicons
                    name={isGradeSelected(grade) ? "checkbox" : "square-outline"}
                    size={22}
                    color={isGradeSelected(grade) ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      { color: isGradeSelected(grade) ? theme.primary : theme.text },
                    ]}
                  >
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
              
              {/* Filter by Creator */}
              <Text style={[styles.filterSectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>
                {t.community.filterByCreator}
              </Text>
              {uniqueCreators.map((creator) => (
                <TouchableOpacity
                  key={creator.id}
                  style={[
                    styles.modalOption,
                    isCreatorSelected(creator.id) && { backgroundColor: theme.primary + '20' }
                  ]}
                  onPress={() => toggleFilterCreator(creator.id)}
                >
                  <Ionicons
                    name={isCreatorSelected(creator.id) ? "checkbox" : "square-outline"}
                    size={22}
                    color={isCreatorSelected(creator.id) ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      { color: isCreatorSelected(creator.id) ? theme.primary : theme.text },
                    ]}
                  >
                    {creator.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="images-outline" size={80} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {t.community.noRoutes}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {t.community.beFirstToShare}
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: theme.buttonPrimary }]}
        onPress={handleAddRoute}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>{t.community.createNewRoute}</Text>
      </TouchableOpacity>
    </View>
  );

  // Determine number of columns based on orientation
  const numColumns = isLandscape ? (isTablet ? 4 : 3) : 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.compactHeader}>
        <BrandLogo variant="icon" color="white" size={24} />
        <Text style={styles.compactHeaderTitle}>{t.community.title}</Text>
      </View>

      {/* Sort Tabs */}
      {renderHeader()}

      {/* Routes List */}
      {loading && routes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t.community.loadingRoutes}
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          renderItem={renderRouteCard}
          keyExtractor={(item) => item.id || ''}
          contentContainerStyle={styles.listContent}
          key={`grid-${numColumns}`}
          numColumns={numColumns}
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.buttonPrimary }]}
        onPress={handleAddRoute}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Sort Modal */}
      {renderSortModal()}
      
      {/* Filter Modal */}
      {renderFilterModal()}
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme, layout: any, insets: any) => {
  const { isLandscape, isTablet, width, height } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  // More columns in landscape for smaller cards
  const numColumns = isLandscape ? (isTablet ? 4 : 4) : 2;
  const cardWidth = isLandscape 
    ? `${Math.floor(100 / numColumns) - 2}%` 
    : '48%';
  // Smaller aspect ratio for phone landscape to fit more items
  const imageAspectRatio = isPhoneLandscape ? 0.75 : 1;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    compactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.headerGradient,
      paddingVertical: isPhoneLandscape ? 10 : 14,
      paddingHorizontal: 16,
      paddingStart: isLandscape ? Math.max(16, insets.left) : 16,
      paddingEnd: isLandscape ? Math.max(16, insets.right) : 16,
    },
    compactHeaderTitle: {
      fontSize: isPhoneLandscape ? 18 : 20,
      fontWeight: 'bold',
      color: '#fff',
    },
    header: {
      paddingHorizontal: 12,
      paddingVertical: isPhoneLandscape ? 8 : 12,
      paddingStart: isLandscape ? Math.max(12, insets.left) : 12,
      paddingEnd: isLandscape ? Math.max(12, insets.right) : 12,
    },
    sortContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.isDark ? 'rgba(150,150,150,0.2)' : 'rgba(150,150,150,0.15)',
      gap: 4,
    },
    sortButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    listContent: {
      padding: 8,
      paddingBottom: 100,
      paddingStart: isLandscape ? Math.max(8, insets.left) : 8,
      paddingEnd: isLandscape ? Math.max(8, insets.right) : 8,
    },
    columnWrapper: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: 8,
    },
    routeCard: {
      width: cardWidth,
      borderRadius: isPhoneLandscape ? 10 : 16,
      marginBottom: isPhoneLandscape ? 8 : 12,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      backgroundColor: theme.surface,
    },
  imageContainer: {
    width: '100%',
    aspectRatio: imageAspectRatio,
    position: 'relative',
  },
  routeImage: {
    width: '100%',
    height: '100%',
  },
  expirationBadge: {
    position: 'absolute',
    top: isPhoneLandscape ? 4 : 8,
    left: isPhoneLandscape ? 4 : 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: isPhoneLandscape ? 4 : 6,
    paddingVertical: isPhoneLandscape ? 2 : 3,
    borderRadius: isPhoneLandscape ? 8 : 10,
    gap: isPhoneLandscape ? 2 : 3,
  },
  expirationBadgeWarning: {
    backgroundColor: theme.error,
  },
  expirationText: {
    fontSize: isPhoneLandscape ? 8 : 10,
    color: '#fff',
    fontWeight: '600',
  },
  expirationTextWarning: {
    color: '#fff',
  },
  gradeBadge: {
    position: 'absolute',
    top: isPhoneLandscape ? 4 : 8,
    right: isPhoneLandscape ? 4 : 8,
    backgroundColor: theme.secondary,
    paddingHorizontal: isPhoneLandscape ? 5 : 8,
    paddingVertical: isPhoneLandscape ? 2 : 4,
    borderRadius: isPhoneLandscape ? 6 : 8,
  },
  gradeText: {
    fontSize: isPhoneLandscape ? 10 : 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeInfo: {
    padding: isPhoneLandscape ? 6 : 10,
  },
  routeName: {
    fontSize: isPhoneLandscape ? 12 : 14,
    fontWeight: 'bold',
    marginBottom: isPhoneLandscape ? 2 : 4,
    color: theme.text,
  },
  routeMeta: {
    marginBottom: isPhoneLandscape ? 3 : 6,
  },
  creatorName: {
    fontSize: isPhoneLandscape ? 9 : 11,
    color: theme.textSecondary,
  },
  gymName: {
    fontSize: isPhoneLandscape ? 8 : 10,
    marginTop: isPhoneLandscape ? 1 : 2,
    color: theme.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: isPhoneLandscape ? 8 : 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isPhoneLandscape ? 2 : 3,
  },
  statText: {
    fontSize: isPhoneLandscape ? 9 : 11,
    color: theme.textSecondary,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
    color: theme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    color: theme.textSecondary,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
    gap: 6,
    backgroundColor: theme.buttonPrimary,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    backgroundColor: theme.buttonPrimary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: theme.surface,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  filterBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: 4,
    backgroundColor: theme.primary,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
    backgroundColor: theme.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    flex: 1,
    color: theme.text,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    color: theme.textSecondary,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.primary,
  },
  completionOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  completionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  completionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
});
};

export default CommunityRoutesListScreen;
