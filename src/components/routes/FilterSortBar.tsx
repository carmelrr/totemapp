// components/routes/FilterSortBar.tsx
import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';

interface FilterSortBarProps {
    onFilterPress: () => void;
    onSortPress: () => void;
}

/**
 * Toolbar קטן בין המפה לרשימה עם כפתורי סינון ומיון
 */
export default function FilterSortBar({ onFilterPress, onSortPress }: FilterSortBarProps) {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    
    return (
        <View style={styles.row}>
            <Pressable style={styles.btn} onPress={onFilterPress}>
                <Text style={styles.btnText}>{t.common.filter}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onSortPress}>
                <Text style={styles.btnText}>{t.common.sort}</Text>
            </Pressable>
        </View>
    );
}

// Dynamic styles factory for theme support
const createStyles = (theme: any) => StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: theme.background,
    },
    btn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: theme.surface,
        elevation: 1,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    btnText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.text,
        textAlign: 'center',
    },
});
