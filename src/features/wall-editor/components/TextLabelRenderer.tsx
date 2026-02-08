// TextLabelRenderer - Renders beautifully styled text labels on the map
// Uses onLayout measurement for proper centering (RN doesn't support translate(-50%))
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TextLabel } from '../types';

interface TextLabelRendererProps {
  textLabels: TextLabel[];
  roomFitScale: number;
  isEditing?: boolean;
  selectedLabelId?: string;
  onLabelPress?: (label: TextLabel) => void;
}

/** Individual label item — measures itself for proper centering */
function TextLabelItem({
  label,
  roomFitScale,
  isEditing,
  isSelected,
  onLabelPress,
}: {
  label: TextLabel;
  roomFitScale: number;
  isEditing: boolean;
  isSelected: boolean;
  onLabelPress?: (label: TextLabel) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // Only update if meaningfully changed to avoid render loops
    if (!measured || Math.abs(width - size.width) > 0.5 || Math.abs(height - size.height) > 0.5) {
      setSize({ width, height });
      setMeasured(true);
    }
  }, [measured, size.width, size.height]);

  const x = label.position.x * roomFitScale;
  const y = label.position.y * roomFitScale;
  const fontSize = label.fontSize * roomFitScale;
  const padding = (label.padding || 10) * roomFitScale;
  const borderRadius = (label.borderRadius || 10) * roomFitScale;
  const hasBg = !!label.backgroundColor;
  const bgOpacity = label.backgroundOpacity ?? 0.75;

  // Center the label at (x, y) by subtracting half its measured size
  const wrapperStyle: any = {
    position: 'absolute' as const,
    left: x - size.width / 2,
    top: y - size.height / 2,
    // Hide until first measurement to prevent flash at wrong position
    opacity: measured ? label.opacity : 0,
    zIndex: isSelected ? 100 : 10,
  };

  const textStyle: any = {
    fontSize,
    color: label.color,
    fontWeight: label.fontWeight || 'bold',
    textAlign: 'center' as const,
    // Multi-layer text shadow for glow effect
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1.5 * roomFitScale },
    textShadowRadius: 4 * roomFitScale,
    letterSpacing: 0.3 * roomFitScale,
  };

  const innerContent = (
    <>
      {hasBg ? (
        <View style={{
          borderRadius,
          overflow: 'hidden' as const,
        }}>
          {/* Gradient glass background */}
          <LinearGradient
            colors={[
              `${label.backgroundColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
              `${label.backgroundColor}${Math.round(bgOpacity * 0.6 * 255).toString(16).padStart(2, '0')}`,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: padding * 1.4,
              paddingVertical: padding * 0.9,
              borderRadius,
              borderWidth: 1 * roomFitScale,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={textStyle}>{label.text}</Text>
          </LinearGradient>
        </View>
      ) : (
        <View style={{
          paddingHorizontal: padding * 0.8,
          paddingVertical: padding * 0.4,
        }}>
          <Text style={textStyle}>{label.text}</Text>
        </View>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <View style={[selectionStyles.border, {
          borderRadius: borderRadius + 4 * roomFitScale,
          borderWidth: 2 * roomFitScale,
        }]} />
      )}
    </>
  );

  if (isEditing) {
    return (
      <TouchableOpacity
        key={label.id}
        style={wrapperStyle}
        onLayout={handleLayout}
        onPress={() => onLabelPress?.(label)}
        activeOpacity={0.7}
      >
        {innerContent}
      </TouchableOpacity>
    );
  }

  return (
    <View key={label.id} style={wrapperStyle} onLayout={handleLayout}>
      {innerContent}
    </View>
  );
}

export default function TextLabelRenderer({ 
  textLabels,
  roomFitScale,
  isEditing = false,
  selectedLabelId,
  onLabelPress,
}: TextLabelRendererProps) {
  if (!textLabels || textLabels.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isEditing ? 'auto' : 'none'}>
      {textLabels.map((label) => (
        <TextLabelItem
          key={label.id}
          label={label}
          roomFitScale={roomFitScale}
          isEditing={isEditing}
          isSelected={label.id === selectedLabelId}
          onLabelPress={onLabelPress}
        />
      ))}
    </View>
  );
}

const selectionStyles = StyleSheet.create({
  border: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderColor: '#60A5FA',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(96,165,250,0.08)',
  },
});
