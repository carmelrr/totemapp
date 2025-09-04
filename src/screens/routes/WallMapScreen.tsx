import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, useWindowDimensions, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import InteractiveImage from "@/components/map/InteractiveImage";
import WallMapSVG from "@/assets/WallMapSVG";
import FilterSortBar from "@/components/routes/FilterSortBar";
import RoutesList from "@/components/routes/RoutesList";
import PlusFAB from "@/components/routes/PlusFAB";
import { THEME_COLORS } from "@/constants/colors";

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
 */
const WallMapScreen: React.FC<WallMapScreenProps> = ({ route, navigation }) => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  
  // Get screen dimensions and safe area insets
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // חישוב מידות המסגרת בהתאם לאספקט רטיו של הקיר
  const wallAspectRatio = WALL_HEIGHT / WALL_WIDTH;
  const frameWidth = screenWidth - 32; // השארת 16px מכל צד למרווח
  const frameHeight = frameWidth * wallAspectRatio;

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
      Alert.alert('שגיאה', 'נכשל בטעינת המסלולים');
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
  }, []);

  // טיפול בשינוי טרנספורם (אופציונלי - לעתיד)
  const handleTransformChange = useCallback((scale: number, tx: number, ty: number) => {
    // כאן אפשר להוסיף לוגיקה לעדכון viewport אם צריך
    console.log('Transform changed:', { scale, tx, ty });
  }, []);

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
      createdAt: new Date(),
      createdBy: 'system',
      wallId: route.params?.wallId || 'default-wall',
    };
    
    // Navigate to route details screen
    navigation.navigate('RouteDetails', { route: routeForDetails });
  }, [navigation, route.params?.wallId]);

  // טיפול בכפתור הפלוס (רק לאדמין)
  const handleAddRoute = useCallback(() => {
    // TODO: נווט למסך הוספת מסלול
    navigation.navigate('AddRouteScreen', { wallId: route.params?.wallId });
  }, [navigation, route.params?.wallId]);

  // טיפול בסינון
  const handleFilterPress = useCallback(() => {
    // TODO: פתח דיאלוג סינון
    Alert.alert('סינון', 'כאן יהיה דיאלוג סינון');
  }, []);

  // טיפול במיון
  const handleSortPress = useCallback(() => {
    // TODO: פתח דיאלוג מיון
    Alert.alert('מיון', 'כאן יהיה דיאלוג מיון');
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Map Frame with Fixed Dimensions - מסגרת קבועה ובולטת */}
      <View style={styles.mapFrame}>
        {/* שכבת קליפ שמבטיחה קליפינג אמיתי וגם משאירה את הגבול נראה */}
        <View
          style={styles.mapClip}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            handleMapFrameLayout(width, height); // ממשיך להשתמש במידות האמיתיות למיקומי העיגולים
          }}
        >
          <InteractiveImage
            imageNaturalSize={{ width: WALL_WIDTH, height: WALL_HEIGHT }}
            minScale={1}
            maxScale={4}
            onTransformChange={handleTransformChange}
          >
            {/* רקע המפה */}
            <WallMapSVG
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
            />
            
            {/* שכבת המסלולים */}
            {routes.map((route) => {
              const { x, y } = getRoutePixels(route);
              // המרה לקואורדינטות יחסיות (0-1) עבור המסגרת
              const relativeX = x / WALL_WIDTH;
              const relativeY = y / WALL_HEIGHT;
              
              return (
                <TouchableOpacity
                  key={route.id}
                  style={{
                    position: 'absolute',
                    left: relativeX * mapFrameDimensions.width - 15, // מרכז העיגול
                    top: relativeY * mapFrameDimensions.height - 15,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: route.color || '#ff6b6b',
                    borderWidth: selectedRouteId === route.id ? 3 : 2,
                    borderColor: selectedRouteId === route.id ? '#ffffff' : 'rgba(255,255,255,0.9)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 6,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={() => handleRoutePress(route)}
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

      {/* Routes List */}
      <View style={styles.listContainer}>
        <RoutesList
          routes={routes} // כל המסלולים
          refreshing={refreshing}
          onRefresh={loadRoutes}
          onRoutePress={handleRoutePress}
          selectedRouteId={selectedRouteId}
        />
      </View>

      {/* FAB positioned with safe area padding */}
      <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>
        <PlusFAB onPress={handleAddRoute} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0', // רקע אפור בהיר כדי לראות את המסגרת
  },
  mapFrame: {
    height: 300,                 // גובה קבוע
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    position: 'relative',

    // מסגרת נראית - שכבה חיצונית
    borderWidth: BORDER,
    borderColor: '#2196F3',
    borderRadius: OUTER_RADIUS,

    // לא עושים כאן overflow:hidden כדי שהגבול יישאר נראה בוודאות
    backgroundColor: '#fff',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  mapClip: {
    ...StyleSheet.absoluteFillObject,
    // נזיז פנימה בדיוק בעובי המסגרת כדי שהגבול לא יכוסה
    top: BORDER,
    left: BORDER,
    right: BORDER,
    bottom: BORDER,

    borderRadius: OUTER_RADIUS - BORDER, // קליפינג עם רדיוס תואם
    overflow: 'hidden',                  // הקליפינג האמיתי
    backgroundColor: '#000',             // יוצר שכבת ציור ברורה לאנדרואיד
  },
  mapContainer: {
    flex: 2,
    minHeight: 200,
    position: 'relative',
    // מסגרת קבועה למפה - כל תוכן המפה יהיה מוגבל בתוך המסגרת הזו
    overflow: 'hidden', // מגביל את תוכן המפה לתוך המסגרת
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    margin: 8,
    // הוספת צל כדי להדגיש את המסגרת
    shadowColor: '#000',
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
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { 
      width: 0, 
      height: 2 
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  listContainer: {
    flex: 1,
    minHeight: 150,
  },
  fab: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    // הוספת צל עדין ל-FAB
    shadowColor: '#000',
    shadowOffset: { 
      width: 0, 
      height: 4 
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default WallMapScreen;
