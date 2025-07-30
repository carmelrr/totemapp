// screens/WallMapScreen.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions, Alert, TouchableOpacity, Animated, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WallMap from '../components/WallMap';
import RouteList from '../components/RouteList';
import RouteEditPanel from '../components/RouteEditPanel';
import RouteFeedbackView from '../components/RouteFeedbackView';
import FilterSortModal from '../components/FilterSortModal';
import useVisibleRoutes from '../hooks/useVisibleRoutes';
import { deleteRoute, updateRoute, getFeedbacksForRoute, calculateSmartAverageGrade, subscribeToRoutes } from '../routesService';
import { auth } from '../firebase-config';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const window = Dimensions.get('window');
const MAP_WIDTH = window.width;
const MAP_HEIGHT = window.width * 0.65;

export default function WallMapScreen() {
  const { isAdmin, circleSize } = useUser();
  const { theme } = useTheme();
  const [allRoutes, setAllRoutes] = useState([]);
  const [currentScale, setCurrentScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [editingRoute, setEditingRoute] = useState(null); // מסלול שנבחר לעריכה
  const [isMovingRoute, setIsMovingRoute] = useState(false); // האם במצב הזזת מסלול
  const [viewingRoute, setViewingRoute] = useState(null); // מסלול שנבחר לצפייה עם פידבק
  const [isEditMode, setIsEditMode] = useState(false); // מצב עריכה מה-WallMap
  
  // Animation for map offset when viewing feedback
  const mapOffsetY = useRef(new Animated.Value(0)).current;
  
  // Filter and sort state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState('filter');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [sortButtonPosition, setSortButtonPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [filters, setFilters] = useState({
    grades: [],
    colors: [],
    status: 'all' // 'all', 'completed', 'uncompleted'
  });
  const [sortBy, setSortBy] = useState('gradeAsc');
  const [routeFeedbacks, setRouteFeedbacks] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Reload routes data
      const unsubscribe = subscribeToRoutes((routes) => {
        setAllRoutes(routes);
        // Reload feedbacks for all routes
        loadFeedbacks(routes);
        setRefreshing(false);
      });
      
      // Clean up subscription after initial load
      setTimeout(() => {
        unsubscribe();
      }, 1000);
    } catch (error) {
      setRefreshing(false);
      Alert.alert('שגיאה', 'נכשל ברענון הנתונים');
    }
  };

  // Load feedbacks for all routes
  const loadFeedbacks = async (routes = allRoutes) => {
    if (!routes || routes.length === 0) return;
    
    const feedbacksData = {};
    for (const route of routes) {
      if (route && route.id) {
        try {
          const feedbacks = await getFeedbacksForRoute(route.id);
          feedbacksData[route.id] = feedbacks || [];
        } catch (error) {
          feedbacksData[route.id] = [];
        }
      }
    }
    setRouteFeedbacks(feedbacksData);
  };

  // Load feedbacks for all routes
  useEffect(() => {
    loadFeedbacks();
  }, [allRoutes]);

  // Calculate visible routes first
  const visibleRoutes = useVisibleRoutes(
    allRoutes || [],
    currentScale || 1,
    translateX || 0,
    translateY || 0,
    MAP_WIDTH,
    MAP_HEIGHT,
    circleSize
  );

  // Apply filters and sorting to visible routes
  const filteredAndSortedRoutes = useMemo(() => {
    if (!visibleRoutes || visibleRoutes.length === 0) {
      return [];
    }
    
    let filteredRoutes = [...visibleRoutes];

    // Apply filters - only if filter arrays are NOT empty
    if (filters.grades && filters.grades.length > 0) {
      filteredRoutes = filteredRoutes.filter(route => {
        const routeGrade = route.grade || '';
        const matches = filters.grades.includes(routeGrade);
        return matches;
      });
    }

    if (filters.status && filters.status !== 'all') {
      filteredRoutes = filteredRoutes.filter(route => {
        const feedbacks = routeFeedbacks[route.id] || [];
        const completionCount = feedbacks.filter(f => f && f.closedRoute).length;
        
        if (filters.status === 'completed') {
          return completionCount > 0;
        } else if (filters.status === 'uncompleted') {
          return completionCount === 0;
        }
        return true;
      });
    }

    // Apply sorting
    filteredRoutes.sort((a, b) => {
      const aFeedbacks = routeFeedbacks[a.id] || [];
      const bFeedbacks = routeFeedbacks[b.id] || [];

      switch (sortBy) {
        case 'gradeAsc':
          const aGradeAsc = parseInt((a.grade || 'V0').replace('V', ''));
          const bGradeAsc = parseInt((b.grade || 'V0').replace('V', ''));
          return aGradeAsc - bGradeAsc;
        
        case 'gradeDesc':
          const aGradeDesc = parseInt((a.grade || 'V0').replace('V', ''));
          const bGradeDesc = parseInt((b.grade || 'V0').replace('V', ''));
          return bGradeDesc - aGradeDesc;
        
        case 'color':
          return (a.color || '').localeCompare(b.color || '');
        
        case 'ratingAsc':
          const aAvgRatingAsc = aFeedbacks.length > 0 ? 
            aFeedbacks.reduce((sum, f) => sum + (f.starRating || 0), 0) / aFeedbacks.length : 0;
          const bAvgRatingAsc = bFeedbacks.length > 0 ? 
            bFeedbacks.reduce((sum, f) => sum + (f.starRating || 0), 0) / bFeedbacks.length : 0;
          return aAvgRatingAsc - bAvgRatingAsc;
        
        case 'ratingDesc':
          const aAvgRatingDesc = aFeedbacks.length > 0 ? 
            aFeedbacks.reduce((sum, f) => sum + (f.starRating || 0), 0) / aFeedbacks.length : 0;
          const bAvgRatingDesc = bFeedbacks.length > 0 ? 
            bFeedbacks.reduce((sum, f) => sum + (f.starRating || 0), 0) / bFeedbacks.length : 0;
          return bAvgRatingDesc - aAvgRatingDesc;
        
        case 'completions':
          const aCompletions = aFeedbacks.filter(f => f && f.closedRoute).length;
          const bCompletions = bFeedbacks.filter(f => f && f.closedRoute).length;
          return bCompletions - aCompletions;
        
        case 'createdAt':
          const aDate = new Date(a.createdAt || 0);
          const bDate = new Date(b.createdAt || 0);
          return bDate - aDate;
        
        default:
          return 0;
      }
    });

    return filteredRoutes || [];
  }, [visibleRoutes, filters, sortBy, routeFeedbacks]);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  const handleApplySort = (newSortBy) => {
    setSortBy(newSortBy);
  };

  // פונקציות עריכה
  const handleRouteSelect = (route) => {
    setEditingRoute(route);
    setIsMovingRoute(false);
  };

  // פונקציית בחירת מסלול לצפייה עם פידבק או לעריכה
  const handleRouteView = (route) => {
    if (isAdmin && isEditMode) {
      // במצב עריכה - בחר מסלול לעריכה
      setEditingRoute(route);
      setIsMovingRoute(false);
      setViewingRoute(null); // צא ממצב צפייה
    } else {
      // במצב רגיל - צפה במסלול
      setViewingRoute(route);
    }
  };

  const handleStartMove = () => {
    setIsMovingRoute(true);
  };

  const handleStopMove = () => {
    setIsMovingRoute(false);
  };

  const handleMoveRoute = async (routeId, newX, newY) => {
    try {
      await updateRoute(routeId, { x: newX, y: newY });
      setIsMovingRoute(false);
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בהזזת המסלול');
    }
  };

  const handleDeleteRoute = async (routeId) => {
    try {
      await deleteRoute(routeId);
      setEditingRoute(null);
      setIsMovingRoute(false);
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל במחיקת המסלול');
    }
  };

  const handleCloseEdit = () => {
    setEditingRoute(null);
    setIsMovingRoute(false);
  };

  const handleCloseView = () => {
    setViewingRoute(null);
  };

  // Create styles based on current theme
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* כרטיס מודרני למפה */}
        <View style={styles.mapCard}>
          <View style={styles.mapCardShadow} />
          <View style={styles.mapCardInner}>
            <WallMap
              sharedScale={setCurrentScale}
              sharedTranslateX={setTranslateX}
              sharedTranslateY={setTranslateY}
              onRoutesUpdate={setAllRoutes}
              filteredRoutes={viewingRoute ? [viewingRoute] : filteredAndSortedRoutes}
              editingRoute={editingRoute}
              setEditingRoute={setEditingRoute}
              isMovingRoute={isMovingRoute}
              setIsMovingRoute={setIsMovingRoute}
              hideZoomBar={!!viewingRoute}
              onRoutePress={handleRouteView}
              onEditModeChange={setIsEditMode}
            />
          </View>
        </View>

        {/* כפתורי סינון ומיון - עיצוב עגול עם אייקונים, בין המפה לרשימה */}
        {!viewingRoute && !editingRoute && (
          <View style={styles.filterSortContainer}>
            <TouchableOpacity
              style={[styles.roundButton, (filters.grades && filters.grades.length > 0) || (filters.status && filters.status !== 'all') ? styles.activeFilter : null]}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setFilterButtonPosition({ x, y, width, height });
              }}
              onPress={() => {
                setModalActiveTab('filter');
                setShowFilterModal(true);
              }}
            >
              <Text style={styles.roundButtonText}>🔍 סינון</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.roundButton}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setSortButtonPosition({ x, y, width, height });
              }}
              onPress={() => {
                setModalActiveTab('sort');
                setShowFilterModal(true);
              }}
            >
              <Text style={styles.roundButtonText}>⚡ מיון</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* RouteFeedbackView כ-overlay */}
        {viewingRoute && (
          <View style={styles.feedbackOverlay}>
            <RouteFeedbackView
              route={viewingRoute}
              onClose={handleCloseView}
              isAdmin={isAdmin}
            />
          </View>
        )}

        {/* אם אין viewing route - הצג פאנל עריכה או רשימה */}
        {!viewingRoute && (
          editingRoute ? (
            <View style={styles.editPanelContainer}>
              <RouteEditPanel
                route={editingRoute}
                isMovingRoute={isMovingRoute}
                onStartMove={handleStartMove}
                onStopMove={handleStopMove}
                onDelete={() => handleDeleteRoute(editingRoute.id)}
                onClose={handleCloseEdit}
              />
            </View>
          ) : (
            // הרשימה הרגילה כאשר אין מסלול נבחר
            <View style={styles.scrollContainer}>
              <RouteList 
                routes={filteredAndSortedRoutes} 
                refreshing={refreshing}
                onRefresh={onRefresh}
                onRouteSelect={handleRouteView}
                isEditMode={isEditMode}
                editingRoute={editingRoute}
              />
            </View>
          )
        )}
      </View>

      <FilterSortModal
        visible={showFilterModal}
        buttonPos={modalActiveTab === 'filter' ? filterButtonPosition : sortButtonPosition}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onFiltersChange={handleApplyFilters}
        sortBy={sortBy}
        onSortChange={handleApplySort}
        initialActiveTab={modalActiveTab}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  mapCard: {
    width: '98%',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 24,
    overflow: 'visible',
    backgroundColor: theme.background,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  mapCardShadow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 24,
    backgroundColor: theme.shadow,
    opacity: 0.08,
    zIndex: 0,
  },
  mapCardInner: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#01467D',
    zIndex: 1,
    padding: 8,
  },
  roundButton: {
    backgroundColor: theme.primary,
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  roundButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginLeft: 4,
  },
  container: {
    flex: 1,
    backgroundColor: theme.mapBackground,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  mapContainer: {
    flex: 1,
    width: '100%',
  },
  feedbackOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0, // Allow full height expansion
    backgroundColor: theme.overlay, // Slight overlay background
    zIndex: 1000,
  },
  editPanelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: theme.surface,
    zIndex: 1000,
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    textAlign: 'center',
    color: theme.text,
  },
  editModeTitle: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  editPanel: {
    width: '100%',
    backgroundColor: theme.surface,
    padding: 15,
    borderTopWidth: 2,
    borderTopColor: theme.primary,
    elevation: 5,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'right',
    marginBottom: 15,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  editActionButton: {
    backgroundColor: theme.card,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 100,
  },
  editActionButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  deleteButton: {
    backgroundColor: theme.error,
    borderColor: theme.error,
  },
  cancelButton: {
    backgroundColor: theme.textSecondary,
    borderColor: theme.textSecondary,
  },
  editActionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'right',
  },
  editActionButtonTextActive: {
    color: '#fff',
  },
  deleteButtonText: {
    color: '#fff',
  },
  cancelButtonText: {
    color: '#fff',
  },
  filterSortContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 4,
    marginBottom: 2,
    backgroundColor: 'transparent',
    gap: 8,
  },
  filterButton: {
    backgroundColor: theme.buttonSecondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 18,
    marginHorizontal: 6,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  sortButton: {
    backgroundColor: theme.buttonTertiary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 18,
    marginHorizontal: 6,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  activeFilter: {
    backgroundColor: theme.error,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});