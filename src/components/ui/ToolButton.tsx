// components/ui/ToolButton.tsx
import React, { useMemo } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";

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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
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

// Dynamic styles factory for theme support
const createStyles = (theme: any) => StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  selectedButton: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  selectedText: {
    color: "#FFFFFF",
  },
  disabledText: {
    color: theme.textSecondary,
  },
  icon: {
    fontSize: 16,
  },
});
