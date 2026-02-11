import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, useWindowDimensions, TouchableOpacity, Text, Modal, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import InteractiveImage from "@/components/map/InteractiveImage";
import FilterSortBar from "@/components/routes/FilterSortBar";
import RoutesList from "@/components/routes/RoutesList";
import PlusFAB from "@/components/routes/PlusFAB";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { usePublishedRooms } from "@/features/wall-editor";
import { DynamicWallMap } from "@/features/wall-editor/components";

interface Route {
  id: string;
  name: string;
  grade?: string;
  x: number;
  y: number;
  color: string; // Ensure color field is required
  // Support normalized coordinates (0-1) or pixel coordinates
  isNormalized?: boolean;
  [key: string]: any;
}

interface ViewportRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Utility functions for viewport calculations
const clamp = (value: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, value));

const toImageCoords = (
  screenX: number, 
  screenY: number, 
  scale: number, 
  translateX: number, 
  translateY: number,
  imageW: number,
  imageH: number
): { x: number; y: number } => {
  // Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
  // To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
  const imgCenterX = imageW / 2;
  const imgCenterY = imageH / 2;
  return {
    x: (screenX - imgCenterX - translateX) / scale + imgCenterX,
    y: (screenY - imgCenterY - translateY) / scale + imgCenterY,
  };
};

const calculateVisibleRect = (
  scale: number,
  translateX: number,
  translateY: number,
  viewportW: number,
  viewportH: number,
  imageW: number,
  imageH: number
): ViewportRect => {
  const { x: x0, y: y0 } = toImageCoords(0, 0, scale, translateX, translateY, imageW, imageH);
  const { x: x1, y: y1 } = toImageCoords(viewportW, viewportH, scale, translateX, translateY, imageW, imageH);
  
  return {
    x0: clamp(x0, 0, imageW),
    y0: clamp(y0, 0, imageH),
    x1: clamp(x1, 0, imageW),
    y1: clamp(y1, 0, imageH),
  };
};

interface WallMapScreenProps {
  route: {
    params?: {
      wallId?: string;
    };
  };
  navigation: any;
}

// מידות הקיר (יש להתאים לפי הקיר האמיתי)
const WALL_WIDTH = 1000;
const WALL_HEIGHT = 600;

// קבועים למסגרת
const BORDER = 3;
const OUTER_RADIUS = 20;

/**
 * מסך הראשי: קומפוזיציה של המפה + Toolbar + רשימה
 * תומך ב-Portrait ו-Landscape עם layout אדפטיבי
 */
