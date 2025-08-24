import React from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RouteDoc } from '@/features/routes-map/types/route';
import { useFiltersStore } from '@/store/useFiltersStore';
import { getColorHex } from '@/constants/colors';

interface RoutesListProps {
  routes: RouteDoc[];
  visibleRouteIds?: string[];
  onRoutePress?: (route: RouteDoc) => void;
}

interface RouteItemProps {
  route: RouteDoc;
  onPress?: (route: RouteDoc) => void;
}

const RouteItem = React.memo(({ route, onPress }: RouteItemProps) => {
  const getGradeDisplay = (grade?: string) => {
    if (!grade) return '?';
    return grade;
  };

  const getColorIndicator = (color?: string) => {
    if (!color) return '#ccc';
    return getColorHex(color);
  };

  const handlePress = () => {
    onPress?.(route);
  };

  return (
    <TouchableOpacity style={styles.routeItem} onPress={handlePress}>
      <View style={styles.routeInfo}>
        <View style={styles.routeHeader}>
          <View
            style={[
              styles.colorIndicator,
              { backgroundColor: getColorIndicator(route.color) },
            ]}
          />
          <Text style={styles.routeName} numberOfLines={1}>
            {route.name || `מסלול ${route.id}`}
          </Text>
          <Text style={styles.routeGrade}>{getGradeDisplay(route.grade)}</Text>
        </View>
        
        {route.tags && route.tags.length > 0 && (
          <Text style={styles.routeTags} numberOfLines={1}>
            {route.tags.join(' • ')}
          </Text>
        )}
        
        <View style={styles.routeMetadata}>
          {route.setter && (
            <Text style={styles.routeSetter}>מקים: {route.setter}</Text>
          )}
          {route.createdAt && (
            <Text style={styles.routeDate}>
              {route.createdAt.toDate?.() ? 
                route.createdAt.toDate().toLocaleDateString('he-IL') :
                'לא ידוע'
              }
            </Text>
          )}
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
  const { getFilteredRoutes } = useFiltersStore();

  // סינון המסלולים לפי הפילטרים הפעילים
  const filteredRoutes = getFilteredRoutes(routes, visibleRouteIds);

  const renderItem = ({ item }: { item: RouteDoc }) => (
    <RouteItem route={item} onPress={onRoutePress} />
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

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listContent: {
    paddingVertical: 8,
  },
  routeItem: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  routeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  routeGrade: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 40,
    textAlign: 'center',
  },
  routeDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    lineHeight: 18,
  },
  routeTags: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  routeMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeSetter: {
    fontSize: 12,
    color: '#9ca3af',
  },
  routeDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
