// src/screens/CommunityRoutes/CommunityRoutesListScreen.tsx
// Main screen showing list of community routes with filtering and sorting

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/features/theme/ThemeContext';
import {
  useCommunityRoutes,
  CommunityRoute,
  CommunityRouteFilters,
  getDaysUntilExpiration,
  isExpiringSoon,
} from '@/features/community-routes';

type SortOption = 'newest' | 'popular' | 'expiring-soon';

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'newest', label: 'חדש', icon: 'time-outline' },
  { key: 'popular', label: 'פופולרי', icon: 'heart-outline' },
  { key: 'expiring-soon', label: 'הולך', icon: 'hourglass-outline' },
];

export const CommunityRoutesListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [filters, setFilters] = useState<CommunityRouteFilters>({ sortBy: 'newest' });
  const { routes, loading, refresh } = useCommunityRoutes(filters);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleSortChange = (sortBy: SortOption) => {
    setFilters((prev) => ({ ...prev, sortBy }));
  };

  const handleRoutePress = (route: CommunityRoute) => {
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
              size={12}
              color={expiringSoon ? '#FF6B6B' : '#fff'}
            />
            <Text
              style={[
                styles.expirationText,
                expiringSoon && styles.expirationTextWarning,
              ]}
            >
              {daysLeft} ימים
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
              מאת {item.creatorName}
            </Text>
            {item.gymName && (
              <Text style={[styles.gymName, { color: theme.textSecondary }]}>
                📍 {item.gymName}
              </Text>
            )}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="heart" size={14} color="#FF6B6B" />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                {item.likeCount || 0}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="chatbubble" size={14} color={theme.textSecondary} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                {item.commentCount || 0}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="eye" size={14} color={theme.textSecondary} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                {item.viewCount || 0}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Sort buttons */}
      <View style={styles.sortContainer}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortButton,
              filters.sortBy === option.key && {
                backgroundColor: theme.primary,
              },
            ]}
            onPress={() => handleSortChange(option.key)}
          >
            <Ionicons
              name={option.icon as any}
              size={16}
              color={filters.sortBy === option.key ? '#fff' : theme.textSecondary}
            />
            <Text
              style={[
                styles.sortButtonText,
                {
                  color:
                    filters.sortBy === option.key ? '#fff' : theme.textSecondary,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="images-outline" size={80} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        אין מסלולים עדיין
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        היה הראשון ליצור מסלול על תמונה אמיתית של הקיר!
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
        onPress={handleAddRoute}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>צור מסלול חדש</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[theme.headerGradient, theme.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Text style={styles.title}>מסלולי קהילה</Text>
        <Text style={styles.subtitle}>מסלולים על תמונות אמיתיות • 30 ימים</Text>
      </LinearGradient>

      {/* Sort Tabs */}
      {renderHeader()}

      {/* Routes List */}
      {loading && routes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            טוען מסלולים...
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          renderItem={renderRouteCard}
          keyExtractor={(item) => item.id || ''}
          contentContainerStyle={styles.listContent}
          numColumns={2}
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
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={handleAddRoute}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    marginTop: 4,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sortContainer: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.15)',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 8,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  routeCard: {
    width: '48%',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  routeImage: {
    width: '100%',
    height: '100%',
  },
  expirationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  expirationBadgeWarning: {
    backgroundColor: 'rgba(255,107,107,0.9)',
  },
  expirationText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  expirationTextWarning: {
    color: '#fff',
  },
  gradeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#8E4EC6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeInfo: {
    padding: 10,
  },
  routeName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  routeMeta: {
    marginBottom: 6,
  },
  creatorName: {
    fontSize: 11,
    textAlign: 'right',
  },
  gymName: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
    gap: 6,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default CommunityRoutesListScreen;
