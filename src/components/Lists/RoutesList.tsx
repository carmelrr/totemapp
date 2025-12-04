import React from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RouteDoc } from '@/features/routes-map/types/route';
import { useFiltersStore } from '@/store/useFiltersStore';
import { getColorHex, getContrastTextColor } from '@/constants/colors';
import { useTheme } from '@/features/theme/ThemeContext';

interface RoutesListProps {
  routes: RouteDoc[];
  visibleRouteIds?: string[];
  onRoutePress?: (route: RouteDoc) => void;
}

interface RouteItemProps {
  route: RouteDoc;
  onPress?: (route: RouteDoc) => void;
  theme: any;
}

// Helper function to get the actual color - handles both hex and color names
const getRouteColor = (color?: string): string => {
  if (!color) return '#808080';
  // If it's already a hex color, return it
  if (color.startsWith('#')) return color;
  // Otherwise try to get from color mapping
  return getColorHex(color) || '#808080';
};

const RouteItem = React.memo(({ route, onPress, theme }: RouteItemProps) => {
  const styles = createStyles(theme);
  
  // Get display grade - use calculated grade (community consensus) if available, otherwise original
  const getGradeDisplay = (route: RouteDoc) => {
    const grade = route.calculatedGrade || route.grade;
    if (!grade) return '?';
    return grade;
  };

  // Check if grade was changed by community
  const isGradeFromCommunity = route.calculatedGrade && route.calculatedGrade !== route.grade;

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
    onPress?.(route);
  };

  const routeColor = getRouteColor(route.color);
  const textColor = getContrastTextColor(routeColor);

  return (
    <TouchableOpacity 
      style={[styles.routeItem, { borderLeftColor: routeColor }]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.routeContent}>
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
              {route.name || `מסלול ${route.id.slice(-6)}`}
            </Text>
            
            {/* Star Rating - inline */}
            {starInfo && (
              <View style={styles.inlineStars}>
                <Text style={styles.inlineStarText}>★</Text>
                <Text style={styles.inlineRatingNumber}>{starInfo.rating}</Text>
              </View>
            )}
            
            <View style={[styles.gradeBadge, { backgroundColor: `${routeColor}15` }]}>
              <Text style={[styles.routeGrade, { color: routeColor }]}>
                {getGradeDisplay(route)}
              </Text>
              {isGradeFromCommunity && (
                <Text style={styles.communityBadge}>👥</Text>
              )}
            </View>
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
                <Text style={styles.metadataLabel}>מקים:</Text>
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
export default function RoutesList({
  routes,
  visibleRouteIds,
  onRoutePress,
}: RoutesListProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { getFilteredRoutes } = useFiltersStore();

  // אם יש לנו visibleRouteIds, זה אומר שהמסלולים כבר עברו סינון viewport ב-RoutesMapScreen
  // במקרה הזה אנחנו רוצים להציג את כל המסלולים שהגיעו ללא סינון נוסף
  // אחרת, נשתמש בפילטרים הרגילים של FiltersStore
  const filteredRoutes = (visibleRouteIds && visibleRouteIds.length > 0) ? 
    routes : 
    getFilteredRoutes(routes, undefined);

  console.log('[RoutesList] Filtering:', {
    inputRoutes: routes.length,
    outputRoutes: filteredRoutes.length,
    visibleRouteIds: visibleRouteIds?.length || 0,
    routeIds: routes.map(r => r.id.slice(-6)),
    filteredIds: filteredRoutes.map(r => r.id.slice(-6)),
    skipFiltering: !!(visibleRouteIds && visibleRouteIds.length > 0)
  });

  const renderItem = ({ item }: { item: RouteDoc }) => (
    <RouteItem route={item} onPress={onRoutePress} theme={theme} />
  );

  const keyExtractor = (item: RouteDoc) => item.id;

  const getItemLayout = (data: RouteDoc[] | null | undefined, index: number) => ({
    length: 80, // גובה משוער לכל פריט
    offset: 80 * index,
    index,
  });

  if (filteredRoutes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>לא נמצאו מסלולים התואמים לפילטרים</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredRoutes}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      maxToRenderPerBatch={10}
      windowSize={10}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={true}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  routeItem: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 4,
  },
  routeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorAccentContainer: {
    position: 'relative',
    marginRight: 14,
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
    marginRight: 8,
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  routeGrade: {
    fontSize: 14,
    fontWeight: '700',
  },
  communityBadge: {
    fontSize: 10,
    marginLeft: 2,
  },
  inlineStars: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginRight: 8,
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
    marginLeft: 10,
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
