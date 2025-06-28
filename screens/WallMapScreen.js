// screens/WallMapScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import WallMap from '../components/WallMap';
import RouteList from '../components/RouteList';
import { subscribeToRoutes } from '../routesService';
import useVisibleRoutes from '../hooks/useVisibleRoutes';

const MAP_WIDTH = 400;
const MAP_HEIGHT = 260;

export default function WallMapScreen() {
  const [allRoutes, setAllRoutes] = useState([]);
  const [currentScale, setCurrentScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToRoutes(setAllRoutes);
    return unsubscribe;
  }, []);

  const visibleRoutes = useVisibleRoutes(
    allRoutes,
    currentScale,
    translateX,
    translateY,
    MAP_WIDTH,
    MAP_HEIGHT
  );

  return (
    <View style={styles.container}>
      <WallMap
        sharedScale={setCurrentScale}
        sharedTranslateX={setTranslateX}
        sharedTranslateY={setTranslateY}
      />
      <Text style={styles.listTitle}>מסלולים בתחום התצוגה:</Text>
      <RouteList routes={visibleRoutes} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
});
