// StyleControlsPanel - Real-time style controls for the editor

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { Room, EditorStyles, GridConfig, OverlayImage, EntranceArrow, Sector, TextLabel } from '../types';

interface StyleControlsPanelProps {
  /** Current room */
  room: Room | null;
  /** Editor styles */
  styles: EditorStyles;
  /** Grid config */
  gridConfig: GridConfig;
  /** Callback to update room styles */
  onUpdateRoomStyle?: (updates: Partial<Pick<Room, 'backgroundColor' | 'gridColor' | 'showGrid' | 'gridSize'>>) => void;
  /** Callback to update editor styles */
  onUpdateStyles?: (updates: Partial<EditorStyles>) => void;
  /** Callback to update grid config */
  onUpdateGridConfig?: (updates: Partial<GridConfig>) => void;
  /** Whether panel is expanded */
  isExpanded?: boolean;
  /** Toggle panel expansion */
  onToggleExpand?: () => void;
  /** Overlay image (for reference tab) */
  overlay?: OverlayImage | null;
  /** Update overlay */
  onUpdateOverlay?: (updates: Partial<OverlayImage>) => void;
  /** Clear overlay */
  onClearOverlay?: () => void;
  /** Pick new overlay */
  onPickOverlay?: () => void;
  /** Open crop modal */
  onOpenCrop?: () => void;
  /** Update entrance arrow */
  onUpdateEntranceArrow?: (arrow: EntranceArrow | undefined) => void;
  /** Update sectors */
  onUpdateSectors?: (sectors: Sector[]) => void;
  /** Start drawing entrance arrow */
  onStartDrawArrow?: () => void;
  /** Add new sector */
  onAddSector?: () => void;
  /** Zoom to sector bounds */
  onZoomToSector?: (sector: Sector) => void;
  /** Update text labels */
  onUpdateTextLabels?: (labels: TextLabel[]) => void;
  /** Add new text label */
  onAddTextLabel?: () => void;
}

// Preset colors for quick selection
const PRESET_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#1a1a1a',
  '#2d2d44', '#1e3a5f', '#0d1b2a', '#1b263b',
  '#3a3a5a', '#4a4a6a', '#5a5a7a', '#6a6a8a',
  '#22C55E', '#EF4444', '#3B82F6', '#F59E0B',
  '#ffffff', '#e5e5e5', '#cccccc', '#999999',
];

