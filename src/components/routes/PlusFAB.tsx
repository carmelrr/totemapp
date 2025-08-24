// components/routes/PlusFAB.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { THEME_COLORS } from '@/constants/colors';

interface PlusFABProps {
    onPress: () => void;
}

/**
 * כפתור פלוס צף - מופיע רק לאדמין
 */
export default function PlusFAB({ onPress }: PlusFABProps) {
    const { isAdmin } = useAuth();

    if (!isAdmin) return null;

    return (
        <View style={styles.wrap}>
            <Pressable
                style={styles.fab}
                onPress={onPress}
                accessibilityLabel="הוסף מסלול"
                android_ripple={{ color: THEME_COLORS.primary + '30' }}
            >
                <View style={styles.plus}>
                    <View style={[styles.line, styles.horizontal]} />
                    <View style={[styles.line, styles.vertical]} />
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        right: 16,
        bottom: 16,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: THEME_COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
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
