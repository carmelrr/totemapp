// SectorRenderer - Renders sector labels and zones
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { Sector } from '../types';

interface SectorRendererProps {
  sectors: Sector[];
  roomFitScale: number;
  onSectorPress?: (sector: Sector) => void;
  onSectorUpdate?: (sectorId: string, updates: Partial<Sector>) => void;
  isEditing?: boolean;
  selectedSectorId?: string;
}

export default function SectorRenderer({ 
  sectors, 
  roomFitScale,
  onSectorPress,
  onSectorUpdate,
  isEditing = false,
  selectedSectorId,
}: SectorRendererProps) {
  if (!sectors || sectors.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isEditing ? 'auto' : 'box-none'}>
      {sectors.map((sector) => {
        const x = sector.bounds.x * roomFitScale;
        const y = sector.bounds.y * roomFitScale;
        const width = sector.bounds.width * roomFitScale;
        const height = sector.bounds.height * roomFitScale;
        const isSelected = sector.id === selectedSectorId;
        const labelOpacity = sector.labelOpacity ?? 1;
        const fontSize = sector.labelFontSize || 14;

        // Label position: sector center + offset (matches DynamicWallMap model)
        const getLabelStyle = () => {
          const labelOffset = sector.labelOffset || { x: 0, y: 0 };
          return {
            left: labelOffset.x * roomFitScale + width / 2,
            top: labelOffset.y * roomFitScale + height / 2,
            transform: [{ translateX: -50 }, { translateY: -12 }] as any,
          };
        };

        return (
          <TouchableOpacity
            key={sector.id}
            style={[
              styles.sectorContainer,
              {
                left: x,
                top: y,
                width,
                height,
              },
            ]}
            onPress={() => onSectorPress?.(sector)}
            activeOpacity={0.7}
          >
            {/* Sector boundary (only visible in edit mode) */}
            {isEditing && (
              <View
                style={[
                  styles.sectorBorder,
                  {
                    borderColor: sector.color,
                    backgroundColor: isSelected 
                      ? `${sector.color}30` 
                      : `${sector.color}10`,
                  },
                ]}
              >
                {/* Resize handle in bottom-right corner */}
                {isSelected && (
                  <View style={[styles.resizeHandle, { backgroundColor: sector.color }]} />
                )}
              </View>
            )}
            
            {/* Sector label */}
            <View
              style={[
                styles.labelContainer,
                getLabelStyle(),
                { opacity: labelOpacity },
              ]}
            >
              <View style={[styles.labelPill, { backgroundColor: sector.color }]}>
                <Text style={[styles.labelText, { fontSize: fontSize * roomFitScale }]}>{sector.name}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectorContainer: {
    position: 'absolute',
  },
  sectorBorder: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  labelContainer: {
    position: 'absolute',
    alignSelf: 'center',
  },
  labelPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  labelText: {
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
});
