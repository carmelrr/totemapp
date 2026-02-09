// src/components/spray/GradePicker.tsx
// Grade picker for route difficulty

import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, ScrollView } from "react-native";
import { useLanguage } from "@/features/language";
import { useTheme } from '@/features/theme/ThemeContext';

const V_GRADES = ["VB", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10+"];

interface GradePickerProps {
  selectedGrade: string;
  onSelectGrade: (grade: string) => void;
}

export const GradePicker: React.FC<GradePickerProps> = ({
  selectedGrade,
  onSelectGrade,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.sprayWall.difficultyGrade}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gradesRow}
      >
        {V_GRADES.map((grade) => (
          <TouchableOpacity
            key={grade}
            style={[
              styles.gradeButton,
              selectedGrade === grade && styles.gradeButtonSelected,
            ]}
            onPress={() => onSelectGrade(grade)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.gradeText,
                selectedGrade === grade && styles.gradeTextSelected,
              ]}
            >
              {grade}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: theme.surface,
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  gradesRow: {
    flexDirection: "row",
    gap: 8,
    paddingEnd: 12,
  },
  gradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.border,
  },
  gradeButtonSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  gradeText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  gradeTextSelected: {
    color: "#fff",
  },
});

export default GradePicker;
