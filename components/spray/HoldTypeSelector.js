import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const HOLD_TYPES = [
  { type: 'START', label: 'Start/Top', color: '#FF4444' },
  { type: 'MID', label: 'Mid', color: '#4444FF' },
  { type: 'FOOT', label: 'Foot', color: '#FFFF44' }
];

const HoldTypeSelector = ({ selectedType, onTypeSelect }) => {
  return (
    <View style={styles.container}>
      {HOLD_TYPES.map(({ type, label, color }) => (
        <TouchableOpacity
          key={type}
          style={[
            styles.typeButton,
            {
              backgroundColor: selectedType === type ? color : 'transparent',
              borderColor: color,
            }
          ]}
          onPress={() => onTypeSelect(type)}
        >
          <Text style={[
            styles.typeText,
            { color: selectedType === type ? 'white' : color }
          ]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 2,
  },
  typeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default HoldTypeSelector;