export default function StyleControlsPanel({
  room,
  styles: editorStyles,
  gridConfig,
  onUpdateRoomStyle,
  onUpdateStyles,
  onUpdateGridConfig,
  isExpanded = false,
  onToggleExpand,
  overlay,
  onUpdateOverlay,
  onClearOverlay,
  onPickOverlay,
  onOpenCrop,
  onUpdateEntranceArrow,
  onUpdateSectors,
  onStartDrawArrow,
  onAddSector,
  onZoomToSector,
  onUpdateTextLabels,
  onAddTextLabel,
}: StyleControlsPanelProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [activeSection, setActiveSection] = useState<'room' | 'grid' | 'wall' | 'reference'>('room');
  
  // Local state for smooth slider interaction
  const [localOpacity, setLocalOpacity] = useState(overlay?.opacity ?? 0.5);
  const [localBrightness, setLocalBrightness] = useState(overlay?.brightness ?? 1);
  const [localScale, setLocalScale] = useState(overlay?.scale ?? 1);
  
  // Update local state when overlay changes externally
  React.useEffect(() => {
    if (overlay) {
      setLocalOpacity(overlay.opacity);
      setLocalBrightness(overlay.brightness ?? 1);
      setLocalScale(overlay.scale);
    }
  }, [overlay?.opacity, overlay?.brightness, overlay?.scale]);
  
  // Refs for long press interval (overlay)
  const moveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentPosRef = useRef({ x: overlay?.x ?? 0, y: overlay?.y ?? 0 });
  
  // Keep ref updated with current position
  React.useEffect(() => {
    if (overlay) {
      currentPosRef.current = { x: overlay.x, y: overlay.y };
    }
  }, [overlay?.x, overlay?.y]);

  // Generic long-press refs for all other D-pads (arrows, labels, sectors)
  const genericIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const genericTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef(room);
  React.useEffect(() => { roomRef.current = room; }, [room]);

  const startGenericContinuousMove = useCallback((moveFn: () => void) => {
    if (genericTimeoutRef.current) clearTimeout(genericTimeoutRef.current);
    if (genericIntervalRef.current) clearInterval(genericIntervalRef.current);
    
    genericTimeoutRef.current = setTimeout(() => {
      genericIntervalRef.current = setInterval(() => {
        moveFn();
      }, 60);
    }, 200);
  }, []);
  
  const stopGenericContinuousMove = useCallback(() => {
    if (genericTimeoutRef.current) {
      clearTimeout(genericTimeoutRef.current);
      genericTimeoutRef.current = null;
    }
    if (genericIntervalRef.current) {
      clearInterval(genericIntervalRef.current);
      genericIntervalRef.current = null;
    }
  }, []);

  // Overlay control handlers
  const handleFlipX = useCallback(() => {
    if (overlay && onUpdateOverlay) {
      onUpdateOverlay({ flipX: !overlay.flipX });
    }
  }, [overlay, onUpdateOverlay]);

  const handleFlipY = useCallback(() => {
    if (overlay && onUpdateOverlay) {
      onUpdateOverlay({ flipY: !overlay.flipY });
    }
  }, [overlay, onUpdateOverlay]);

  const handleRotate = useCallback((degrees: number) => {
    if (overlay && onUpdateOverlay) {
      onUpdateOverlay({ rotation: (overlay.rotation + degrees) % 360 });
    }
  }, [overlay, onUpdateOverlay]);

  const handleResetOverlay = useCallback(() => {
    if (onUpdateOverlay) {
      onUpdateOverlay({ x: 0, y: 0, rotation: 0, scale: 1, flipX: false, flipY: false });
    }
  }, [onUpdateOverlay]);

  const moveStep = 10;
  const handleMoveOverlay = useCallback((dx: number, dy: number) => {
    if (overlay && onUpdateOverlay) {
      onUpdateOverlay({ x: overlay.x + dx, y: overlay.y + dy });
    }
  }, [overlay, onUpdateOverlay]);
  
  // Long press handlers for continuous movement
  const startContinuousMove = useCallback((dx: number, dy: number) => {
    if (!onUpdateOverlay) return;
    
    // Clear any existing timers
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
    
    // Wait a bit before starting continuous movement
    longPressTimeoutRef.current = setTimeout(() => {
      moveIntervalRef.current = setInterval(() => {
        const nextX = currentPosRef.current.x + dx;
        const nextY = currentPosRef.current.y + dy;
        onUpdateOverlay({ x: nextX, y: nextY });
      }, 60);
    }, 200);
  }, [onUpdateOverlay]);
  
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

  if (!isExpanded) {
    return (
      <TouchableOpacity style={styles.collapsedBar} onPress={onToggleExpand}>
        <Ionicons name="color-palette" size={18} color={theme.text} />
        <Text style={styles.collapsedText}>עיצוב</Text>
        <Ionicons name="chevron-up" size={16} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  }

  const renderColorPicker = (
    label: string,
    currentColor: string,
    onColorChange: (color: string) => void
  ) => (
    <View style={styles.controlGroup}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.colorGrid}>
        {PRESET_COLORS.map((color, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              currentColor === color && styles.colorSwatchSelected,
            ]}
            onPress={() => onColorChange(color)}
          >
            {currentColor === color && (
              <Ionicons 
                name="checkmark" 
                size={14} 
                color={isLightColor(color) ? '#000' : '#fff'} 
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
      {/* Custom color input */}
      <View style={styles.customColorRow}>
        <View 
          style={[styles.currentColorPreview, { backgroundColor: currentColor }]} 
        />
        <TextInput
          style={styles.colorInput}
          value={currentColor}
          onChangeText={(text) => {
            if (/^#[0-9A-Fa-f]{0,6}$/.test(text)) {
              onColorChange(text);
            }
          }}
          placeholder="#000000"
          placeholderTextColor={theme.textSecondary}
        />
      </View>
    </View>
  );

  const renderSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void
  ) => (
    <View style={styles.controlGroup}>
      <View style={styles.sliderHeader}>
        <Text style={styles.controlLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value}</Text>
      </View>
      <View style={styles.sliderContainer}>
        <TouchableOpacity 
          style={styles.sliderButton}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Ionicons name="remove" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.sliderTrack}>
          <View 
            style={[
              styles.sliderFill, 
              { width: `${((value - min) / (max - min)) * 100}%` }
            ]} 
          />
        </View>
        <TouchableOpacity 
          style={styles.sliderButton}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Ionicons name="add" size={16} color={theme.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={onToggleExpand}>
        <View style={styles.headerLeft}>
          <Ionicons name="color-palette" size={18} color={theme.text} />
          <Text style={styles.headerTitle}>הגדרות עיצוב</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
      </TouchableOpacity>

      {/* Section tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'room' && styles.tabActive]}
          onPress={() => setActiveSection('room')}
        >
          <Text style={[styles.tabText, activeSection === 'room' && styles.tabTextActive]}>
            חדר
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'grid' && styles.tabActive]}
          onPress={() => setActiveSection('grid')}
        >
          <Text style={[styles.tabText, activeSection === 'grid' && styles.tabTextActive]}>
            גריד
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'wall' && styles.tabActive]}
          onPress={() => setActiveSection('wall')}
        >
          <Text style={[styles.tabText, activeSection === 'wall' && styles.tabTextActive]}>
            קירות
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'reference' && styles.tabActive, overlay && styles.tabWithBadge]}
          onPress={() => setActiveSection('reference')}
        >
          <Text style={[styles.tabText, activeSection === 'reference' && styles.tabTextActive]}>
            רפרנס
          </Text>
          {overlay && <View style={styles.tabBadge} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Room section */}
        {activeSection === 'room' && room && (
          <>
            {renderColorPicker(
              'צבע רקע',
              room.backgroundColor,
              (color) => onUpdateRoomStyle?.({ backgroundColor: color })
            )}
            
            {renderSlider(
              'רוחב החדר',
              room.width,
              200,
              3000,
              100,
              (value) => onUpdateRoomStyle?.({ width: value } as any)
            )}
            
            {renderSlider(
              'גובה החדר',
              room.height,
              200,
              2000,
              100,
              (value) => onUpdateRoomStyle?.({ height: value } as any)
            )}

            {/* Entrance Arrow Section */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>חץ כניסה</Text>
            </View>
            
            {room.entranceArrow?.visible ? (
              <>
                {renderColorPicker(
                  'צבע החץ',
                  room.entranceArrow.color,
                  (color) => onUpdateEntranceArrow?.({ ...room.entranceArrow!, color })
                )}
                
                {/* Arrow stroke width slider */}
                {renderSlider(
                  'עובי החץ',
                  room.entranceArrow.strokeWidth || 4,
                  1,
                  12,
                  1,
                  (value) => onUpdateEntranceArrow?.({ ...room.entranceArrow!, strokeWidth: value })
                )}
                
                {/* Arrow position controls */}
                <View style={styles.controlGroup}>
                  <Text style={styles.controlLabel}>מיקום החץ</Text>
                  <View style={styles.sectorPositionButtons}>
                    <TouchableOpacity 
                      style={styles.sectorMoveButton}
                      onPress={() => {
                        const arrow = room.entranceArrow!;
                        onUpdateEntranceArrow?.({
                          ...arrow,
                          start: { ...arrow.start, y: arrow.start.y - 5 },
                          end: { ...arrow.end, y: arrow.end.y - 5 },
                        });
                      }}
                      onPressIn={() => startGenericContinuousMove(() => {
                        const r = roomRef.current;
                        const arrow = r?.entranceArrow;
                        if (arrow) onUpdateEntranceArrow?.({ ...arrow, start: { ...arrow.start, y: arrow.start.y - 5 }, end: { ...arrow.end, y: arrow.end.y - 5 } });
                      })}
                      onPressOut={stopGenericContinuousMove}
                    >
                      <Ionicons name="arrow-up" size={14} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.sectorMoveButton}
                      onPress={() => {
                        const arrow = room.entranceArrow!;
                        onUpdateEntranceArrow?.({
                          ...arrow,
                          start: { ...arrow.start, y: arrow.start.y + 5 },
                          end: { ...arrow.end, y: arrow.end.y + 5 },
                        });
                      }}
                      onPressIn={() => startGenericContinuousMove(() => {
                        const r = roomRef.current;
                        const arrow = r?.entranceArrow;
                        if (arrow) onUpdateEntranceArrow?.({ ...arrow, start: { ...arrow.start, y: arrow.start.y + 5 }, end: { ...arrow.end, y: arrow.end.y + 5 } });
                      })}
                      onPressOut={stopGenericContinuousMove}
                    >
                      <Ionicons name="arrow-down" size={14} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.sectorMoveButton}
                      onPress={() => {
                        const arrow = room.entranceArrow!;
                        onUpdateEntranceArrow?.({
                          ...arrow,
                          start: { ...arrow.start, x: arrow.start.x - 5 },
                          end: { ...arrow.end, x: arrow.end.x - 5 },
                        });
                      }}
                      onPressIn={() => startGenericContinuousMove(() => {
                        const r = roomRef.current;
                        const arrow = r?.entranceArrow;
                        if (arrow) onUpdateEntranceArrow?.({ ...arrow, start: { ...arrow.start, x: arrow.start.x - 5 }, end: { ...arrow.end, x: arrow.end.x - 5 } });
                      })}
                      onPressOut={stopGenericContinuousMove}
                    >
                      <Ionicons name="arrow-back" size={14} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.sectorMoveButton}
                      onPress={() => {
                        const arrow = room.entranceArrow!;
                        onUpdateEntranceArrow?.({
                          ...arrow,
                          start: { ...arrow.start, x: arrow.start.x + 5 },
                          end: { ...arrow.end, x: arrow.end.x + 5 },
                        });
                      }}
                      onPressIn={() => startGenericContinuousMove(() => {
                        const r = roomRef.current;
                        const arrow = r?.entranceArrow;
                        if (arrow) onUpdateEntranceArrow?.({ ...arrow, start: { ...arrow.start, x: arrow.start.x + 5 }, end: { ...arrow.end, x: arrow.end.x + 5 } });
                      })}
                      onPressOut={stopGenericContinuousMove}
                    >
                      <Ionicons name="arrow-forward" size={14} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Arrow length control */}
                <View style={styles.controlGroup}>
                  <Text style={styles.controlLabel}>אורך החץ</Text>
                  <View style={styles.sectorSizeButtons}>
                    <TouchableOpacity 
                      style={styles.sectorSizeButton}
                      onPress={() => {
                        const arrow = room.entranceArrow!;
                        const dx = arrow.end.x - arrow.start.x;
                        const dy = arrow.end.y - arrow.start.y;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        if (length > 20) {
                          const factor = (length - 10) / length;
                          onUpdateEntranceArrow?.({
                            ...arrow,
                            end: {
                              x: arrow.start.x + dx * factor,
                              y: arrow.start.y + dy * factor,
                            },
                          });
                        }
                      }}
                    >
                      <Ionicons name="remove" size={14} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.sectorSizeText}>
                      {Math.round(Math.sqrt(
                        Math.pow(room.entranceArrow.end.x - room.entranceArrow.start.x, 2) +
                        Math.pow(room.entranceArrow.end.y - room.entranceArrow.start.y, 2)
                      ))}
                    </Text>
                    <TouchableOpacity 
                      style={styles.sectorSizeButton}
                      onPress={() => {
                        const arrow = room.entranceArrow!;
                        const dx = arrow.end.x - arrow.start.x;
                        const dy = arrow.end.y - arrow.start.y;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        const factor = (length + 10) / length;
                        onUpdateEntranceArrow?.({
                          ...arrow,
                          end: {
                            x: arrow.start.x + dx * factor,
                            y: arrow.start.y + dy * factor,
                          },
                        });
                      }}
                    >
                      <Ionicons name="add" size={14} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={onStartDrawArrow}
                  >
                    <Ionicons name="pencil" size={16} color={theme.text} />
                    <Text style={styles.actionButtonText}>ציור מחדש</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: `${theme.error}20` }]}
                    onPress={() => onUpdateEntranceArrow?.(undefined)}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.error} />
                    <Text style={[styles.actionButtonText, { color: theme.error }]}>מחק</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={onStartDrawArrow}>
                <Ionicons name="arrow-forward-circle" size={20} color={theme.primary} />
                <Text style={styles.addButtonText}>הוסף חץ כניסה</Text>
              </TouchableOpacity>
            )}

            {/* Text Labels Section */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>כיתובים</Text>
            </View>
            
            {room.textLabels && room.textLabels.length > 0 ? (
              <>
                {room.textLabels.map((label, index) => (
                  <View key={label.id} style={styles.sectorItemExpanded}>
                    <View style={styles.sectorItemHeader}>
                      <View style={[styles.sectorColorDot, { backgroundColor: label.color }]} />
                      <Text style={styles.sectorName} numberOfLines={1}>{label.text}</Text>
                      <TouchableOpacity 
                        onPress={() => {
                          const newLabels = [...room.textLabels!];
                          newLabels.splice(index, 1);
                          onUpdateTextLabels?.(newLabels);
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Text input */}
                    <View style={styles.controlGroup}>
                      <Text style={styles.controlLabel}>טקסט</Text>
                      <TextInput
                        style={styles.textInput}
                        value={label.text}
                        onChangeText={(text) => {
                          const newLabels = [...room.textLabels!];
                          newLabels[index] = { ...label, text };
                          onUpdateTextLabels?.(newLabels);
                        }}
                        placeholder="כיתוב"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                    
                    {/* Color picker */}
                    {renderColorPicker(
                      'צבע',
                      label.color,
                      (color) => {
                        const newLabels = [...room.textLabels!];
                        newLabels[index] = { ...label, color };
                        onUpdateTextLabels?.(newLabels);
                      }
                    )}
                    
                    {/* Font size slider */}
                    {renderSlider(
                      'גודל גופן',
                      label.fontSize,
                      10,
                      48,
                      1,
                      (value) => {
                        const newLabels = [...room.textLabels!];
                        newLabels[index] = { ...label, fontSize: value };
                        onUpdateTextLabels?.(newLabels);
                      }
                    )}
                    
                    {/* Opacity slider */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>שקיפות:</Text>
                      <View style={styles.sectorOpacityControl}>
                        <Slider
                          style={styles.sectorSlider}
                          value={label.opacity}
                          minimumValue={0.1}
                          maximumValue={1}
                          step={0.1}
                          minimumTrackTintColor={theme.primary}
                          maximumTrackTintColor={theme.border}
                          thumbTintColor={theme.primary}
                          onValueChange={(value) => {
                            const newLabels = [...room.textLabels!];
                            newLabels[index] = { ...label, opacity: value };
                            onUpdateTextLabels?.(newLabels);
                          }}
                        />
                        <Text style={styles.sectorOpacityText}>{Math.round(label.opacity * 100)}%</Text>
                      </View>
                    </View>
                    
                    {/* Position controls */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>מיקום:</Text>
                      <View style={styles.sectorPositionButtons}>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newLabels = [...room.textLabels!];
                            newLabels[index] = { 
                              ...label, 
                              position: { ...label.position, y: label.position.y - 5 } 
                            };
                            onUpdateTextLabels?.(newLabels);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const lbl = r?.textLabels?.[index];
                            if (lbl) {
                              const newLabels = [...r!.textLabels!];
                              newLabels[index] = { ...lbl, position: { ...lbl.position, y: lbl.position.y - 5 } };
                              onUpdateTextLabels?.(newLabels);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-up" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newLabels = [...room.textLabels!];
                            newLabels[index] = { 
                              ...label, 
                              position: { ...label.position, y: label.position.y + 5 } 
                            };
                            onUpdateTextLabels?.(newLabels);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const lbl = r?.textLabels?.[index];
                            if (lbl) {
                              const newLabels = [...r!.textLabels!];
                              newLabels[index] = { ...lbl, position: { ...lbl.position, y: lbl.position.y + 5 } };
                              onUpdateTextLabels?.(newLabels);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-down" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newLabels = [...room.textLabels!];
                            newLabels[index] = { 
                              ...label, 
                              position: { ...label.position, x: label.position.x - 5 } 
                            };
                            onUpdateTextLabels?.(newLabels);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const lbl = r?.textLabels?.[index];
                            if (lbl) {
                              const newLabels = [...r!.textLabels!];
                              newLabels[index] = { ...lbl, position: { ...lbl.position, x: lbl.position.x - 5 } };
                              onUpdateTextLabels?.(newLabels);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-back" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newLabels = [...room.textLabels!];
                            newLabels[index] = { 
                              ...label, 
                              position: { ...label.position, x: label.position.x + 5 } 
                            };
                            onUpdateTextLabels?.(newLabels);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const lbl = r?.textLabels?.[index];
                            if (lbl) {
                              const newLabels = [...r!.textLabels!];
                              newLabels[index] = { ...lbl, position: { ...lbl.position, x: lbl.position.x + 5 } };
                              onUpdateTextLabels?.(newLabels);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-forward" size={14} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {/* Background toggle */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>רקע:</Text>
                      <Switch
                        value={!!label.backgroundColor}
                        onValueChange={(value) => {
                          const newLabels = [...room.textLabels!];
                          newLabels[index] = { 
                            ...label, 
                            backgroundColor: value ? label.color : undefined,
                            backgroundOpacity: value ? 0.8 : undefined,
                          };
                          onUpdateTextLabels?.(newLabels);
                        }}
                        trackColor={{ false: theme.border, true: theme.primary }}
                        thumbColor={theme.background}
                      />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
            
            <TouchableOpacity style={styles.addButton} onPress={onAddTextLabel}>
              <Ionicons name="text" size={20} color={theme.primary} />
              <Text style={styles.addButtonText}>הוסף כיתוב</Text>
            </TouchableOpacity>

            {/* Sectors Section */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>סקטורים</Text>
            </View>
            
            {room.sectors && room.sectors.length > 0 ? (
              <>
                {room.sectors.map((sector, index) => (
                  <View key={sector.id} style={styles.sectorItemExpanded}>
                    {/* Sector header with name and actions */}
                    <View style={styles.sectorItemHeader}>
                      <View style={styles.sectorZoomButton}>
                        <View style={[styles.sectorColorDot, { backgroundColor: sector.color }]} />
                        <TextInput
                          style={styles.sectorNameInput}
                          value={sector.name}
                          onChangeText={(text) => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = { ...sector, name: text };
                            onUpdateSectors?.(newSectors);
                          }}
                          placeholder="שם סקטור"
                          placeholderTextColor={theme.textSecondary}
                        />
                        <TouchableOpacity onPress={() => onZoomToSector?.(sector)}>
                          <Ionicons name="locate" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          const newSectors = [...room.sectors!];
                          newSectors.splice(index, 1);
                          onUpdateSectors?.(newSectors);
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Sector width control with slider and +/- buttons */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>רוחב:</Text>
                      <View style={styles.sectorDimensionControl}>
                        <TouchableOpacity 
                          style={styles.sectorSizeButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, width: Math.max(50, sector.bounds.width - 20) }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                        >
                          <Ionicons name="remove" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <Slider
                          style={styles.sectorDimensionSlider}
                          minimumValue={50}
                          maximumValue={room.width}
                          value={sector.bounds.width}
                          onSlidingComplete={(value) => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = { ...sector, bounds: { ...sector.bounds, width: value } };
                            onUpdateSectors?.(newSectors);
                          }}
                          minimumTrackTintColor={sector.color}
                          maximumTrackTintColor={theme.border}
                          thumbTintColor={sector.color}
                        />
                        <TouchableOpacity 
                          style={styles.sectorSizeButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, width: Math.min(room.width, sector.bounds.width + 20) }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                        >
                          <Ionicons name="add" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={styles.sectorDimensionValue}>{Math.round(sector.bounds.width)}</Text>
                      </View>
                    </View>
                    
                    {/* Sector height control with slider and +/- buttons */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>גובה:</Text>
                      <View style={styles.sectorDimensionControl}>
                        <TouchableOpacity 
                          style={styles.sectorSizeButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, height: Math.max(50, sector.bounds.height - 20) }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                        >
                          <Ionicons name="remove" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <Slider
                          style={styles.sectorDimensionSlider}
                          minimumValue={50}
                          maximumValue={room.height}
                          value={sector.bounds.height}
                          onSlidingComplete={(value) => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = { ...sector, bounds: { ...sector.bounds, height: value } };
                            onUpdateSectors?.(newSectors);
                          }}
                          minimumTrackTintColor={sector.color}
                          maximumTrackTintColor={theme.border}
                          thumbTintColor={sector.color}
                        />
                        <TouchableOpacity 
                          style={styles.sectorSizeButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, height: Math.min(room.height, sector.bounds.height + 20) }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                        >
                          <Ionicons name="add" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={styles.sectorDimensionValue}>{Math.round(sector.bounds.height)}</Text>
                      </View>
                    </View>
                    
                    {/* Sector position controls */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>מיקום סקטור:</Text>
                      <View style={styles.sectorPositionButtons}>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, x: Math.max(0, sector.bounds.x - 8) }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, bounds: { ...s.bounds, x: Math.max(0, s.bounds.x - 8) } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="chevron-back" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, y: Math.max(0, sector.bounds.y - 8) }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, bounds: { ...s.bounds, y: Math.max(0, s.bounds.y - 8) } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="chevron-up" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, y: sector.bounds.y + 8 }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, bounds: { ...s.bounds, y: s.bounds.y + 8 } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="chevron-down" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              bounds: { ...sector.bounds, x: sector.bounds.x + 8 }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, bounds: { ...s.bounds, x: s.bounds.x + 8 } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="chevron-forward" size={14} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {/* Label font size slider */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>גודל כותרת:</Text>
                      <View style={styles.sectorDimensionControl}>
                        <TouchableOpacity 
                          style={styles.sectorSizeButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              labelFontSize: Math.max(8, (sector.labelFontSize || 14) - 2)
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                        >
                          <Ionicons name="remove" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <Slider
                          style={styles.sectorDimensionSlider}
                          minimumValue={8}
                          maximumValue={100}
                          value={sector.labelFontSize || 14}
                          onSlidingComplete={(value) => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = { ...sector, labelFontSize: Math.round(value) };
                            onUpdateSectors?.(newSectors);
                          }}
                          minimumTrackTintColor={sector.color}
                          maximumTrackTintColor={theme.border}
                          thumbTintColor={sector.color}
                        />
                        <TouchableOpacity 
                          style={styles.sectorSizeButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              labelFontSize: Math.min(100, (sector.labelFontSize || 14) + 2)
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                        >
                          <Ionicons name="add" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={styles.sectorDimensionValue}>{sector.labelFontSize || 14}</Text>
                      </View>
                    </View>
                    
                    {/* Label position offset controls */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>מיקום כותרת:</Text>
                      <View style={styles.sectorPositionButtons}>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const offset = sector.labelOffset || { x: 0, y: 0 };
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              labelOffset: { ...offset, y: offset.y - 5 }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const offset = s.labelOffset || { x: 0, y: 0 };
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, labelOffset: { ...offset, y: offset.y - 5 } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-up" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const offset = sector.labelOffset || { x: 0, y: 0 };
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              labelOffset: { ...offset, y: offset.y + 5 }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const offset = s.labelOffset || { x: 0, y: 0 };
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, labelOffset: { ...offset, y: offset.y + 5 } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-down" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const offset = sector.labelOffset || { x: 0, y: 0 };
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              labelOffset: { ...offset, x: offset.x - 5 }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const offset = s.labelOffset || { x: 0, y: 0 };
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, labelOffset: { ...offset, x: offset.x - 5 } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-back" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const offset = sector.labelOffset || { x: 0, y: 0 };
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              labelOffset: { ...offset, x: offset.x + 5 }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                          onPressIn={() => startGenericContinuousMove(() => {
                            const r = roomRef.current;
                            const s = r?.sectors?.[index];
                            if (s) {
                              const offset = s.labelOffset || { x: 0, y: 0 };
                              const newSectors = [...r!.sectors!];
                              newSectors[index] = { ...s, labelOffset: { ...offset, x: offset.x + 5 } };
                              onUpdateSectors?.(newSectors);
                            }
                          })}
                          onPressOut={stopGenericContinuousMove}
                        >
                          <Ionicons name="arrow-forward" size={14} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.sectorMoveButton}
                          onPress={() => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = {
                              ...sector,
                              labelOffset: { x: 0, y: 0 }
                            };
                            onUpdateSectors?.(newSectors);
                          }}
                        >
                          <Ionicons name="locate-outline" size={14} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {/* Sector label opacity slider */}
                    <View style={styles.sectorControlsRow}>
                      <Text style={styles.sectorControlLabel}>שקיפות:</Text>
                      <View style={styles.sectorOpacityControl}>
                        <Slider
                          style={styles.sectorSlider}
                          minimumValue={0.2}
                          maximumValue={1}
                          value={sector.labelOpacity ?? 1}
                          onSlidingComplete={(value) => {
                            const newSectors = [...room.sectors!];
                            newSectors[index] = { ...sector, labelOpacity: value };
                            onUpdateSectors?.(newSectors);
                          }}
                          minimumTrackTintColor={sector.color}
                          maximumTrackTintColor={theme.border}
                          thumbTintColor={sector.color}
                        />
                        <Text style={styles.sectorOpacityText}>
                          {Math.round((sector.labelOpacity ?? 1) * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addButton} onPress={onAddSector}>
                  <Ionicons name="add-circle" size={20} color={theme.primary} />
                  <Text style={styles.addButtonText}>הוסף סקטור</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={onAddSector}>
                <Ionicons name="grid-outline" size={20} color={theme.primary} />
                <Text style={styles.addButtonText}>הוסף סקטור ראשון</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Grid section */}
        {activeSection === 'grid' && room && (
          <>
            <View style={styles.controlGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.controlLabel}>הצג גריד</Text>
                <Switch
                  value={room.showGrid}
                  onValueChange={(value) => onUpdateRoomStyle?.({ showGrid: value })}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
            
            {renderColorPicker(
              'צבע גריד',
              room.gridColor,
              (color) => onUpdateRoomStyle?.({ gridColor: color })
            )}
            
            {renderSlider(
              'גודל תא',
              room.gridSize,
              10,
              100,
              5,
              (value) => onUpdateRoomStyle?.({ gridSize: value })
            )}
            
            <View style={styles.controlGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.controlLabel}>הצג קווים ראשיים</Text>
                <Switch
                  value={gridConfig.showMajorLines}
                  onValueChange={(value) => onUpdateGridConfig?.({ showMajorLines: value })}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </>
        )}

        {/* Wall section */}
        {activeSection === 'wall' && (
          <>
            {renderColorPicker(
              'צבע קיר ברירת מחדל',
              editorStyles.wallDefaultColor,
              (color) => onUpdateStyles?.({ wallDefaultColor: color })
            )}
            
            {renderSlider(
              'עובי קיר ברירת מחדל',
              editorStyles.wallDefaultWidth,
              1,
              10,
              1,
              (value) => onUpdateStyles?.({ wallDefaultWidth: value })
            )}
            
            {renderSlider(
              'רדיוס Snap',
              editorStyles.snapThreshold,
              5,
              50,
              5,
              (value) => onUpdateStyles?.({ snapThreshold: value })
            )}
            
            {renderSlider(
              'גודל נקודות',
              editorStyles.pointRadius,
              4,
              16,
              1,
              (value) => onUpdateStyles?.({ pointRadius: value })
            )}
          </>
        )}

        {/* Reference image section */}
        {activeSection === 'reference' && (
          <>
            {!overlay ? (
              <View style={styles.noOverlayContainer}>
                <Ionicons name="image-outline" size={48} color={theme.textSecondary} />
                <Text style={styles.noOverlayText}>אין תמונת רפרנס</Text>
                <TouchableOpacity style={styles.addOverlayButton} onPress={onPickOverlay}>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.addOverlayButtonText}>העלה תמונה או OBJ</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Overlay info */}
                <View style={styles.overlayInfoRow}>
                  <Text style={styles.overlayName} numberOfLines={1}>{overlay.name}</Text>
                  <View style={styles.overlayActions}>
                    <TouchableOpacity 
                      style={[styles.overlayActionButton, overlay.locked && styles.overlayActionButtonActive]}
                      onPress={() => onUpdateOverlay?.({ locked: !overlay.locked })}
                    >
                      <Ionicons 
                        name={overlay.locked ? 'lock-closed' : 'lock-open'} 
                        size={16} 
                        color={overlay.locked ? theme.primary : theme.textSecondary} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.overlayActionButton} onPress={onClearOverlay}>
                      <Ionicons name="trash-outline" size={16} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Opacity slider */}
                <View style={styles.controlGroup}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.controlLabel}>שקיפות</Text>
                    <Text style={styles.sliderValue}>{Math.round(localOpacity * 100)}%</Text>
                  </View>
                  <Slider
                    style={styles.nativeSlider}
                    minimumValue={0.1}
                    maximumValue={1}
                    value={localOpacity}
                    onValueChange={setLocalOpacity}
                    onSlidingComplete={(value) => onUpdateOverlay?.({ opacity: value })}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.border}
                    thumbTintColor={theme.primary}
                  />
                </View>

                {/* Brightness slider */}
                <View style={styles.controlGroup}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.controlLabel}>בהירות</Text>
                    <Text style={styles.sliderValue}>{Math.round(localBrightness * 100)}%</Text>
                  </View>
                  <Slider
                    style={styles.nativeSlider}
                    minimumValue={0.5}
                    maximumValue={2}
                    value={localBrightness}
                    onValueChange={setLocalBrightness}
                    onSlidingComplete={(value) => onUpdateOverlay?.({ brightness: value })}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.border}
                    thumbTintColor={theme.primary}
                  />
                </View>

                {/* Scale slider with +/- buttons */}
                <View style={styles.controlGroup}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.controlLabel}>גודל</Text>
                    <View style={styles.scaleButtonsRow}>
                      <TouchableOpacity 
                        style={styles.scaleButton}
                        onPress={() => {
                          const newScale = Math.max(0.1, localScale - 0.1);
                          setLocalScale(newScale);
                          onUpdateOverlay?.({ scale: newScale });
                        }}
                        disabled={overlay.locked}
                      >
                        <Ionicons name="remove" size={18} color={overlay.locked ? theme.textSecondary : theme.text} />
                      </TouchableOpacity>
                      <Text style={styles.sliderValue}>{Math.round(localScale * 100)}%</Text>
                      <TouchableOpacity 
                        style={styles.scaleButton}
                        onPress={() => {
                          const newScale = Math.min(10, localScale + 0.1);
                          setLocalScale(newScale);
                          onUpdateOverlay?.({ scale: newScale });
                        }}
                        disabled={overlay.locked}
                      >
                        <Ionicons name="add" size={18} color={overlay.locked ? theme.textSecondary : theme.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Slider
                    style={styles.nativeSlider}
                    minimumValue={0.1}
                    maximumValue={10}
                    value={localScale}
                    onValueChange={setLocalScale}
                    onSlidingComplete={(value) => onUpdateOverlay?.({ scale: value })}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.border}
                    thumbTintColor={theme.primary}
                    disabled={overlay.locked}
                  />
                </View>

                {/* Rotation buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleRotate(-90)}
                    disabled={overlay.locked}
                  >
                    <Ionicons name="refresh-outline" size={18} color={theme.text} style={{ transform: [{ scaleX: -1 }] }} />
                    <Text style={styles.actionButtonText}>-90°</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleRotate(90)}
                    disabled={overlay.locked}
                  >
                    <Ionicons name="refresh-outline" size={18} color={theme.text} />
                    <Text style={styles.actionButtonText}>+90°</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={handleResetOverlay}
                    disabled={overlay.locked}
                  >
                    <Ionicons name="refresh" size={18} color={theme.primary} />
                    <Text style={[styles.actionButtonText, { color: theme.primary }]}>איפוס</Text>
                  </TouchableOpacity>
                </View>

                {/* Flip buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={[styles.flipButton, overlay.flipX && styles.flipButtonActive]}
                    onPress={handleFlipX}
                    disabled={overlay.locked}
                  >
                    <Ionicons name="swap-horizontal" size={18} color={overlay.flipX ? theme.primary : theme.text} />
                    <Text style={[styles.actionButtonText, overlay.flipX && { color: theme.primary }]}>הפוך אנכי</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.flipButton, overlay.flipY && styles.flipButtonActive]}
                    onPress={handleFlipY}
                    disabled={overlay.locked}
                  >
                    <Ionicons name="swap-vertical" size={18} color={overlay.flipY ? theme.primary : theme.text} />
                    <Text style={[styles.actionButtonText, overlay.flipY && { color: theme.primary }]}>הפוך אופקי</Text>
                  </TouchableOpacity>
                </View>

                {/* D-pad for position */}
                {!overlay.locked && (
                  <View style={styles.dpadSection}>
                    <Text style={styles.dpadLabel}>הזז תמונה (לחיצה ארוכה להמשך)</Text>
                    <View style={styles.dpadContainer}>
                      <View style={styles.dpadRow}>
                        <View style={styles.dpadSpacer} />
                        <TouchableOpacity 
                          style={styles.dpadButton}
                          onPress={() => handleMoveOverlay(0, -moveStep)}
                          onPressIn={() => startContinuousMove(0, -moveStep)}
                          onPressOut={stopContinuousMove}
                        >
                          <Ionicons name="chevron-up" size={20} color={theme.text} />
                        </TouchableOpacity>
                        <View style={styles.dpadSpacer} />
                      </View>
                      <View style={styles.dpadRow}>
                        <TouchableOpacity 
                          style={styles.dpadButton}
                          onPress={() => handleMoveOverlay(-moveStep, 0)}
                          onPressIn={() => startContinuousMove(-moveStep, 0)}
                          onPressOut={stopContinuousMove}
                        >
                          <Ionicons name="chevron-back" size={20} color={theme.text} />
                        </TouchableOpacity>
                        <View style={styles.dpadCenter}>
                          <Ionicons name="move" size={16} color={theme.textSecondary} />
                        </View>
                        <TouchableOpacity 
                          style={styles.dpadButton}
                          onPress={() => handleMoveOverlay(moveStep, 0)}
                          onPressIn={() => startContinuousMove(moveStep, 0)}
                          onPressOut={stopContinuousMove}
                        >
                          <Ionicons name="chevron-forward" size={20} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.dpadRow}>
                        <View style={styles.dpadSpacer} />
                        <TouchableOpacity 
                          style={styles.dpadButton}
                          onPress={() => handleMoveOverlay(0, moveStep)}
                          onPressIn={() => startContinuousMove(0, moveStep)}
                          onPressOut={stopContinuousMove}
                        >
                          <Ionicons name="chevron-down" size={20} color={theme.text} />
                        </TouchableOpacity>
                        <View style={styles.dpadSpacer} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Crop button */}
                <TouchableOpacity style={styles.replaceButton} onPress={onOpenCrop}>
                  <Ionicons name="crop" size={18} color={theme.primary} />
                  <Text style={styles.replaceButtonText}>חתוך תמונה</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Check if a color is light (for contrast text)
 */
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return false;
  
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      maxHeight: 350,
    },
    collapsedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    collapsedText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '500',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    tabText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    tabTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    content: {
      padding: 12,
    },
    controlGroup: {
      marginBottom: 16,
    },
    controlLabel: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '600',
      marginBottom: 8,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    colorSwatch: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchSelected: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    customColorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    currentColorPreview: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    colorInput: {
      flex: 1,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      color: theme.text,
    },
    sliderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sliderValue: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '600',
    },
    sliderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sliderButton: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sliderTrack: {
      flex: 1,
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    sliderFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 3,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    // Reference tab styles
    tabWithBadge: {
      position: 'relative',
    },
    tabBadge: {
      position: 'absolute',
      top: 6,
      right: '50%',
      marginRight: -20,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.primary,
    },
    noOverlayContainer: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 12,
    },
    noOverlayText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    addOverlayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    addOverlayButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    overlayInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    overlayName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    overlayActions: {
      flexDirection: 'row',
      gap: 8,
    },
    overlayActionButton: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: theme.background,
    },
    overlayActionButtonActive: {
      backgroundColor: theme.primaryLight || `${theme.primary}20`,
    },
    nativeSlider: {
      width: '100%',
      height: 36,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
      backgroundColor: theme.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonText: {
      fontSize: 13,
      color: theme.text,
    },
    flipButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
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
    dpadSection: {
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 12,
    },
    dpadLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 8,
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
      width: 40,
      height: 40,
      backgroundColor: theme.background,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    dpadCenter: {
      width: 40,
      height: 40,
      backgroundColor: theme.surface,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dpadSpacer: {
      width: 40,
      height: 40,
    },
    replaceButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 8,
      marginTop: 8,
    },
    replaceButtonText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    // Entrance arrow and sectors styles
    sectionDivider: {
      marginTop: 20,
      marginBottom: 12,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      backgroundColor: `${theme.primary}15`,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${theme.primary}40`,
      borderStyle: 'dashed',
    },
    addButtonText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    sectorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      backgroundColor: theme.background,
      borderRadius: 8,
      marginBottom: 8,
      gap: 10,
    },
    sectorItemExpanded: {
      backgroundColor: theme.background,
      borderRadius: 10,
      marginBottom: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectorItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 10,
    },
    sectorControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    sectorControlLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      width: 80,
    },
    sectorSizeButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    sectorSizeButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectorSizeText: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      color: theme.text,
    },
    sectorPositionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    sectorMoveButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectorOpacityControl: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectorSlider: {
      flex: 1,
      height: 28,
    },
    sectorOpacityText: {
      fontSize: 12,
      color: theme.textSecondary,
      width: 40,
      textAlign: 'right',
    },
    scaleButtonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    scaleButton: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.text,
      textAlign: 'right',
    },
    sectorZoomButton: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    sectorColorDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    sectorName: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      fontWeight: '500',
    },
    sectorNameInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      fontWeight: '500',
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      textAlign: 'right',
    },
    sectorDimensionControl: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 4,
    },
    sectorDimensionSlider: {
      flex: 1,
      height: 28,
    },
    sectorDimensionValue: {
      fontSize: 11,
      color: theme.textSecondary,
      width: 35,
      textAlign: 'center',
    },
    labelPositionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 4,
    },
    labelPositionButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    labelPositionButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    labelPositionText: {
      fontSize: 11,
      color: theme.text,
    },
    labelPositionTextActive: {
      color: '#fff',
    },
  });
