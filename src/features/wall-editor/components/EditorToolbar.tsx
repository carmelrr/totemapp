// EditorToolbar - Mode selection and tools for the editor

import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { EditorMode } from '../types';

interface EditorToolbarProps {
  /** Current editor mode */
  currentMode: EditorMode;
  /** Callback when mode changes */
  onModeChange: (mode: EditorMode) => void;
  /** Whether currently building a wall */
  isBuildingWall?: boolean;
  /** Whether currently building a mat */
  isBuildingMat?: boolean;
  /** Callback to finish current wall */
  onFinishWall?: () => void;
  /** Callback to close wall as polygon */
  onCloseWall?: () => void;
  /** Callback to cancel current wall */
  onCancelWall?: () => void;
  /** Callback to finish current mat */
  onFinishMat?: () => void;
  /** Callback to cancel current mat */
  onCancelMat?: () => void;
  /** Callback to undo */
  onUndo?: () => void;
  /** Callback to redo */
  onRedo?: () => void;
  /** Can undo */
  canUndo?: boolean;
  /** Can redo */
  canRedo?: boolean;
}

interface ToolButton {
  mode: EditorMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TOOLS: ToolButton[] = [
  { mode: 'select', icon: 'hand-left', label: 'בחירה' },
  { mode: 'pan', icon: 'move', label: 'זזה' },
  { mode: 'mat', icon: 'square', label: 'מזרן' },
  { mode: 'wall', icon: 'git-commit', label: 'קיר' },
  { mode: 'text', icon: 'text', label: 'כיתוב' },
  { mode: 'erase', icon: 'trash', label: 'מחיקה' },
];

export default function EditorToolbar({
  currentMode,
  onModeChange,
  isBuildingWall,
  isBuildingMat,
  onFinishWall,
  onCloseWall,
  onCancelWall,
  onFinishMat,
  onCancelMat,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: EditorToolbarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {/* Main tools row */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsRowContent}
        style={styles.toolsRow}
      >
        {TOOLS.map(tool => (
          <TouchableOpacity
            key={tool.mode}
            style={[
              styles.toolButton,
              currentMode === tool.mode && styles.toolButtonActive,
            ]}
            onPress={() => onModeChange(tool.mode)}
          >
            <Ionicons
              name={tool.icon}
              size={20}
              color={currentMode === tool.mode ? '#ffffff' : theme.text}
            />
            <Text
              style={[
                styles.toolLabel,
                currentMode === tool.mode && styles.toolLabelActive,
              ]}
            >
              {tool.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Separator */}
        <View style={styles.separator} />

        {/* Undo/Redo */}
        <TouchableOpacity
          style={[styles.actionButton, !canUndo && styles.actionButtonDisabled]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Ionicons
            name="arrow-undo"
            size={20}
            color={canUndo ? theme.text : theme.textSecondary}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, !canRedo && styles.actionButtonDisabled]}
          onPress={onRedo}
          disabled={!canRedo}
        >
          <Ionicons
            name="arrow-redo"
            size={20}
            color={canRedo ? theme.text : theme.textSecondary}
          />
        </TouchableOpacity>
      </ScrollView>

      {/* Context actions when building wall */}
      {isBuildingWall && (
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>בונה קיר...</Text>
          <View style={styles.contextActions}>
            <TouchableOpacity style={styles.contextButton} onPress={onCancelWall}>
              <Ionicons name="close-circle" size={18} color="#EF4444" />
              <Text style={[styles.contextButtonText, { color: '#EF4444' }]}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextButton} onPress={onCloseWall}>
              <Ionicons name="git-compare" size={18} color="#F59E0B" />
              <Text style={[styles.contextButtonText, { color: '#F59E0B' }]}>סגור כפוליגון</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextButtonPrimary} onPress={onFinishWall}>
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={styles.contextButtonPrimaryText}>סיים קיר</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Context actions when building mat */}
      {isBuildingMat && (
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>בונה מזרן...</Text>
          <View style={styles.contextActions}>
            <TouchableOpacity style={styles.contextButton} onPress={onCancelMat}>
              <Ionicons name="close-circle" size={18} color="#EF4444" />
              <Text style={[styles.contextButtonText, { color: '#EF4444' }]}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextButtonPrimary} onPress={onFinishMat}>
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={styles.contextButtonPrimaryText}>סיים מזרן</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    toolsRow: {
      flexGrow: 0,
    },
    toolsRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    toolButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginHorizontal: 2,
      gap: 4,
    },
    toolButtonActive: {
      backgroundColor: theme.primary,
    },
    toolLabel: {
      fontSize: 12,
      color: theme.text,
      fontWeight: '500',
    },
    toolLabelActive: {
      color: '#ffffff',
    },
    separator: {
      width: 1,
      height: 24,
      backgroundColor: theme.border,
      marginHorizontal: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      marginHorizontal: 2,
    },
    actionButtonDisabled: {
      opacity: 0.4,
    },
    contextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    contextLabel: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    contextActions: {
      flexDirection: 'row',
      gap: 8,
    },
    contextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
    },
    contextButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    contextButtonPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: '#22C55E',
      gap: 4,
    },
    contextButtonPrimaryText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
  });
