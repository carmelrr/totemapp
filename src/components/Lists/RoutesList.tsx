import React, { useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteDoc } from '@/features/routes-map/types/route';
import { useFiltersStore, filterRoutes } from '@/store/useFiltersStore';
import { useWallTapes } from '@/features/routes-map/hooks/useWallTapes';
import { getColorHex, getContrastTextColor } from '@/constants/colors';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language/LanguageContext';
import { getColorTranslationKey } from '@/features/routes-map/utils/colors';
import { getRouteDisplayName } from '@/features/routes-map/utils/colors';

interface RoutesListProps {
  routes: RouteDoc[];
  visibleRouteIds?: string[];
  onRoutePress?: (route: RouteDoc) => void;
  onRouteLongPress?: (route: RouteDoc) => void;
  compact?: boolean; // For landscape mode - reduced padding
  /** Multi-select mode */
  multiSelectMode?: boolean;
  multiSelectedIds?: Set<string>;
  onToggleSelect?: (routeId: string) => void;
}

interface RouteItemProps {
  route: RouteDoc;
  onPress?: (route: RouteDoc) => void;
  onLongPress?: (route: RouteDoc) => void;
  theme: any;
  t: any;
  language: 'he' | 'en';
  multiSelectMode?: boolean;
  isMultiSelected?: boolean;
  onToggleSelect?: (routeId: string) => void;
}

// Helper function to get the actual color - handles both hex and color names
const getRouteColor = (color?: string): string => {
  if (!color) return '#808080';
  // If it's already a hex color, return it
  if (color.startsWith('#')) return color;
  // Otherwise try to get from color mapping
  return getColorHex(color) || '#808080';
};

