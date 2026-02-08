// OverlayControls - Controls for adjusting the overlay image position, scale, opacity

import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { OverlayImage } from '../types';

interface OverlayControlsProps {
  overlay: OverlayImage;
  onUpdate: (updates: Partial<OverlayImage>) => void;
  onClear: () => void;
  onToggleLock: () => void;
}

export default function OverlayControls({
  overlay,
  onUpdate,
  onClear,
  onToggleLock,
}: OverlayControlsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  // Local state for smooth slider interaction
  const [localOpacity, setLocalOpacity] = useState(overlay.opacity);
  const [localBrightness, setLocalBrightness] = useState(overlay.brightness ?? 1);
  const [localScale, setLocalScale] = useState(overlay.scale);
  
  // Ref for long press interval
  const moveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleOpacityChange = useCallback((value: number) => {
    setLocalOpacity(value);
  }, []);
  
  const handleOpacityComplete = useCallback((value: number) => {
    onUpdate({ opacity: value });
  }, [onUpdate]);

  const handleBrightnessChange = useCallback((value: number) => {
    setLocalBrightness(value);
  }, []);
  
  const handleBrightnessComplete = useCallback((value: number) => {
    onUpdate({ brightness: value });
  }, [onUpdate]);

  const handleScaleChange = useCallback((value: number) => {
    setLocalScale(value);
  }, []);
  
  const handleScaleComplete = useCallback((value: number) => {
    onUpdate({ scale: value });
  }, [onUpdate]);

  const handleRotate = useCallback((degrees: number) => {
    onUpdate({ rotation: (overlay.rotation + degrees) % 360 });
  }, [overlay.rotation, onUpdate]);

  const handleResetPosition = useCallback(() => {
    onUpdate({ x: 0, y: 0, rotation: 0, scale: 1, flipX: false, flipY: false });
  }, [onUpdate]);

  const handleFlipX = useCallback(() => {
    onUpdate({ flipX: !overlay.flipX });
  }, [overlay.flipX, onUpdate]);

  const handleFlipY = useCallback(() => {
    onUpdate({ flipY: !overlay.flipY });
  }, [overlay.flipY, onUpdate]);

  // Move overlay by a step (for arrow buttons)
  const moveStep = 20; // pixels
  const handleMove = useCallback((dx: number, dy: number) => {
    onUpdate({ x: overlay.x + dx, y: overlay.y + dy });
  }, [overlay.x, overlay.y, onUpdate]);
  
  // Long press handlers for continuous movement
  // We need to use refs to track current position during long press
  const currentPosRef = useRef({ x: overlay.x, y: overlay.y });
  currentPosRef.current = { x: overlay.x, y: overlay.y };
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const startContinuousMove = useCallback((dx: number, dy: number) => {
    // Clear any existing timers
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
    
    // Wait a bit before starting continuous movement (to distinguish from single tap)
    longPressTimeoutRef.current = setTimeout(() => {
      moveIntervalRef.current = setInterval(() => {
        const nextX = currentPosRef.current.x + dx;
        const nextY = currentPosRef.current.y + dy;
        onUpdate({ x: nextX, y: nextY });
      }, 80);
    }, 200);
  }, [onUpdate]);
  
  const stopContinuousMove = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (moveIntervalRef.current) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>תמונת רפרנס</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.iconButton, overlay.locked && styles.iconButtonActive]}
            onPress={onToggleLock}
          >
            <Ionicons 
              name={overlay.locked ? 'lock-closed' : 'lock-open'} 
              size={18} 
              color={overlay.locked ? theme.primary : theme.textSecondary} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onClear}>
            <Ionicons name="trash-outline" size={18} color={theme.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.controlRow}>
        <Text style={styles.label}>שקיפות</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={1}
          value={localOpacity}
          onValueChange={handleOpacityChange}
          onSlidingComplete={handleOpacityComplete}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
        />
        <Text style={styles.value}>{Math.round(localOpacity * 100)}%</Text>
      </View>

      <View style={styles.controlRow}>
        <Text style={styles.label}>בהירות</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={2}
          value={localBrightness}
          onValueChange={handleBrightnessChange}
          onSlidingComplete={handleBrightnessComplete}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
        />
        <Text style={styles.value}>{Math.round(localBrightness * 100)}%</Text>
      </View>

      <View style={styles.controlRow}>
        <Text style={styles.label}>גודל</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={10}
          value={localScale}
          onValueChange={handleScaleChange}
          onSlidingComplete={handleScaleComplete}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
        />
        <Text style={styles.value}>{Math.round(localScale * 100)}%</Text>
      </View>

      {/* Rotation buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.rotateButton}
          onPress={() => handleRotate(-90)}
          disabled={overlay.locked}
        >
          <Ionicons name="refresh-outline" size={20} color={theme.text} style={{ transform: [{ scaleX: -1 }] }} />
          <Text style={styles.buttonText}>-90°</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.rotateButton}
          onPress={() => handleRotate(90)}
          disabled={overlay.locked}
        >
          <Ionicons name="refresh-outline" size={20} color={theme.text} />
          <Text style={styles.buttonText}>+90°</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={handleResetPosition}
          disabled={overlay.locked}
        >
          <Ionicons name="refresh" size={20} color={theme.primary} />
          <Text style={[styles.buttonText, { color: theme.primary }]}>איפוס</Text>
        </TouchableOpacity>
      </View>

      {/* Flip buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.flipButton, overlay.flipX && styles.flipButtonActive]}
          onPress={handleFlipX}
          disabled={overlay.locked}
        >
          <Ionicons name="swap-horizontal" size={20} color={overlay.flipX ? theme.primary : theme.text} />
          <Text style={[styles.buttonText, overlay.flipX && { color: theme.primary }]}>הפוך אנכי</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.flipButton, overlay.flipY && styles.flipButtonActive]}
          onPress={handleFlipY}
          disabled={overlay.locked}
        >
          <Ionicons name="swap-vertical" size={20} color={overlay.flipY ? theme.primary : theme.text} />
          <Text style={[styles.buttonText, overlay.flipY && { color: theme.primary }]}>הפוך אופקי</Text>
        </TouchableOpacity>
      </View>

      {/* Position arrows - D-pad style */}
      {!overlay.locked && (
        <View style={styles.positionSection}>
          <Text style={styles.positionLabel}>הזז תמונה (לחיצה ארוכה להמשך)</Text>
          <View style={styles.dpadContainer}>
            <View style={styles.dpadRow}>
              <View style={styles.dpadSpacer} />
              <TouchableOpacity 
                style={styles.dpadButton}
                onPress={() => handleMove(0, -moveStep)}
                onPressIn={() => startContinuousMove(0, -moveStep)}
                onPressOut={stopContinuousMove}
                delayLongPress={200}
              >
                <Ionicons name="chevron-up" size={24} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.dpadSpacer} />
            </View>
            <View style={styles.dpadRow}>
              <TouchableOpacity 
                style={styles.dpadButton}
                onPress={() => handleMove(-moveStep, 0)}
                onPressIn={() => startContinuousMove(-moveStep, 0)}
                onPressOut={stopContinuousMove}
                delayLongPress={200}
              >
                <Ionicons name="chevron-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.dpadCenter}>
                <Ionicons name="move" size={20} color={theme.textSecondary} />
              </View>
              <TouchableOpacity 
                style={styles.dpadButton}
                onPress={() => handleMove(moveStep, 0)}
                onPressIn={() => startContinuousMove(moveStep, 0)}
                onPressOut={stopContinuousMove}
                delayLongPress={200}
              >
                <Ionicons name="chevron-forward" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.dpadRow}>
              <View style={styles.dpadSpacer} />
              <TouchableOpacity 
                style={styles.dpadButton}
                onPress={() => handleMove(0, moveStep)}
                onPressIn={() => startContinuousMove(0, moveStep)}
                onPressOut={stopContinuousMove}
                delayLongPress={200}
              >
                <Ionicons name="chevron-down" size={24} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.dpadSpacer} />
            </View>
          </View>
        </View>
      )}

      {!overlay.locked && (
        <Text style={styles.hint}>
          השתמש בחצים להזזה או גרור את התמונה ישירות
        </Text>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      padding: 12,
      borderRadius: 12,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.background,
    },
    iconButtonActive: {
      backgroundColor: theme.primaryLight || `${theme.primary}20`,
    },
    controlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      width: 60,
      fontSize: 14,
      color: theme.textSecondary,
    },
    slider: {
      flex: 1,
      height: 40,
    },
    value: {
      width: 45,
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'left',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      gap: 8,
    },
    rotateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.background,
      borderRadius: 8,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.background,
      borderRadius: 8,
    },
    flipButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    flipButtonActive: {
      backgroundColor: theme.primaryLight || `${theme.primary}20`,
      borderColor: theme.primary,
    },
    buttonText: {
      fontSize: 14,
      color: theme.text,
    },
    positionSection: {
      alignItems: 'center',
      gap: 8,
    },
    positionLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    dpadContainer: {
      alignItems: 'center',
      gap: 2,
    },
    dpadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    dpadButton: {
      width: 44,
      height: 44,
      backgroundColor: theme.background,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    dpadCenter: {
      width: 44,
      height: 44,
      backgroundColor: theme.surface,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dpadSpacer: {
      width: 44,
      height: 44,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });
