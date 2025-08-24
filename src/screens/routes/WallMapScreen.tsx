import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WallMap from "@/components/map/WallMap";
import FilterSortBar from "@/components/routes/FilterSortBar";
import RoutesList from "@/components/routes/RoutesList";
import PlusFAB from "@/components/routes/PlusFAB";
import { useVisibleRoutes } from "@/hooks/useVisibleRoutes";
import { THEME_COLORS } from "@/constants/colors";

interface Route {
  id: string;
  name: string;
  grade?: string;
  x: number;
  y: number;
  [key: string]: any;
}

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

/**
 * מסך הראשי: קומפוזיציה של המפה + Toolbar + רשימה
 */
const WallMapScreen: React.FC<WallMapScreenProps> = ({ route, navigation }) => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // מצב טרנספורם לחישוב viewport
  const [transformState, setTransformState] = useState({
    scale: 1,
    tx: 0,
    ty: 0,
  });

  // מידות המפה (יתעדכנו כשהמפה תיטען)
  const [mapDimensions, setMapDimensions] = useState({
    viewW: 100,
    viewH: 100,
  });

  // חישוב מסלולים נראים עם throttling
  const visibleRoutes = useVisibleRoutes(
    routes,
    transformState,
    mapDimensions,
    { imgW: WALL_WIDTH, imgH: WALL_HEIGHT },
    100 // throttle 100ms
  );

  // טעינת מסלולים
  const loadRoutes = useCallback(async () => {
    try {
      setRefreshing(true);
      // TODO: טען מסלולים מהמסד נתונים
      // const routesData = await routesService.getRoutes(route.params?.wallId);
      // setRoutes(routesData);

      // דמה לבדיקה
      const mockRoutes = Array.from({ length: 50 }, (_, i) => ({
        id: `route-${i}`,
        name: `מסלול ${i + 1}`,
        grade: `5.${7 + (i % 6)}`,
        x: Math.random() * WALL_WIDTH,
        y: Math.random() * WALL_HEIGHT,
        color: '#ff6b6b',
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

  // עדכון מצב טרנספורם עם throttling
  const handleTransformChange = useCallback((scale: number, tx: number, ty: number) => {
    setTransformState({ scale, tx, ty });
  }, []);

  // עדכון מידות המפה
  const handleMapLayout = useCallback((viewW: number, viewH: number) => {
    setMapDimensions({ viewW, viewH });
  }, []);

  // טיפול בלחיצה על מסלול
  const handleRoutePress = useCallback((selectedRoute: any) => {
    setSelectedRouteId(selectedRoute.id);
    // TODO: פתח דיאלוג או נווט לפרטי המסלול
    console.log('Route selected:', selectedRoute);
  }, []);

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
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* המפה */}
      <View style={styles.mapContainer}>
        <WallMap
          wallWidth={WALL_WIDTH}
          wallHeight={WALL_HEIGHT}
          routes={routes}
          onTransformChange={handleTransformChange}
          onRoutePress={handleRoutePress}
          onLayout={handleMapLayout}
        />
      </View>

      {/* Toolbar */}
      <FilterSortBar
        onFilterPress={handleFilterPress}
        onSortPress={handleSortPress}
      />

      {/* רשימת מסלולים */}
      <View style={styles.listContainer}>
        <RoutesList
          routes={visibleRoutes}
          refreshing={refreshing}
          onRefresh={loadRoutes}
          onRoutePress={handleRoutePress}
          selectedRouteId={selectedRouteId}
        />
      </View>

      {/* כפתור פלוס (רק לאדמין) */}
      <PlusFAB onPress={handleAddRoute} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  mapContainer: {
    flex: 2,
    minHeight: 200,
  },
  listContainer: {
    flex: 1,
    minHeight: 150,
  },
});

export default WallMapScreen;
