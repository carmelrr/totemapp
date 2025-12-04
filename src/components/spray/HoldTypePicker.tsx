// src/components/spray/HoldTypePicker.tsx
// Component for selecting hold type (start/middle/feet)

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HoldType, HOLD_TYPES } from '@/features/spraywall/types';

interface HoldTypePickerProps {
  selectedType: HoldType;
  onSelectType: (type: HoldType) => void;
}

export const HoldTypePicker: React.FC<HoldTypePickerProps> = ({
  selectedType,
  onSelectType,
}) => {
  const types: HoldType[] = ['start', 'middle', 'feet'];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>סוג אחיזה</Text>
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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
});

export default HoldTypePicker;
