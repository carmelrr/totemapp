// src/components/spray/HoldTypePicker.tsx
// Component for selecting hold type (start/middle/feet)

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HoldType, HOLD_TYPES } from '@/features/spraywall/types';
import { useLanguage } from '@/features/language';
import { useTheme, lightTheme } from '@/features/theme/ThemeContext';

type Theme = typeof lightTheme;

interface HoldTypePickerProps {
  selectedType: HoldType;
  onSelectType: (type: HoldType) => void;
  /** Compact mode for landscape side panel */
  compact?: boolean;
}

export const HoldTypePicker: React.FC<HoldTypePickerProps> = ({
  selectedType,
  onSelectType,
  compact = false,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  
  const types: HoldType[] = ['start', 'middle', 'feet'];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.sprayWall.holdType}</Text>
      <View style={styles.buttonRow}>
        {types.map((type) => {
          const { label, color } = HOLD_TYPES[type];
          const isSelected = selectedType === type;
          
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.button,
                { borderColor: color },
                isSelected && { backgroundColor: color },
              ]}
              onPress={() => onSelectType(type)}
            >
              <Text
                style={[
                  styles.buttonText,
                  isSelected && styles.buttonTextSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Dynamic styles based on theme
const createStyles = (theme: Theme, compact: boolean = false) => StyleSheet.create({
  container: {
    paddingHorizontal: compact ? 4 : 16,
    paddingVertical: compact ? 6 : 12,
    backgroundColor: compact ? 'transparent' : theme.surface,
  },
  label: {
    color: theme.text,
    fontSize: compact ? 10 : 14,
    fontWeight: '600',
    marginBottom: compact ? 4 : 10,
    textAlign: compact ? 'center' : 'right',
  },
  buttonRow: {
    flexDirection: compact ? 'column' : 'row',
    justifyContent: 'space-between',
    gap: compact ? 4 : 8,
  },
  button: {
    flex: compact ? undefined : 1,
    paddingVertical: compact ? 6 : 12,
    paddingHorizontal: compact ? 4 : 8,
    borderRadius: compact ? 6 : 8,
    borderWidth: compact ? 2 : 3,
    backgroundColor: 'transparent',
    alignItems: 'center',
    minWidth: compact ? 60 : undefined,
  },
  buttonText: {
    color: theme.text,
    fontSize: compact ? 10 : 14,
    fontWeight: '600',
  },
  buttonTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
});

export default HoldTypePicker;
