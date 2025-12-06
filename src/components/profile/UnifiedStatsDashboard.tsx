import React from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { StatCard } from "../../screens/profile/components/StatCard";
import { UserStats, GradeStatsMap, PrivacySettings } from "../../screens/profile/types";

interface StatsDashboardProps {
    // Basic stats display props
    stats?: UserStats | null;
    onStatsPress?: () => void;
    loading?: boolean;

    // Extended props for UserProfile mode
    userStats?: UserStats;
    userProfile?: {
        displayName?: string;
    };
    allRoutes?: any[];
    gradeStats?: GradeStatsMap;
    privacySettings?: PrivacySettings;
    currentUserId?: string;
    userId?: string;
    isEditingPrivacy?: boolean;
    autoEdit?: boolean;
    setIsEditingPrivacy?: (editing: boolean) => void;
    setShowStatsModal?: (show: boolean) => void;
    savePrivacySettings?: (settings: PrivacySettings) => void;

    // Display mode
    mode?: 'simple' | 'detailed';
}

export const UnifiedStatsDashboard: React.FC<StatsDashboardProps> = ({
    // Basic props
    stats,
    onStatsPress,
    loading = false,

    // Extended props
    userStats,
    userProfile,
    allRoutes = [],
    gradeStats = {},
    privacySettings,
    currentUserId,
    userId,
    isEditingPrivacy = false,
    autoEdit = false,
    setIsEditingPrivacy,
    setShowStatsModal,
    savePrivacySettings,

    mode = 'simple'
}) => {
    const { theme } = useTheme();

    // Simple mode (for ProfileScreen)
    if (mode === 'simple') {
        if (loading) {
            return (
                <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.loadingText, { color: theme.text }]}>טוען סטטיסטיקות...</Text>
                </View>
            );
        }

        if (!stats) {
            return (
                <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                        לא ניתן לטעון סטטיסטיקות
                    </Text>
                </View>
            );
        }

        return (
            <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
                <Text style={[styles.statsTitle, { color: theme.text }]}>📊 הסטטיסטיקות שלי</Text>

                <View style={styles.statsGrid}>
                    <View style={[styles.simpleStatCard, { backgroundColor: theme.background }]}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalRoutesSent}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>מסלולים שסגר</Text>
                    </View>

                    <View style={[styles.simpleStatCard, { backgroundColor: theme.background }]}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.highestGrade}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>דירוג הכי גבוה</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.simpleStatCard, styles.clickableCard, { backgroundColor: theme.background }]}
                        onPress={onStatsPress}
                    >
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.completionPercentage || 0}%</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>אחוז סגירה (על הקיר)</Text>
                        <Text style={[styles.clickHint, { color: theme.primary }]}>לחץ לפרטים</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Detailed mode (for UserProfileScreen)
    const totalRoutes = allRoutes.length;
    const totalCompleted = Object.values(gradeStats).reduce(
        (sum: number, stat: any) => sum + (stat.completed || 0),
        0,
    );
    const overallPercentage =
        totalRoutes > 0
            ? ((totalCompleted / totalRoutes) * 100).toFixed(1)
            : "0.0";
    const isOwner = currentUserId === userId;

    return (
        <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
            <View style={styles.statsHeader}>
                <Text style={[styles.statsTitle, { color: theme.text }]}>
                    📊{" "}
                    {isOwner
                        ? "הסטטיסטיקות שלי"
                        : `הסטטיסטיקות של ${userProfile?.displayName}`}
                </Text>
                {isOwner && setIsEditingPrivacy && (
                    <TouchableOpacity
                        style={[
                            styles.editButton,
                            { backgroundColor: theme.background },
                            isEditingPrivacy && { backgroundColor: theme.primary },
                        ]}
                        onPress={() => setIsEditingPrivacy(!isEditingPrivacy)}
                    >
                        <Text
                            style={[
                                styles.editButtonText,
                                { color: theme.textSecondary },
                                isEditingPrivacy && { color: theme.onPrimary },
                            ]}
                        >
                            {isEditingPrivacy ? "✓ סיום עריכה" : "⚙️ עריכה"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Auto-edit notification */}
            {isOwner && isEditingPrivacy && autoEdit && (
                <View style={[styles.autoEditNotification, { backgroundColor: theme.warning + '20' }]}>
                    <Text style={[styles.autoEditText, { color: theme.warning }]}>
                        🔧 מצב עריכה פעיל - ערוך את הגדרות הפרטיות שלך
                    </Text>
                </View>
            )}

            <View style={styles.statsGrid}>
                {userStats && privacySettings && (
                    <>
                        <StatCard
                            title="מסלולים שסגר"
                            value={userStats.totalRoutesSent}
                            icon="🎯"
                            color="#28a745"
                            isVisible={privacySettings.showTotalRoutes}
                            settingKey="showTotalRoutes"
                            isOwner={isOwner}
                        />

                        <StatCard
                            title="דירוג הכי גבוה"
                            value={userStats.highestGrade}
                            icon="🏆"
                            color="#ffc107"
                            isVisible={privacySettings.showHighestGrade}
                            settingKey="showHighestGrade"
                            isOwner={isOwner}
                        />

                        <StatCard
                            title="סה״כ פידבקים"
                            value={userStats.totalFeedbacks}
                            icon="💬"
                            color="#17a2b8"
                            isVisible={privacySettings.showFeedbackCount}
                            settingKey="showFeedbackCount"
                            isOwner={isOwner}
                        />

                        <StatCard
                            title="אחוז סגירה (על הקיר)"
                            value={`${userStats.completionPercentage || 0}%`}
                            icon="📈"
                            color="#fd7e14"
                            isVisible={privacySettings.showAverageRating}
                            settingKey="showAverageRating"
                            isOwner={isOwner}
                        />

                        <StatCard
                            title="אחוזי סגירה לכל הקיר"
                            value={`${overallPercentage}%`}
                            icon="📈"
                            color="#8e44ad"
                            onPress={
                                privacySettings.showGradeStats || isOwner
                                    ? () => setShowStatsModal?.(true)
                                    : undefined
                            }
                            isVisible={privacySettings.showGradeStats}
                            settingKey="showGradeStats"
                            isOwner={isOwner}
                        />
                    </>
                )}
            </View>

            {userStats && userStats.joinDate && privacySettings && (privacySettings.showJoinDate || isOwner) && (
                <View style={styles.joinDateContainer}>
                    <View style={styles.joinDateContent}>
                        <Text style={[styles.joinDateText, { color: theme.textSecondary }]}>
                            🗓️ חבר מאז: {userStats.joinDate.toLocaleDateString("he-IL")}
                        </Text>
                        {isOwner && isEditingPrivacy && savePrivacySettings && (
                            <View style={styles.joinDatePrivacy}>
                                <Text style={[styles.privacyToggleLabel, { color: theme.textSecondary }]}>הצג לאחרים</Text>
                                <Switch
                                    value={privacySettings.showJoinDate}
                                    onValueChange={(value) => {
                                        const newSettings = {
                                            ...privacySettings,
                                            showJoinDate: value,
                                        };
                                        savePrivacySettings(newSettings);
                                    }}
                                    trackColor={{ false: theme.border, true: theme.primary }}
                                    thumbColor={privacySettings.showJoinDate ? theme.primary : theme.background}
                                    style={styles.privacySwitch}
                                />
                            </View>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    statsContainer: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    statsTitle: {
        fontSize: 20,
        fontWeight: "bold",
    },
    editButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: "600",
    },
    autoEditNotification: {
        borderLeftWidth: 4,
        padding: 12,
        marginBottom: 16,
        borderRadius: 8,
    },
    autoEditText: {
        fontSize: 14,
        fontWeight: "500",
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    simpleStatCard: {
        width: "48%",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    clickableCard: {
        width: "100%",
    },
    statValue: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        textAlign: "center",
    },
    clickHint: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: "500",
    },
    loadingText: {
        fontSize: 16,
        textAlign: "center",
        fontWeight: "500",
    },
    errorText: {
        fontSize: 16,
        textAlign: "center",
    },
    joinDateContainer: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: "#e9ecef",
    },
    joinDateContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    joinDateText: {
        fontSize: 16,
        fontWeight: "500",
    },
    joinDatePrivacy: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    privacyToggleLabel: {
        fontSize: 14,
    },
    privacySwitch: {
        transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
    },
});

// Export the component with a simple alias for backwards compatibility
export const StatsDashboard = UnifiedStatsDashboard;