const WallMapScreen: React.FC<WallMapScreenProps> = ({ route, navigation }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  
  // Map selection state
  const [selectedMapId, setSelectedMapId] = useState<string>('legacy'); // 'legacy' for SVG map
  const [showMapSelector, setShowMapSelector] = useState(false);
  
  // Load published rooms from Firebase
  const { rooms: publishedRooms, isLoading: isLoadingRooms } = usePublishedRooms({});
  
  // Get selected room (if not legacy)
  const selectedRoom = useMemo(() => {
    if (selectedMapId === 'legacy') return null;
    return publishedRooms.find(r => r.id === selectedMapId) || null;
  }, [selectedMapId, publishedRooms]);
  
  // Responsive layout - automatically updates on rotation
  const layout = useResponsiveLayout();
  const { width: screenWidth, height: screenHeight, isLandscape, isTablet, mapLayoutMode, scaleFactor } = layout;
  const insets = useSafeAreaInsets();

  // חישוב מידות המסגרת בהתאם לאספקט רטיו של הקיר ולאוריינטציה
  const wallAspectRatio = WALL_HEIGHT / WALL_WIDTH;
  
  // בlandscape, נשתמש בגובה המסך פחות שוליים; בportrait, נשתמש ברוחב
  const availableWidth = isLandscape 
    ? (screenWidth * 0.6) - 32 // 60% of width for map in landscape
    : screenWidth - 32;
  const availableHeight = isLandscape 
    ? screenHeight - insets.top - insets.bottom - 80 // Leave space for safe area
    : undefined;
  
  // חישוב מידות המסגרת
  let frameWidth = availableWidth;
  let frameHeight = frameWidth * wallAspectRatio;
  
  // בlandscape, אם הגובה חורג מהמקום הזמין, נתאים לפי גובה
  if (isLandscape && availableHeight && frameHeight > availableHeight) {
    frameHeight = availableHeight;
    frameWidth = frameHeight / wallAspectRatio;
  }

  // Create responsive styles with theme support
  const styles = useMemo(() => createStyles(layout, frameHeight, insets, theme), [layout, frameHeight, insets, theme]);

  // מידות המסגרת (יתעדכנו מ-InteractiveImage)
  const [mapFrameDimensions, setMapFrameDimensions] = useState({
    width: frameWidth,
    height: frameHeight,
  });

  // Convert route coordinates to pixels if needed
  const getRoutePixels = useCallback((route: Route): { x: number; y: number } => {
    if (route.isNormalized || (route.x <= 1 && route.y <= 1)) {
      // Normalized coordinates [0-1]
      return {
        x: route.x * WALL_WIDTH,
        y: route.y * WALL_HEIGHT,
      };
    }
    // Already in pixels
    return { x: route.x, y: route.y };
  }, []);

  // טעינת מסלולים
  const loadRoutes = useCallback(async () => {
    try {
      setRefreshing(true);
      // TODO: טען מסלולים מהמסד נתונים
      // const routesData = await routesService.getRoutes(route.params?.wallId);
      // setRoutes(routesData);

      // דמה לבדיקה - וודא שלכל מסלול יש צבע
      const mockRoutes = Array.from({ length: 50 }, (_, i) => ({
        id: `route-${i}`,
        name: `מסלול ${i + 1}`,
        grade: `5.${7 + (i % 6)}`,
        x: Math.random() * WALL_WIDTH,
        y: Math.random() * WALL_HEIGHT,
        color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'][i % 8], // Variety of colors
        difficulty: i % 10,
      }));
      setRoutes(mockRoutes);
    } catch (error) {
      console.error('Error loading routes:', error);
      Alert.alert(t.common.error, t.map.failedToLoadRoutes);
    } finally {
      setRefreshing(false);
    }
  }, [route.params?.wallId]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // טיפול בעדכון מידות המסגרת
  const handleMapFrameLayout = useCallback((width: number, height: number) => {
    setMapFrameDimensions({ width, height });
    console.log('[WallMap] frame layout', { width, height });
  }, []);

  // טיפול בשינוי טרנספורם (אופציונלי - לעתיד)
  const handleTransformChange = useCallback((scale: number, tx: number, ty: number) => {
    // כאן אפשר להוסיף לוגיקה לעדכון viewport אם צריך
    
    // Calculate the content area and whether it's out of bounds
    // This is a mirror of the logic in InteractiveImage but for logging/debugging
    const fw = mapFrameDimensions.width;
    const fh = mapFrameDimensions.height;
    
    // המידות הנכונות של התוכן, לפי יחס של התמונה
    const imageAR = WALL_HEIGHT / WALL_WIDTH;
    const frameAR = fw / fh;
    
    let cw, ch;
    if (imageAR > frameAR) {
      cw = fw;
      ch = fw / imageAR;
    } else {
      ch = fh;
      cw = fh * imageAR;
    }
    
    // גודל התמונה המוגדלת
    const scaledW = cw * scale;
    const scaledH = ch * scale;
    
    // חישוב גבולות (לצורכי לוגים בלבד)
    const minX = Math.min(0, fw - scaledW);
    const maxX = Math.max(0, fw - scaledW) / 2;
    const minY = Math.min(0, fh - scaledH);
    const maxY = Math.max(0, fh - scaledH) / 2;
    
    // בדיקה אם אנחנו מחוץ לגבולות
    const outOfBoundsX = tx < minX || tx > maxX;
    const outOfBoundsY = ty < minY || ty > maxY;
    
    console.log('[WallMap] transform detail', { 
      scale, 
      tx, 
      ty, 
      frame: { width: fw, height: fh },
      content: { width: cw, height: ch },
      scaledContent: { width: scaledW, height: scaledH },
      bounds: { minX, maxX, minY, maxY },
      outOfBounds: { x: outOfBoundsX, y: outOfBoundsY }
    });
  }, [mapFrameDimensions]);

  // טיפול בלחיצה על מסלול
  const handleRoutePress = useCallback((selectedRoute: any) => {
    setSelectedRouteId(selectedRoute.id);
    
    // Convert route to the expected format for RouteDetailsScreen
    const routeForDetails = {
      id: selectedRoute.id,
      name: selectedRoute.name,
      number: selectedRoute.id.replace('route-', ''), // Extract number from ID
      color: selectedRoute.color,
      difficulty: selectedRoute.grade, // Use grade as difficulty
      grade: selectedRoute.grade,
      description: `מסלול ${selectedRoute.name} ברמת קושי ${selectedRoute.grade}`,
      coordinates: {
        x: selectedRoute.x,
        y: selectedRoute.y,
      },
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      wallId: route.params?.wallId || 'default-wall',
    };
    
    // Navigate to route details screen
    navigation.navigate('RouteDetails', { route: routeForDetails });
  }, [navigation, route.params?.wallId]);

  // טיפול בכפתור הפלוס (רק לאדמין)
  const handleAddRoute = useCallback(() => {
    // TODO: נווט למסך הוספת מסלול
    navigation.navigate('AddRoute', { wallId: route.params?.wallId });
  }, [navigation, route.params?.wallId]);

  // טיפול בסינון
  const handleFilterPress = useCallback(() => {
    // TODO: פתח דיאלוג סינון
    Alert.alert(t.common.filter, t.map.filterDialogPlaceholder);
  }, [t]);

  // טיפול במיון
  const handleSortPress = useCallback(() => {
    // TODO: פתח דיאלוג מיון
    Alert.alert(t.common.sort, t.map.sortDialogPlaceholder);
  }, [t]);

  // Get current map name for display
  const currentMapName = useMemo(() => {
    if (selectedMapId === 'legacy') return 'קיר ראשי (ישן)';
    return selectedRoom?.name || 'בחר מפה';
  }, [selectedMapId, selectedRoom]);

  // Render map selector header
  const renderMapHeader = () => (
    <View style={styles.mapHeader}>
      <TouchableOpacity
        style={styles.mapSelectorButton}
        onPress={() => setShowMapSelector(true)}
      >
        <Ionicons name="map" size={18} color={theme.primary} />
        <Text style={styles.mapSelectorText} numberOfLines={1}>
          {currentMapName}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  // Render map selector modal
  const renderMapSelectorModal = () => (
    <Modal
      visible={showMapSelector}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMapSelector(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowMapSelector(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>בחר מפה</Text>
            <TouchableOpacity onPress={() => setShowMapSelector(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.mapList}>
            {/* Legacy SVG Map */}
            <TouchableOpacity
              style={[
                styles.mapOption,
                selectedMapId === 'legacy' && styles.mapOptionSelected,
              ]}
              onPress={() => {
                setSelectedMapId('legacy');
                setShowMapSelector(false);
              }}
            >
              <View style={styles.mapOptionContent}>
                <Ionicons 
                  name="image" 
                  size={24} 
                  color={selectedMapId === 'legacy' ? theme.primary : theme.textSecondary} 
                />
                <View style={styles.mapOptionTextContainer}>
                  <Text style={[
                    styles.mapOptionName,
                    selectedMapId === 'legacy' && styles.mapOptionNameSelected,
                  ]}>
                    קיר ראשי (ישן)
                  </Text>
                  <Text style={styles.mapOptionSubtext}>המפה המקורית</Text>
                </View>
              </View>
              {selectedMapId === 'legacy' && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
            
            {/* Published rooms from editor */}
            {publishedRooms.map(room => (
              <TouchableOpacity
                key={room.id}
                style={[
                  styles.mapOption,
                  selectedMapId === room.id && styles.mapOptionSelected,
                ]}
                onPress={() => {
                  setSelectedMapId(room.id);
                  setShowMapSelector(false);
                }}
              >
                <View style={styles.mapOptionContent}>
                  <Ionicons 
                    name="cube" 
                    size={24} 
                    color={selectedMapId === room.id ? theme.primary : theme.textSecondary} 
                  />
                  <View style={styles.mapOptionTextContainer}>
                    <Text style={[
                      styles.mapOptionName,
                      selectedMapId === room.id && styles.mapOptionNameSelected,
                    ]}>
                      {room.name}
                    </Text>
                    <Text style={styles.mapOptionSubtext}>
                      {room.width}x{room.height} • עורך קירות
                    </Text>
                  </View>
                </View>
                {selectedMapId === room.id && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
            
            {publishedRooms.length === 0 && !isLoadingRooms && (
              <View style={styles.emptyMapsMessage}>
                <Text style={styles.emptyMapsText}>
                  אין מפות מפורסמות מעורך הקירות
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Render the map section
  const renderMapSection = () => {
    // Determine dimensions based on selected map
    const mapWidth = selectedRoom?.width || WALL_WIDTH;
    const mapHeight = selectedRoom?.height || WALL_HEIGHT;
    
    return (
      <View style={styles.mapFrame}>
        {/* שכבת קליפ שמבטיחה קליפינג אמיתי וגם משאירה את הגבול נראה */}
        <View
          style={styles.mapClip}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            handleMapFrameLayout(width, height);
            console.log("[WallMap] mapClip layout", { width, height, isLandscape });
          }}
        >
          {selectedRoom ? (
            // Dynamic map from wall editor
            <InteractiveImage
              imageNaturalSize={{ width: mapWidth, height: mapHeight }}
              minScale={1}
              maxScale={4}
              debug={true}
              onTransformChange={handleTransformChange}
            >
              <DynamicWallMap
                room={selectedRoom}
                width={mapFrameDimensions.width}
                height={mapFrameDimensions.height}
              />
              
              {/* שכבת המסלולים */}
              {routes.map((routeItem) => {
                const { x, y } = getRoutePixels(routeItem);
                const relativeX = x / mapWidth;
                const relativeY = y / mapHeight;
                
                return (
                  <TouchableOpacity
                    key={routeItem.id}
                    style={{
                      position: 'absolute',
                      left: relativeX * mapFrameDimensions.width - 15,
                      top: relativeY * mapFrameDimensions.height - 15,
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: routeItem.color || '#ff6b6b',
                      borderWidth: selectedRouteId === routeItem.id ? 3 : 2,
                      borderColor: selectedRouteId === routeItem.id ? '#ffffff' : 'rgba(255,255,255,0.9)',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => handleRoutePress(routeItem)}
                    activeOpacity={0.7}
                  />
                );
              })}
            </InteractiveImage>
          ) : (
            // Loading or no map selected
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>טוען מפה...</Text>
            </View>
          )}
        </View>
        
        {/* Filters Bar positioned at bottom of map frame */}
        <View style={styles.filtersContainer}>
          <FilterSortBar
            onFilterPress={handleFilterPress}
            onSortPress={handleSortPress}
          />
        </View>
      </View>
    );
  };

  // Render the list section
  const renderListSection = () => (
    <View style={styles.listContainer}>
      <RoutesList
        routes={routes}
        refreshing={refreshing}
        onRefresh={loadRoutes}
        onRoutePress={handleRoutePress}
        selectedRouteId={selectedRouteId}
      />
    </View>
  );

  // Portrait layout: vertical stack
  if (!isLandscape) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {renderMapHeader()}
        {renderMapSection()}
        {renderListSection()}
        <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>
          <PlusFAB onPress={handleAddRoute} />
        </View>
        {renderMapSelectorModal()}
      </SafeAreaView>
    );
  }

  // Landscape layout: side by side
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {renderMapHeader()}
      <View style={styles.landscapeContainer}>
        {/* Map Section - Left side */}
        <View style={styles.landscapeMapSection}>
          {renderMapSection()}
        </View>
        
        {/* List Section - Right side */}
        <View style={styles.landscapeListSection}>
          {renderListSection()}
        </View>
      </View>
      
      <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>
        <PlusFAB onPress={handleAddRoute} />
      </View>
      {renderMapSelectorModal()}
    </SafeAreaView>
  );
};

// Dynamic styles factory function with theme support
const createStyles = (
  layout: ReturnType<typeof useResponsiveLayout>,
  frameHeight: number,
  insets: { top: number; bottom: number; left: number; right: number },
  theme: any
) => {
  const { isLandscape, isTablet, scaleFactor, width, height } = layout;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    // Landscape layout container
    landscapeContainer: {
      flex: 1,
      flexDirection: 'row',
    },
    landscapeMapSection: {
      flex: 3,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 12,
    },
    landscapeListSection: {
      flex: 2,
      borderStartWidth: 1,
      borderStartColor: theme.border,
    },
    mapFrame: {
      // Use aspect ratio instead of fixed height for responsive sizing
      aspectRatio: WALL_WIDTH / WALL_HEIGHT,
      width: isLandscape ? '100%' : undefined,
      height: isLandscape ? undefined : frameHeight,
      maxHeight: isLandscape ? height - insets.top - insets.bottom - 32 : undefined,
      marginHorizontal: isLandscape ? 0 : 16,
      marginTop: isLandscape ? 0 : 16,
      marginBottom: isLandscape ? 0 : 16,
      position: 'relative',
      borderWidth: BORDER,
      borderColor: theme.primary,
      borderRadius: Math.round(OUTER_RADIUS * scaleFactor),
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 8,
    },
    mapClip: {
      ...StyleSheet.absoluteFillObject,
      top: BORDER,
      left: BORDER,
      right: BORDER,
      bottom: BORDER,
      borderRadius: Math.round((OUTER_RADIUS - BORDER) * scaleFactor),
      overflow: 'hidden',
      backgroundColor: theme.isDark ? '#000' : '#000',
    },
    mapContainer: {
      flex: 2,
      minHeight: 200,
      position: 'relative',
      overflow: 'hidden',
      direction: 'ltr',
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 12,
      margin: 8,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    filtersContainer: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 16,
      backgroundColor: theme.isDark ? 'rgba(30, 30, 30, 0.96)' : 'rgba(255, 255, 255, 0.96)',
      borderRadius: Math.round(12 * scaleFactor),
      borderWidth: 0.5,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      paddingVertical: 2,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    listContainer: {
      flex: 1,
      minHeight: isLandscape ? undefined : 150,
    },
    fab: {
      position: 'absolute',
      right: 20,
      zIndex: 10,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    // Map header styles
    mapHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    mapSelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapSelectorText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      maxWidth: 200,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    mapList: {
      padding: 8,
    },
    mapOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      marginVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    },
    mapOptionSelected: {
      backgroundColor: theme.isDark ? 'rgba(74, 144, 226, 0.15)' : 'rgba(74, 144, 226, 0.1)',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    mapOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    mapOptionTextContainer: {
      flex: 1,
    },
    mapOptionName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    mapOptionNameSelected: {
      color: theme.primary,
    },
    mapOptionSubtext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    emptyMapsMessage: {
      padding: 20,
      alignItems: 'center',
    },
    emptyMapsText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
  });
};

export default WallMapScreen;
