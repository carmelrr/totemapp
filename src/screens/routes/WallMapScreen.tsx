import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, useWindowDimensions, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import InteractiveImage from "@/components/map/InteractiveImage";
import WallMapSVG from "@/assets/WallMapSVG";
import FilterSortBar from "@/components/routes/FilterSortBar";
import RoutesList from "@/components/routes/RoutesList";
import PlusFAB from "@/components/routes/PlusFAB";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

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
  translateY: number
): { x: number; y: number } => ({
  x: (screenX - translateX) / scale,
  y: (screenY - translateY) / scale,
});

const calculateVisibleRect = (
  scale: number,
  translateX: number,
  translateY: number,
  viewportW: number,
  viewportH: number,
  imageW: number,
  imageH: number
): ViewportRect => {
  const { x: x0, y: y0 } = toImageCoords(0, 0, scale, translateX, translateY);
  const { x: x1, y: y1 } = toImageCoords(viewportW, viewportH, scale, translateX, translateY);
  
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

  // Render the map section
  const renderMapSection = () => (
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
        <InteractiveImage
          imageNaturalSize={{ width: WALL_WIDTH, height: WALL_HEIGHT }}
          minScale={1}
          maxScale={4}
          debug={true}
          onTransformChange={handleTransformChange}
        >
          {/* Visual debug border */}
          <View style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            borderWidth: 2,
            borderColor: 'red',
            backgroundColor: 'transparent',
          }} />
          
          {/* רקע המפה */}
          <WallMapSVG
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          />
          
          {/* שכבת המסלולים */}
          {routes.map((routeItem) => {
            const { x, y } = getRoutePixels(routeItem);
            const relativeX = x / WALL_WIDTH;
            const relativeY = y / WALL_HEIGHT;
            
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
        {renderMapSection()}
        {renderListSection()}
        <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>
          <PlusFAB onPress={handleAddRoute} />
        </View>
      </SafeAreaView>
    );
  }

  // Landscape layout: side by side
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
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
      borderLeftWidth: 1,
      borderLeftColor: theme.border,
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
  });
};

export default WallMapScreen;