const RouteItem = React.memo(({ route, onPress, onLongPress, theme, t, language, multiSelectMode, isMultiSelected, onToggleSelect }: RouteItemProps) => {
  const styles = createStyles(theme);
  
  // Get translated display name using color hex and grade
  const getDisplayName = (route: RouteDoc) => {
    return getRouteDisplayName(route, language, t);
  };
  
  // Get star rating display
  const getStarDisplay = (rating?: number) => {
    if (!rating || rating === 0) return null;
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalf) stars += '½';
    return { stars, rating: rating.toFixed(1) };
  };

  const starInfo = getStarDisplay(route.averageStarRating);

  const handlePress = () => {
    if (multiSelectMode && onToggleSelect) {
      onToggleSelect(route.id);
      return;
    }
    onPress?.(route);
  };

  const handleLongPress = () => {
    onLongPress?.(route);
  };

  const routeColor = getRouteColor(route.color);
  const textColor = getContrastTextColor(routeColor);

  return (
    <TouchableOpacity 
      style={[
        styles.routeItem, 
        { borderStartColor: routeColor },
        multiSelectMode && isMultiSelected && styles.routeItemSelected,
      ]} 
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <View style={styles.routeContent}>
        {/* Multi-select checkbox */}
        {multiSelectMode && (
          <View style={styles.checkboxContainer}>
            <Ionicons 
              name={isMultiSelected ? "checkbox" : "square-outline"} 
              size={22} 
              color={isMultiSelected ? '#E53935' : theme.textSecondary} 
            />
          </View>
        )}
        {/* Color accent circle */}
        <View style={styles.colorAccentContainer}>
          <View
            style={[
              styles.colorAccent,
              { backgroundColor: routeColor },
            ]}
          />
          <View 
            style={[
              styles.colorAccentGlow,
              { backgroundColor: routeColor, opacity: 0.15 }
            ]} 
          />
        </View>
        
        <View style={styles.routeInfo}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeName} numberOfLines={1}>
              {getDisplayName(route)}
            </Text>
            
            {/* Star Rating - inline */}
            {starInfo && (
              <View style={styles.inlineStars}>
                <Text style={styles.inlineStarText}>★</Text>
                <Text style={styles.inlineRatingNumber}>{starInfo.rating}</Text>
              </View>
            )}
          </View>
          
          {route.tags && route.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {route.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          
          <View style={styles.routeMetadata}>
            {route.setter && (
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>{t.routes.setter}:</Text>
                <Text style={styles.metadataValue}>{route.setter}</Text>
              </View>
            )}
            {route.tops !== undefined && route.tops > 0 && (
              <View style={styles.metadataItem}>
                <Text style={styles.topsIcon}>🏆</Text>
                <Text style={styles.topsCount}>{route.tops}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Chevron indicator */}
        <View style={styles.chevronContainer}>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

/**
 * רשימה וירטואלית של מסלולים עם סינון ומיון אוטומטי
 * מציגה רק מסלולים שעוברים את הפילטרים הנוכחיים
 */
const RoutesList = React.memo(function RoutesList({
  routes,
  visibleRouteIds,
  onRoutePress,
  onRouteLongPress,
  compact = false,
  multiSelectMode = false,
  multiSelectedIds,
  onToggleSelect,
}: RoutesListProps) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const filters = useFiltersStore(state => state.filters);
  const sorting = useFiltersStore(state => state.sorting);
  const searchQuery = useFiltersStore(state => state.searchQuery);
  const { tapes: wallTapesCatalog } = useWallTapes();

  // Memoize filtered routes to avoid recalculating on every render
  const filteredRoutes = useMemo(() => {
    if (visibleRouteIds && visibleRouteIds.length > 0) {
      return routes;
    }
    return filterRoutes(routes, filters, sorting, searchQuery, undefined, undefined, wallTapesCatalog);
  }, [routes, visibleRouteIds, filters, sorting, searchQuery, wallTapesCatalog]);

  const renderItem = useCallback(({ item }: { item: RouteDoc }) => (
    <RouteItem 
      route={item} 
      onPress={onRoutePress} 
      onLongPress={onRouteLongPress} 
      theme={theme} 
      t={t}
      language={language}
      multiSelectMode={multiSelectMode}
      isMultiSelected={multiSelectedIds?.has(item.id) ?? false}
      onToggleSelect={onToggleSelect}
    />
  ), [onRoutePress, onRouteLongPress, theme, t, multiSelectMode, multiSelectedIds, onToggleSelect]);

  const keyExtractor = useCallback((item: RouteDoc) => item.id, []);

  const getItemLayout = (data: RouteDoc[] | null | undefined, index: number) => ({
    length: 80, // גובה משוער לכל פריט
    offset: 80 * index,
    index,
  });

  if (filteredRoutes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t.common.noRoutesInView}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredRoutes}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      maxToRenderPerBatch={10}
      windowSize={10}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={true}
      initialNumToRender={10}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
});

export default RoutesList;

const createStyles = (theme: any, compact: boolean = false) => StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingVertical: compact ? 4 : 8,
    paddingHorizontal: compact ? 4 : 12,
    gap: compact ? 4 : 8,
  },
  routeItem: {
    backgroundColor: theme.surface,
    borderRadius: compact ? 10 : 14,
    paddingVertical: compact ? 8 : 14,
    paddingHorizontal: compact ? 8 : 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 4,
  },
  routeItemSelected: {
    backgroundColor: 'rgba(229, 57, 53, 0.08)',
    borderWidth: 1,
    borderColor: '#E53935',
  },
  checkboxContainer: {
    marginEnd: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorAccentContainer: {
    position: 'relative',
    marginEnd: 14,
  },
  colorAccent: {
    width: 40,
    height: 40,
    borderRadius: 12,
    zIndex: 1,
  },
  colorAccentGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 50,
    height: 50,
    borderRadius: 16,
    zIndex: 0,
  },
  routeInfo: {
    flex: 1,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginEnd: 8,
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  communityGradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginEnd: 6,
  },
  communityBadgeIcon: {
    fontSize: 10,
  },
  communityGradeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  routeGrade: {
    fontSize: 14,
    fontWeight: '700',
  },
  communityBadge: {
    fontSize: 10,
    marginStart: 2,
  },
  inlineStars: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginEnd: 8,
    gap: 3,
  },
  inlineStarText: {
    fontSize: 14,
    color: '#FFD700',
  },
  inlineRatingNumber: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  starRatingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
    gap: 4,
  },
  starText: {
    fontSize: 14,
    color: '#FFD700',
  },
  ratingNumber: {
    fontSize: 12,
    color: theme.text,
    fontWeight: '600',
  },
  feedbackCount: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  tag: {
    backgroundColor: theme.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  routeMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  metadataValue: {
    fontSize: 12,
    color: theme.text,
    fontWeight: '500',
  },
  topsIcon: {
    fontSize: 12,
  },
  topsCount: {
    fontSize: 12,
    color: theme.warning,
    fontWeight: '600',
  },
  chevronContainer: {
    marginStart: 10,
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 26,
    color: theme.border,
    fontWeight: '300',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});
