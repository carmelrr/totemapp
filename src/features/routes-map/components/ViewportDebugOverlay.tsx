import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ViewportBounds } from '../types/route';

interface ViewportDebugOverlayProps {
  visible: boolean;
  bounds: ViewportBounds;
  screenWidth: number;
  screenHeight: number;
  imageWidth: number;
  imageHeight: number;
  visibleRoutesCount: number;
}

export default function ViewportDebugOverlay({
  visible,
  bounds,
  screenWidth,
  screenHeight,
  imageWidth,
  imageHeight,
  visibleRoutesCount,
}: ViewportDebugOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.debugPanel}>
        <Text style={styles.title}>Debug Info</Text>
        
        <Text style={styles.label}>Screen:</Text>
        <Text style={styles.value}>{screenWidth} × {screenHeight}</Text>
        
        <Text style={styles.label}>Image:</Text>
        <Text style={styles.value}>{imageWidth} × {imageHeight}</Text>
        
        <Text style={styles.label}>Viewport Bounds (img coords):</Text>
        <Text style={styles.value}>
          X: {bounds.xMinImg.toFixed(1)} - {bounds.xMaxImg.toFixed(1)}
        </Text>
        <Text style={styles.value}>
          Y: {bounds.yMinImg.toFixed(1)} - {bounds.yMaxImg.toFixed(1)}
        </Text>
        
        <Text style={styles.label}>Visible Routes:</Text>
        <Text style={styles.value}>{visibleRoutesCount}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 12,
    maxWidth: 200,
  },
  debugPanel: {
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fbbf24',
    marginTop: 4,
  },
  value: {
    fontSize: 10,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
});
