// CreateRoomModal - Modal for creating a new room/space

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { CreateRoomPayload } from '../types';

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: CreateRoomPayload) => void;
}

// Conversion: 1 meter = 100 pixels (for internal representation)
const PIXELS_PER_METER = 100;

export default function CreateRoomModal({
  visible,
  onClose,
  onCreate,
}: CreateRoomModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  
  // Dimensions in meters
  const [name, setName] = useState('');
  const [widthMeters, setWidthMeters] = useState('8');
  const [heightMeters, setHeightMeters] = useState('6');
  const [gridSizeMeters, setGridSizeMeters] = useState('0.5');

  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleCreate = () => {
    const widthM = parseFloat(widthMeters);
    const heightM = parseFloat(heightMeters);
    const gridSizeM = parseFloat(gridSizeMeters);

    if (!name.trim()) {
      // TODO: Show error
      return;
    }

    if (isNaN(widthM) || widthM < 1) {
      return;
    }

    if (isNaN(heightM) || heightM < 1) {
      return;
    }

    // Convert meters to pixels
    const widthPx = Math.round(widthM * PIXELS_PER_METER);
    const heightPx = Math.round(heightM * PIXELS_PER_METER);
    const gridSizePx = Math.round((isNaN(gridSizeM) ? 0.5 : gridSizeM) * PIXELS_PER_METER);

    onCreate({
      name: name.trim(),
      width: widthPx,
      height: heightPx,
      gridSize: gridSizePx,
    });

    // Reset form
    setName('');
    setWidthMeters('8');
    setHeightMeters('6');
    setGridSizeMeters('0.5');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setWidthMeters('8');
    setHeightMeters('6');
    setGridSizeMeters('0.5');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>יצירת חלל חדש</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Room Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>שם החלל</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t.wall.wallNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            {/* Dimensions in meters */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>מידות (במטרים)</Text>
              <View style={styles.dimensionsRow}>
                <View style={styles.dimensionInput}>
                  <Text style={styles.dimensionLabel}>רוחב</Text>
                  <View style={styles.meterInputContainer}>
                    <TextInput
                      style={styles.meterInput}
                      value={widthMeters}
                      onChangeText={setWidthMeters}
                      keyboardType="decimal-pad"
                      placeholder="8"
                      placeholderTextColor={theme.textSecondary}
                    />
                    <Text style={styles.unitLabel}>מ׳</Text>
                  </View>
                </View>
                <View style={styles.dimensionSeparator}>
                  <Ionicons name="close" size={16} color={theme.textSecondary} />
                </View>
                <View style={styles.dimensionInput}>
                  <Text style={styles.dimensionLabel}>גובה</Text>
                  <View style={styles.meterInputContainer}>
                    <TextInput
                      style={styles.meterInput}
                      value={heightMeters}
                      onChangeText={setHeightMeters}
                      keyboardType="decimal-pad"
                      placeholder="6"
                      placeholderTextColor={theme.textSecondary}
                    />
                    <Text style={styles.unitLabel}>מ׳</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.hint}>
                גודל הקיר/החלל בפועל במטרים
              </Text>
            </View>

            {/* Grid Size */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>גודל תא בגריד</Text>
              <View style={styles.meterInputContainer}>
                <TextInput
                  style={styles.meterInput}
                  value={gridSizeMeters}
                  onChangeText={setGridSizeMeters}
                  keyboardType="decimal-pad"
                  placeholder="0.5"
                  placeholderTextColor={theme.textSecondary}
                />
                <Text style={styles.unitLabel}>מ׳</Text>
              </View>
              <Text style={styles.hint}>
                מרחק בין קווי הגריד (מומלץ: 0.25 - 1 מטר)
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.createButtonText}>צור חלל</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '90%',
      maxWidth: 450,
      maxHeight: '80%',
      backgroundColor: theme.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      padding: 16,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: theme.text,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    meterInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    meterInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      textAlign: 'center',
    },
    unitLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      paddingEnd: 4,
    },
    dimensionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dimensionInput: {
      flex: 1,
    },
    dimensionLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
      textAlign: 'center',
    },
    dimensionSeparator: {
      paddingHorizontal: 12,
      paddingTop: 20,
    },
    actions: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    cancelButton: {
      flex: 1,
      padding: 14,
      borderRadius: 10,
      backgroundColor: theme.background,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    createButton: {
      flex: 2,
      flexDirection: 'row',
      padding: 14,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    createButtonDisabled: {
      opacity: 0.5,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
  });
