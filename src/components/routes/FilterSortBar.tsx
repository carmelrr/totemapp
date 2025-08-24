// components/routes/FilterSortBar.tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { THEME_COLORS } from '@/constants/colors';

interface FilterSortBarProps {
    onFilterPress: () => void;
    onSortPress: () => void;
}

/**
 * Toolbar קטן בין המפה לרשימה עם כפתורי סינון ומיון
 */
export default function FilterSortBar({ onFilterPress, onSortPress }: FilterSortBarProps) {
    return (
        <View style={styles.row}>
            <Pressable style={styles.btn} onPress={onFilterPress}>
                <Text style={styles.btnText}>סינון</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onSortPress}>
                <Text style={styles.btnText}>מיון</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: THEME_COLORS.background,
    },
    btn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: THEME_COLORS.surface,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    btnText: {
        fontSize: 14,
        fontWeight: '500',
        color: THEME_COLORS.text,
        textAlign: 'center',
    },
});
