import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';

interface GradeSelectorProps {
    selectedGrade: string;
    onGradeChange: (grade: string) => void;
    disabled?: boolean;
    grades?: string[];
}

const DEFAULT_GRADES = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

export const GradeSelector: React.FC<GradeSelectorProps> = ({
    selectedGrade,
    onGradeChange,
    disabled = false,
    grades = DEFAULT_GRADES,
}) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>דרגת קושי מוצעת:</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {grades.map((grade) => (
                    <TouchableOpacity
                        key={grade}
                        style={[
                            styles.gradeButton,
                            selectedGrade === grade && styles.selectedGrade,
                            disabled && styles.disabled,
                        ]}
                        onPress={() => !disabled && onGradeChange(grade)}
                        disabled={disabled}
                    >
                        <Text
                            style={[
                                styles.gradeText,
                                selectedGrade === grade && styles.selectedGradeText,
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
        marginVertical: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'right',
        color: '#333',
    },
    scrollView: {
        flexGrow: 0,
    },
    scrollContent: {
        paddingHorizontal: 8,
    },
    gradeButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginHorizontal: 4,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#ddd',
        minWidth: 50,
        alignItems: 'center',
    },
    selectedGrade: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    gradeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    selectedGradeText: {
        color: '#fff',
    },
    disabled: {
        opacity: 0.5,
    },
});
