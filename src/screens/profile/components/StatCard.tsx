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
                    { borderLeftColor: color },
                ]}
            >
                <View style={styles.statContent}>
                    <Text style={styles.statIcon}>🔒</Text>
                    <View style={styles.statTextContainer}>
                        <Text style={[styles.statValue, { color: theme.text }]}>פרטי</Text>
                        <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.statCard, { borderLeftColor: color, backgroundColor: theme.surface }]}>
            <TouchableOpacity
                style={styles.statContent}
                onPress={onPress}
                disabled={!onPress}
            >
                <Text style={styles.statIcon}>{icon}</Text>
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
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderLeftWidth: 4,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    hiddenStatCard: {
        opacity: 0.6,
    },
    statContent: {
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    statIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    statTextContainer: {
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 2,
    },
    statTitle: {
        fontSize: 14,
        color: "#666",
    },
    privacyIndicator: {
        paddingLeft: 8,
    },
    privacyText: {
        fontSize: 16,
    },
});
