// src/screens/SprayWall/WallDetailScreen.tsx
// Main Spray Wall screen showing the wall with its routes

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useWalls } from "@/features/walls/hooks";
import { useRoutesForWall, useUserCompletedSprayRoutes } from "@/features/spraywall/hooks";
import { WallImageWithHolds } from "@/components/spray/WallImageWithHolds";
import { SprayRoute } from "@/features/spraywall/types";
import { useAdmin } from "@/context/AdminContext";
import { useRolesContext } from "@/features/roles";
import { useLanguage } from "@/features/language";
import { useTheme } from "@/features/theme/ThemeContext";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useRouteNavigationStore } from '@/store/useRouteNavigationStore';
import * as ImagePicker from "expo-image-picker";
import { updateWallImage } from "@/features/walls/wallsService";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// V-Scale grades for sorting
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

type SortOption = 'newest' | 'oldest' | 'popular' | 'easy-to-hard' | 'hard-to-easy' | 'rating' | 'most-repeats';
type CompletionFilter = 'all' | 'completed' | 'not-completed';

export const WallDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAdmin, adminModeEnabled } = useAdmin();
  const { canEditRoutes, isRouteSetter } = useRolesContext();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, width } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  
  // Sort options
  const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
    { key: 'easy-to-hard', label: t.community?.easyToHard || 'קל לקשה', icon: 'trending-up-outline' },
    { key: 'hard-to-easy', label: t.community?.hardToEasy || 'קשה לקל', icon: 'trending-down-outline' },
    { key: 'rating', label: t.spray?.byRating || 'לפי דירוג', icon: 'star-outline' },
    { key: 'popular', label: t.community?.popular || 'פופולרי', icon: 'trophy-outline' },
    { key: 'most-repeats', label: t.common?.mostRepeats || 'הכי חזרות', icon: 'repeat-outline' },
    { key: 'newest', label: t.community?.new || 'חדש', icon: 'time-outline' },
    { key: 'oldest', label: t.community?.oldest || 'ישן', icon: 'calendar-outline' },
  ];
  
  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  
  // Edit mode is enabled when admin mode is on OR route setter has toggled it
  const [routeSetterEditMode, setRouteSetterEditMode] = useState(false);
  const editModeEnabled = adminModeEnabled || (isRouteSetter && routeSetterEditMode);
  const canAccessEditMode = isAdmin || canEditRoutes;

  // Get walls and use the first one (Spray Wall has only one wall)
  const { walls, loading: wallsLoading } = useWalls();
  const wall = walls.length > 0 ? walls[0] : null;
  const wallId = wall?.id;

  const { routes: rawRoutes, loading: routesLoading } = useRoutesForWall(wallId || "");

  const [selectedRoute, setSelectedRoute] = useState<SprayRoute | null>(null);
  const [updatingWall, setUpdatingWall] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Draggable bottom sheet state
  // Image aspect ratio based on actual wall image (adjust as needed)
  const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.52; // List takes about 52% of screen at minimum
  const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.85; // Maximum height (85% of screen)
  const sheetHeight = useRef(new Animated.Value(MIN_SHEET_HEIGHT)).current;
  const lastGestureDy = useRef(0);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical gestures
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        // Get current height value
        sheetHeight.stopAnimation((value) => {
          lastGestureDy.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        // Dragging up = negative dy = increase height
        const newHeight = lastGestureDy.current - gestureState.dy;
        if (newHeight >= MIN_SHEET_HEIGHT && newHeight <= MAX_SHEET_HEIGHT) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentHeight = lastGestureDy.current - gestureState.dy;
        // Snap to min or max based on velocity and position
        let targetHeight = MIN_SHEET_HEIGHT;
        
        if (gestureState.vy < -0.5) {
          // Fast swipe up - expand
          targetHeight = MAX_SHEET_HEIGHT;
        } else if (gestureState.vy > 0.5) {
          // Fast swipe down - collapse
          targetHeight = MIN_SHEET_HEIGHT;
        } else {
          // Based on position - if past 50%, expand
          const midPoint = (MIN_SHEET_HEIGHT + MAX_SHEET_HEIGHT) / 2;
          targetHeight = currentHeight > midPoint ? MAX_SHEET_HEIGHT : MIN_SHEET_HEIGHT;
        }
        
        Animated.spring(sheetHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          friction: 8,
          tension: 50,
        }).start();
      },
    })
  ).current;
  
  // Sort and filter state
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterGrades, setFilterGrades] = useState<string[]>([]);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // User's completed spray routes (from feedbacks collection)
  const { completedRouteIds } = useUserCompletedSprayRoutes();
  
  // Get unique grades from routes
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    rawRoutes.forEach(r => {
      const grade = r.calculatedGrade || r.grade;
      if (grade) grades.add(grade);
    });
    return Array.from(grades).sort((a, b) => V_GRADES.indexOf(a) - V_GRADES.indexOf(b));
  }, [rawRoutes]);
  
  // Apply sort and filter to routes
  const routes = useMemo(() => {
    let filtered = [...rawRoutes];
    
    // Apply completion filter
    if (completionFilter === 'completed') {
      filtered = filtered.filter(r => completedRouteIds.has(r.id));
    } else if (completionFilter === 'not-completed') {
      filtered = filtered.filter(r => !completedRouteIds.has(r.id));
    }
    
    // Apply grade filter
    if (filterGrades.length > 0) {
      filtered = filtered.filter(r => {
        const grade = r.calculatedGrade || r.grade;
        return filterGrades.includes(grade);
      });
    }
    
    // Apply sort
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        break;
      case 'oldest':
        filtered.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        break;
      case 'easy-to-hard':
        filtered.sort((a, b) => {
          const gradeA = V_GRADES.indexOf(a.calculatedGrade || a.grade);
          const gradeB = V_GRADES.indexOf(b.calculatedGrade || b.grade);
          return gradeA - gradeB;
        });
        break;
      case 'hard-to-easy':
        filtered.sort((a, b) => {
          const gradeA = V_GRADES.indexOf(a.calculatedGrade || a.grade);
          const gradeB = V_GRADES.indexOf(b.calculatedGrade || b.grade);
          return gradeB - gradeA;
        });
        break;
      case 'rating':
        filtered.sort((a, b) => (b.averageStarRating || 0) - (a.averageStarRating || 0));
        break;
      case 'popular':
        filtered.sort((a, b) => (b.topsCount || 0) - (a.topsCount || 0));
        break;
      case 'most-repeats':
        filtered.sort((a, b) => (b.topsCount || 0) - (a.topsCount || 0));
        break;
    }
    
    return filtered;
  }, [rawRoutes, sortBy, filterGrades, completionFilter, completedRouteIds]);
  
  const hasActiveFilters = filterGrades.length > 0 || completionFilter !== 'all';
  
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setShowSortModal(false);
  };
  
  const toggleFilterGrade = (grade: string) => {
    setFilterGrades(prev => 
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };
  
  const clearFilters = () => {
    setFilterGrades([]);
    setCompletionFilter('all');
    setShowFilterModal(false);
  };

  const handleAddRoute = useCallback(() => {
    if (!wallId) return;
    navigation.navigate("AddRoute", { wallId });
  }, [wallId, navigation]);

  // Navigate to route details screen - pass only IDs, not entire objects
  const handleRoutePress = useCallback((routeItem: SprayRoute) => {
    // Set route list for swipe navigation
    useRouteNavigationStore.getState().setNavigationList(routes.map(r => r.id!));
    navigation.navigate("SprayRouteDetail", { 
      routeId: routeItem.id!, 
      wallId: wallId!,
    });
  }, [wallId, navigation, routes]);

  // Toggle route preview on long press
  const handleRouteLongPress = useCallback((routeItem: SprayRoute) => {
    setSelectedRoute((prev) => prev?.id === routeItem.id ? null : routeItem);
  }, []);

  // Function to change wall image - available to admins and route setters
  const handleChangeWallImage = async () => {
    if (!isAdmin && !isRouteSetter) return;

    Alert.alert(
      t.spray.changeWallImage,
      t.spray.changeWallWarning,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.common.continue || "Continue",
          style: "destructive",
          onPress: pickNewImage,
        },
      ]
    );
  };

  const pickNewImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUpdatingWall(true);
        await updateWallImage(wallId, result.assets[0].uri, true);
        setSelectedRoute(null);
      }
    } catch (error) {
      console.error("Error updating wall image:", error);
      Alert.alert(t.common.error, t.spray.failedToUpdateWall);
    } finally {
      setUpdatingWall(false);
    }
  };

  const renderRouteItem = useCallback(({ item }: { item: SprayRoute }) => {
    const isSelected = selectedRoute?.id === item.id;
    const displayGrade = item.calculatedGrade || item.grade;
    const averageRating = item.averageStarRating || 0;
    
    // Render stars for rating display (like routes map)
    const renderStars = (rating: number) => {
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        stars.push(
          <Text 
            key={i} 
            style={[
              dynamicStyles.starIcon, 
              i <= rating && dynamicStyles.starFilled
            ]}
          >
            ★
          </Text>
        );
      }
      return stars;
    };
    
    return (
      <TouchableOpacity
        style={[dynamicStyles.routeItem, isSelected && dynamicStyles.routeItemSelected]}
        onPress={() => handleRoutePress(item)}
        onLongPress={() => handleRouteLongPress(item)}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.routeInfo}>
          <Text style={[dynamicStyles.routeName, isSelected && dynamicStyles.routeNameSelected]}>
            {item.name}
          </Text>
          <View style={dynamicStyles.routeMeta}>
            <Text style={dynamicStyles.routeGrade}>{displayGrade}</Text>
            {averageRating > 0 && (
              <View style={dynamicStyles.ratingBadge}>
                <View style={dynamicStyles.starsRow}>
                  {renderStars(Math.round(averageRating))}
                </View>
                <Text style={dynamicStyles.ratingText}>({averageRating.toFixed(1)})</Text>
              </View>
            )}
            {(item.topsCount || 0) > 0 && (
              <Text style={dynamicStyles.topsCount}>🏆 {item.topsCount}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedRoute?.id, dynamicStyles, handleRoutePress, theme]);

  if (wallsLoading) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={dynamicStyles.loadingText}>{t.spray.loading}</Text>
      </SafeAreaView>
    );
  }

  // No wall exists yet - show empty state with option to add wall (admin only)
  if (!wall) {
    return (
      <SafeAreaView style={dynamicStyles.emptyContainer} edges={["top"]}>
        <Text style={dynamicStyles.emptyIcon}>🧗‍♂️</Text>
        <Text style={dynamicStyles.emptyText}>{t.spray.noWallYet}</Text>
        {isAdmin && adminModeEnabled && (
          <TouchableOpacity 
            style={dynamicStyles.addWallButton} 
            onPress={() => navigation.navigate("AddWall")}
          >
            <Text style={dynamicStyles.addWallButtonText}>{t.spray.addWall}</Text>
          </TouchableOpacity>
        )}
        {(!isAdmin || !adminModeEnabled) && (
          <Text style={dynamicStyles.emptySubtext}>{t.spray.onlyAdminCanAddWall}</Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={["top"]}>
      {/* Main Header */}
      <View style={dynamicStyles.mainHeader}>
        <BrandLogo variant="icon" color="white" size={28} />
        <Text style={dynamicStyles.mainHeaderTitle}>{t.spray?.title || 'ספריי וואל'}</Text>
      </View>

      {/* Wall Image with Selected Route's Holds */}
      <View style={dynamicStyles.imageContainer}>
        <WallImageWithHolds
          imageUrl={wall.imageUrl}
          holds={selectedRoute?.holds || []}
          routeColor={selectedRoute?.color || "#FF4444"}
          editable={false}
        />
        {selectedRoute && (
          <View style={dynamicStyles.selectedRouteOverlay}>
            <Text style={dynamicStyles.selectedRouteText}>
              {selectedRoute.name} • {selectedRoute.calculatedGrade || selectedRoute.grade}
            </Text>
            <TouchableOpacity 
              style={dynamicStyles.openRouteButton}
              onPress={() => handleRoutePress(selectedRoute)}
            >
              <Text style={dynamicStyles.openRouteButtonText}>{t.spray.openDetails}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Draggable Routes List */}
      <Animated.View style={[dynamicStyles.routesSection, { height: sheetHeight }]}>
        {/* Drag Handle */}
        <View {...panResponder.panHandlers} style={dynamicStyles.dragHandle}>
          <View style={dynamicStyles.dragIndicator} />
        </View>
        
        <View style={dynamicStyles.routesHeader}>
          <View style={dynamicStyles.routesTitleRow}>
            <BrandLogo variant="icon" color="dark" size={24} />
            <Text style={dynamicStyles.routesTitle}>{t.routes.title} ({routes.length})</Text>
          </View>
          <View style={dynamicStyles.headerButtons}>
            {/* Reset Wall Button - for route setters (always visible) */}
            {isRouteSetter && (
              <TouchableOpacity 
                style={dynamicStyles.resetWallButton}
                onPress={handleChangeWallImage}
                disabled={updatingWall}
              >
                {updatingWall ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={dynamicStyles.resetWallButtonText}>🔄</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={dynamicStyles.addButton} onPress={handleAddRoute}>
              <Text style={dynamicStyles.addButtonText}>+ {t.spray.createRoute}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sort and Filter Buttons */}
        <View style={dynamicStyles.sortFilterContainer}>
          <TouchableOpacity
            style={dynamicStyles.sortFilterButton}
            onPress={() => setShowSortModal(true)}
          >
            <Ionicons name="swap-vertical-outline" size={18} color={theme.primary} />
            <Text style={dynamicStyles.sortFilterButtonText}>{t.community?.sort || 'מיון'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              dynamicStyles.sortFilterButton,
              hasActiveFilters && dynamicStyles.sortFilterButtonActive
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons 
              name={hasActiveFilters ? "funnel" : "funnel-outline"} 
              size={18} 
              color={hasActiveFilters ? theme.primary : theme.textSecondary} 
            />
            <Text style={dynamicStyles.sortFilterButtonText}>{t.community?.filter || 'סינון'}</Text>
            {hasActiveFilters && (
              <View style={dynamicStyles.filterBadge}>
                <Text style={dynamicStyles.filterBadgeText}>{filterGrades.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {routesLoading ? (
          <View style={dynamicStyles.routesLoading}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : routes.length === 0 ? (
          <View style={dynamicStyles.emptyRoutes}>
            <Text style={dynamicStyles.emptyRoutesText}>
              {hasActiveFilters ? (t.spray?.noRoutesWithFilter || 'אין מסלולים בסינון זה') : t.routes.noRoutes}
            </Text>
            {hasActiveFilters ? (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={dynamicStyles.emptyRoutesLink}>{t.community?.clearFilters || 'נקה סינון'} →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleAddRoute}>
                <Text style={dynamicStyles.emptyRoutesLink}>{t.spray.createRoute} →</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={routes}
            keyExtractor={(item) => item.id || item.name}
            renderItem={renderRouteItem}
            contentContainerStyle={dynamicStyles.routesList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity 
          style={dynamicStyles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowSortModal(false)}
        >
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>{t.community?.sort || 'מיון'}</Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  dynamicStyles.modalOption,
                  sortBy === option.key && dynamicStyles.modalOptionSelected
                ]}
                onPress={() => handleSortChange(option.key)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={sortBy === option.key ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    dynamicStyles.modalOptionText,
                    sortBy === option.key && { color: theme.primary },
                  ]}
                >
                  {option.label}
                </Text>
                {sortBy === option.key && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity 
          style={dynamicStyles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowFilterModal(false)}
        >
          <View style={[dynamicStyles.modalContent, { maxHeight: '60%' }]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>{t.community?.filter || 'סינון'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {hasActiveFilters && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={dynamicStyles.clearFilterText}>{t.community?.clearFilters || 'נקה'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Completion Filter */}
              <Text style={dynamicStyles.filterSectionTitle}>{t.filters.completionStatus}</Text>
              <View style={dynamicStyles.completionOptionsRow}>
                <TouchableOpacity
                  style={[
                    dynamicStyles.completionChip,
                    completionFilter === 'all' && dynamicStyles.completionChipSelected
                  ]}
                  onPress={() => setCompletionFilter('all')}
                >
                  <Text style={[
                    dynamicStyles.completionChipText,
                    completionFilter === 'all' && dynamicStyles.completionChipTextSelected
                  ]}>
                    {t.filters.showAll}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    dynamicStyles.completionChip,
                    completionFilter === 'completed' && dynamicStyles.completionChipSelected
                  ]}
                  onPress={() => setCompletionFilter('completed')}
                >
                  <Text style={[
                    dynamicStyles.completionChipText,
                    completionFilter === 'completed' && dynamicStyles.completionChipTextSelected
                  ]}>
                    ✓ {t.filters.showCompleted}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    dynamicStyles.completionChip,
                    completionFilter === 'not-completed' && dynamicStyles.completionChipSelected
                  ]}
                  onPress={() => setCompletionFilter('not-completed')}
                >
                  <Text style={[
                    dynamicStyles.completionChipText,
                    completionFilter === 'not-completed' && dynamicStyles.completionChipTextSelected
                  ]}>
                    {t.filters.showNotCompleted}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Grade Filter */}
              <Text style={[dynamicStyles.filterSectionTitle, { marginTop: 16 }]}>{t.community?.filterByGrade || 'סנן לפי דרגה'}</Text>
              {uniqueGrades.map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[
                    dynamicStyles.modalOption,
                    filterGrades.includes(grade) && dynamicStyles.modalOptionSelected
                  ]}
                  onPress={() => toggleFilterGrade(grade)}
                >
                  <Text style={dynamicStyles.gradeOptionText}>{grade}</Text>
                  {filterGrades.includes(grade) && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              style={dynamicStyles.applyFilterButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={dynamicStyles.applyFilterButtonText}>{t.common?.apply || 'החל'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: any, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number; top: number; bottom: number }) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLandscape = layout?.isLandscape ?? screenWidth > screenHeight;
  const isTablet = layout?.isTablet ?? false;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets?.left ?? 0, insets?.right ?? 0, 16) : 16;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    flexDirection: isLandscape ? 'row' : 'column',
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.headerGradient,
    paddingVertical: isPhoneLandscape ? 8 : 14,
    paddingHorizontal: Math.max(horizontalPadding, 16),
  },
  mainHeaderTitle: {
    fontSize: isPhoneLandscape ? 18 : 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background,
  },
  imageContainer: {
    width: isLandscape ? '60%' : '100%',
    aspectRatio: isLandscape ? undefined : 1.5,
    flex: isLandscape ? 1 : undefined,
    position: "relative",
    backgroundColor: theme.background,
  },
  selectedRouteOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: theme.isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedRouteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  routesSection: {
    position: isLandscape ? 'relative' : "absolute",
    bottom: isLandscape ? undefined : 0,
    left: isLandscape ? undefined : 0,
    right: isLandscape ? undefined : 0,
    width: isLandscape ? '40%' : undefined,
    height: isLandscape ? '100%' : undefined,
    backgroundColor: theme.surface,
    borderTopLeftRadius: isLandscape ? 0 : 24,
    borderTopRightRadius: isLandscape ? 0 : 24,
    paddingTop: 0,
    shadowColor: "#000",
    shadowOffset: { width: isLandscape ? -3 : 0, height: isLandscape ? 0 : -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: isPhoneLandscape ? 8 : 12,
    display: isLandscape ? 'none' : 'flex',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: theme.border,
    borderRadius: 3,
  },
  routesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  routesTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routesTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resetWallButton: {
    backgroundColor: theme.error,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  resetWallButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  addButton: {
    backgroundColor: theme.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  routesList: {
    padding: isPhoneLandscape ? 12 : 16,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: isPhoneLandscape ? 8 : 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  routeItemSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '20',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginEnd: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "500",
  },
  routeNameSelected: {
    color: theme.primary,
  },
  routeGrade: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  holdCount: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  starsRow: {
    flexDirection: "row",
  },
  starIcon: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  starFilled: {
    color: theme.starColor,
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingText: {
    color: theme.starColor,
    fontSize: 12,
    marginStart: 2,
  },
  topsCount: {
    color: theme.success,
    fontSize: 12,
  },
  openRouteButton: {
    marginTop: 8,
    backgroundColor: theme.buttonPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  openRouteButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  changeWallButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeWallButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  editModeButton: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(100,100,100,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editModeButtonActive: {
    backgroundColor: "rgba(142,78,198,0.9)",
  },
  editModeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  routesLoading: {
    padding: 40,
    alignItems: "center",
  },
  emptyRoutes: {
    padding: 40,
    alignItems: "center",
  },
  emptyRoutesText: {
    color: theme.textSecondary,
    fontSize: 16,
    textAlign: "center",
  },
  emptyRoutesLink: {
    color: theme.primary,
    fontSize: 14,
    marginTop: 8,
  },
  // Sort and Filter styles
  sortFilterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  sortFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sortFilterButtonActive: {
    borderColor: theme.primary,
    borderWidth: 2,
  },
  sortFilterButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "500",
  },
  filterBadge: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginStart: 4,
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
  },
  modalOptionSelected: {
    backgroundColor: theme.primary + "20",
  },
  modalOptionText: {
    color: theme.text,
    fontSize: 16,
    flex: 1,
  },
  clearFilterText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  filterSectionTitle: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  gradeOptionText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  applyFilterButton: {
    backgroundColor: theme.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  applyFilterButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
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
  completionChipSelected: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  completionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  completionChipTextSelected: {
    color: '#ffffff',
  },
  // Empty state styles (no wall)
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background,
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  addWallButton: {
    backgroundColor: theme.buttonPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  addWallButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
});
};

export default WallDetailScreen;
