import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale?: any; // Remove SharedValue to avoid render issues
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  scale,
}: MapControlsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.controlsGroup}>
        <TouchableOpacity style={styles.button} onPress={onZoomIn} activeOpacity={0.7}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={onZoomOut} activeOpacity={0.7}>
          <Text style={styles.buttonText}>−</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.resetButton} onPress={onReset} activeOpacity={0.7}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
  },
  controlsGroup: {
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 4,
    shadowColor: theme.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});
