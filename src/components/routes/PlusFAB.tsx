// components/routes/PlusFAB.tsx
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/features/theme/ThemeContext';

interface PlusFABProps {
    onPress: () => void;
}

/**
 * כפתור פלוס צף - מופיע רק לאדמין
 */
export default function PlusFAB({ onPress }: PlusFABProps) {
    const { isAdmin } = useAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    if (!isAdmin) return null;

    return (
        <View style={styles.wrap}>
            <Pressable
                style={styles.fab}
                onPress={onPress}
                accessibilityLabel="הוסף מסלול"
                android_ripple={{ color: theme.primary + '30' }}
            >
                <View style={styles.plus}>
                    <View style={[styles.line, styles.horizontal]} />
                    <View style={[styles.line, styles.vertical]} />
                </View>
            </Pressable>
        </View>
    );
}

// Dynamic styles factory for theme support
const createStyles = (theme: any) => StyleSheet.create({
    wrap: {
        position: 'absolute',
        right: 16,
        bottom: 16,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.buttonPrimary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    plus: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    line: {
        backgroundColor: '#fff',
        position: 'absolute',
    },
    horizontal: {
        width: 20,
        height: 2,
    },
    vertical: {
        width: 2,
        height: 20,
    },
});
