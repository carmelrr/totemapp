import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFirebaseRoutes } from '../hooks/useFirebaseRoutes';

/**
 * Debug component to display route data information
 * This helps verify the xNorm/yNorm conversion logic
 */
export default function RouteDataDebugger() {
  const { routes, isLoading, error } = useFirebaseRoutes();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔍 Route Data Debugger</Text>
        <Text style={styles.loading}>Loading routes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔍 Route Data Debugger</Text>
        <Text style={styles.error}>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔍 Route Data Debugger</Text>
      <Text style={styles.summary}>Found {routes.length} routes</Text>
      
      {routes.map((route, index) => (
        <View key={route.id} style={styles.routeCard}>
          <Text style={styles.routeName}>
            {index + 1}. {route.name || route.id}
          </Text>
          
          <View style={styles.routeInfo}>
            <Text style={styles.label}>Grade:</Text>
            <Text style={styles.value}>{route.grade}</Text>
          </View>
          
          <View style={styles.routeInfo}>
            <Text style={styles.label}>Color:</Text>
            <View style={[styles.colorSwatch, { backgroundColor: route.color }]} />
            <Text style={styles.value}>{route.color}</Text>
          </View>
          
          <View style={styles.routeInfo}>
            <Text style={styles.label}>Coordinates:</Text>
            <Text style={styles.value}>
              xNorm: {route.xNorm?.toFixed(4)} ({typeof route.xNorm}){'\n'}
              yNorm: {route.yNorm?.toFixed(4)} ({typeof route.yNorm})
            </Text>
          </View>
          
          <View style={styles.routeInfo}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{route.status}</Text>
          </View>
          
          {/* Check for data integrity issues */}
          {(!Number.isFinite(route.xNorm) || !Number.isFinite(route.yNorm)) && (
            <Text style={styles.warning}>⚠️ Invalid coordinates</Text>
          )}
          
          {(route.xNorm < 0 || route.xNorm > 1 || route.yNorm < 0 || route.yNorm > 1) && (
            <Text style={styles.warning}>⚠️ Coordinates out of bounds [0,1]</Text>
          )}
          
          {/* Check if likely converted from absolute coordinates */}
          {(route.xNorm > 0 && route.xNorm < 1 && 
            (route.xNorm * 2560) % 1 === 0) && (
            <Text style={styles.info}>🔄 Likely converted from absolute x coordinate</Text>
          )}
          
          {/* Show calculated image coordinates for common screen size */}
          <View style={styles.imageCoords}>
            <Text style={styles.label}>Image coords (400x250):</Text>
            <Text style={styles.value}>
              x: {(route.xNorm * 400).toFixed(1)}, y: {(route.yNorm * 250).toFixed(1)}
            </Text>
          </View>
          
          {/* Show marker position */}
          <View style={styles.imageCoords}>
            <Text style={styles.label}>Marker position:</Text>
            <Text style={styles.value}>
              left: {(route.xNorm * 400 - 18).toFixed(1)}, top: {(route.yNorm * 250 - 18).toFixed(1)}
            </Text>
          </View>
        </View>
      ))}
      
      {routes.length === 0 && (
        <Text style={styles.noRoutes}>No routes found in database</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  summary: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    color: '#666',
  },
  loading: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
  error: {
    textAlign: 'center',
    fontSize: 16,
    color: '#ff0000',
    marginTop: 50,
  },
  noRoutes: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  routeName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  imageCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    width: 80,
  },
  value: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  warning: {
    fontSize: 12,
    color: '#ff6600',
    fontWeight: 'bold',
    marginTop: 4,
  },
  info: {
    fontSize: 12,
    color: '#0066ff',
    marginTop: 4,
  },
});
