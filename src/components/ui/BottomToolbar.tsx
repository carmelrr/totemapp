// components/ui/BottomToolbar.tsx
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ToolButton } from "./ToolButton";
import { useTheme } from "@/features/theme/ThemeContext";

interface BottomToolbarProps {
  selectedTool: string;
  onToolSelect: (tool: string) => void;
  tools: Array<{
    id: string;
    title: string;
    icon: string;
    disabled?: boolean;
  }>;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  selectedTool,
  onToolSelect,
  tools,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.toolbar}>
        {tools.map((tool) => (
          <ToolButton
            key={tool.id}
            title={tool.title}
            icon={tool.icon}
            isSelected={selectedTool === tool.id}
            onPress={() => onToolSelect(tool.id)}
            disabled={tool.disabled}
            style={styles.toolButton}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

// Dynamic styles factory for theme support
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  toolbar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  toolButton: {
    flex: 1,
  },
});
