import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";

export interface StatCardProps {
    title: string;
    value: string | number;
    icon: string;
    color?: string;
    onPress?: () => void;
    isVisible?: boolean;
    settingKey?: string;
    isOwner?: boolean;
}

/**
 * Reusable statistics card component for profile screens
 * Supports privacy settings and owner-specific behavior
 */
export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    color = "#007AFF",
    onPress = null,
    isVisible = true,
    settingKey = null,
    isOwner = false,
}) => {
    const { theme } = useTheme();

    if (!isVisible && !isOwner) {
        return (
            <View
                style={[
                    styles.statCard,
                    styles.hiddenStatCard,
                    { 
                        borderLeftColor: color, 
                        backgroundColor: theme.surface,
                        shadowColor: theme.shadow,
                    },
                ]}
            >
                <View style={styles.statContent}>
                    <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                        <Text style={styles.statIcon}>🔒</Text>
                    </View>
                    <View style={styles.statTextContainer}>
                        <Text style={[styles.statValue, { color: theme.text }]}>פרטי</Text>
                        <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={[
            styles.statCard, 
            { 
                borderLeftColor: color, 
                backgroundColor: theme.surface,
                shadowColor: theme.shadow,
            }
        ]}>
            <TouchableOpacity
                style={styles.statContent}
                onPress={onPress}
                disabled={!onPress}
            >
                <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                    <Text style={styles.statIcon}>{icon}</Text>
                </View>
                <View style={styles.statTextContainer}>
                    <Text style={[styles.statValue, { color: theme.text }]}>
                        {isVisible || isOwner ? value : "פרטי"}
                    </Text>
                    <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
                </View>
                {isOwner && settingKey && (
                    <View style={styles.privacyIndicator}>
                        <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
                            {isVisible ? "👁️" : "🔒"}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    statCard: {
        borderRadius: 16,
        borderLeftWidth: 5,
        marginBottom: 12,
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 5,
    },
    hiddenStatCard: {
        opacity: 0.5,
    },
    statContent: {
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    statIcon: {
        fontSize: 26,
    },
    statTextContainer: {
        flex: 1,
    },
    statValue: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 3,
    },
    statTitle: {
        fontSize: 14,
        fontWeight: "500",
    },
    privacyIndicator: {
        paddingLeft: 8,
    },
    privacyText: {
        fontSize: 18,
    },
});
