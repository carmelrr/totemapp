// src/components/spray/GradePicker.tsx
// Grade picker for route difficulty

import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, ScrollView } from "react-native";

const V_GRADES = ["VB", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10+"];

interface GradePickerProps {
  selectedGrade: string;
  onSelectGrade: (grade: string) => void;
}

export const GradePicker: React.FC<GradePickerProps> = ({
  selectedGrade,
  onSelectGrade,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>דרגת קושי:</Text>
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

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#2a2a2a",
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  gradesRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 12,
  },
  gradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#3a3a3a",
    borderWidth: 1,
    borderColor: "#444",
  },
  gradeButtonSelected: {
    backgroundColor: "#8E4EC6",
    borderColor: "#8E4EC6",
  },
  gradeText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
  },
  gradeTextSelected: {
    color: "#fff",
  },
});

export default GradePicker;
