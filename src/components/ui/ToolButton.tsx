// components/ui/ToolButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { THEME_COLORS } from '../../constants/colors';

interface ToolButtonProps {
  title: string;
  icon?: string;
  isSelected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  title,
  icon,
  isSelected = false,
  onPress,
  style,
  textStyle,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isSelected && styles.selectedButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text
        style={[
          styles.text,
          isSelected && styles.selectedText,
          disabled && styles.disabledText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  selectedButton: {
    backgroundColor: THEME_COLORS.primary,
    borderColor: THEME_COLORS.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  selectedText: {
    color: '#FFFFFF',
  },
  disabledText: {
    color: THEME_COLORS.textSecondary,
  },
  icon: {
    fontSize: 16,
  },
});
