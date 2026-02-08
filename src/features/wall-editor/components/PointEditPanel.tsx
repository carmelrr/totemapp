// PointEditPanel - Panel for editing selected point coordinates

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { Point, Selection } from '../types';

interface PointEditPanelProps {
  /** Current selection */
  selection: Selection;
  /** The point coordinates */
  point: Point | null;
  /** Callback when point position changes */
  onPositionChange: (newPosition: Point) => void;
  /** Callback to delete the selected item */
  onDelete?: () => void;
  /** Label for the point (e.g., "נקודה 3") */
  label?: string;
}

export default function PointEditPanel({
  selection,
  point,
  onPositionChange,
  onDelete,
  label = 'נקודה נבחרת',
}: PointEditPanelProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  // Local state for input values
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  
  // Sync local state with point prop
  useEffect(() => {
    if (point) {
      setXInput(Math.round(point.x).toString());
      setYInput(Math.round(point.y).toString());
    }
  }, [point]);
  
  // Don't render if no point selected
  if (selection.type !== 'point' || !point) {
    return null;
  }
  
  const handleXChange = (text: string) => {
    setXInput(text);
    const value = parseFloat(text);
    if (!isNaN(value)) {
      onPositionChange({ x: value, y: point.y });
    }
  };
  
  const handleYChange = (text: string) => {
    setYInput(text);
    const value = parseFloat(text);
    if (!isNaN(value)) {
      onPositionChange({ x: point.x, y: value });
    }
  };
  
  const handleNudge = (dx: number, dy: number) => {
    onPositionChange({
      x: point.x + dx,
      y: point.y + dy,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="locate" size={16} color={theme.primary} />
          <Text style={styles.headerTitle}>{label}</Text>
        </View>
        {onDelete && (
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Coordinate inputs */}
      <View style={styles.coordsRow}>
        <View style={styles.coordInput}>
          <Text style={styles.coordLabel}>X</Text>
          <TextInput
            style={styles.input}
            value={xInput}
            onChangeText={handleXChange}
            keyboardType="numeric"
            selectTextOnFocus
          />
        </View>
        
        <View style={styles.coordInput}>
          <Text style={styles.coordLabel}>Y</Text>
          <TextInput
            style={styles.input}
            value={yInput}
            onChangeText={handleYChange}
            keyboardType="numeric"
            selectTextOnFocus
          />
        </View>
      </View>
      
      {/* Nudge controls */}
      <View style={styles.nudgeContainer}>
        <Text style={styles.nudgeLabel}>הזז:</Text>
        <View style={styles.nudgeButtons}>
          {/* Direction pad */}
          <View style={styles.nudgePad}>
            {/* Top row */}
            <View style={styles.nudgeRow}>
              <View style={styles.nudgeSpacer} />
              <TouchableOpacity 
                style={styles.nudgeButton}
                onPress={() => handleNudge(0, -1)}
              >
                <Ionicons name="chevron-up" size={14} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.nudgeSpacer} />
            </View>
            
            {/* Middle row */}
            <View style={styles.nudgeRow}>
              <TouchableOpacity 
                style={styles.nudgeButton}
                onPress={() => handleNudge(-1, 0)}
              >
                <Ionicons name="chevron-back" size={14} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.nudgeCenter}>
                <Text style={styles.nudgeCenterText}>1</Text>
              </View>
              <TouchableOpacity 
                style={styles.nudgeButton}
                onPress={() => handleNudge(1, 0)}
              >
                <Ionicons name="chevron-forward" size={14} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            {/* Bottom row */}
            <View style={styles.nudgeRow}>
              <View style={styles.nudgeSpacer} />
              <TouchableOpacity 
                style={styles.nudgeButton}
                onPress={() => handleNudge(0, 1)}
              >
                <Ionicons name="chevron-down" size={14} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.nudgeSpacer} />
            </View>
          </View>
          
          {/* Quick nudge amounts */}
          <View style={styles.quickNudge}>
            {[5, 10, 50].map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.quickNudgeButton}
                onPress={() => handleNudge(amount, 0)}
                onLongPress={() => handleNudge(-amount, 0)}
              >
                <Text style={styles.quickNudgeText}>±{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    deleteButton: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    coordsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    coordInput: {
      flex: 1,
    },
    coordLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 4,
      fontWeight: '600',
    },
    input: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.text,
      textAlign: 'center',
      fontWeight: '600',
    },
    nudgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    nudgeLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    nudgeButtons: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    nudgePad: {
      alignItems: 'center',
    },
    nudgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    nudgeSpacer: {
      width: 28,
      height: 28,
    },
    nudgeButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nudgeCenter: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nudgeCenterText: {
      fontSize: 10,
      color: theme.textSecondary,
    },
    quickNudge: {
      flexDirection: 'row',
      gap: 6,
    },
    quickNudgeButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickNudgeText: {
      fontSize: 11,
      color: theme.text,
      fontWeight: '500',
    },
  });
