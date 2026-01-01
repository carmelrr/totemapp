import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
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

    // Simple list item for viewing other users' stats
    const StatListItem = ({ icon, title, value, isVisible }: { icon: string; title: string; value: string | number; isVisible: boolean }) => {
        if (!isVisible && !isOwner) return null;
        return (
            <View style={[styles.statListItem, { borderBottomColor: theme.border }]}>
                <View style={styles.statListLeft}>
                    <Text style={styles.statListIcon}>{icon}</Text>
                    <Text style={[styles.statListTitle, { color: theme.textSecondary }]}>{title}</Text>
                </View>
                <Text style={[styles.statListValue, { color: theme.text }]}>
                    {isVisible || isOwner ? value : "🔒 פרטי"}
                </Text>
            </View>
        );
    };

    return (
        <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
            <View style={styles.statsHeader}>
                <Text style={[styles.statsTitle, { color: theme.text }]}>
                    📊{" "}
                    {isOwner
                        ? "הסטטיסטיקות שלי"
                        : `הסטטיסטיקות של ${userProfile?.displayName}`}
                </Text>
            </View>

            {userStats && privacySettings && (
                <View style={styles.statsList}>
                    <StatListItem 
                        icon="⭐" 
                        title="ממוצע דירוג" 
                        value={userStats.averageStarRating ? userStats.averageStarRating.toFixed(1) + " ⭐" : "אין"}
                        isVisible={privacySettings.showAverageRating}
                    />
                    <StatListItem 
                        icon="🎯" 
                        title="מסלולים שסגר" 
                        value={userStats.totalRoutesSent}
                        isVisible={privacySettings.showTotalRoutes}
                    />
                    <StatListItem 
                        icon="💬" 
                        title="סה״כ תגובות" 
                        value={userStats.totalFeedbacks}
                        isVisible={privacySettings.showFeedbackCount}
                    />
                    <StatListItem 
                        icon="📈" 
                        title="אחוז סגירה (על הקיר)" 
                        value={`${userStats.completionPercentage || 0}%`}
                        isVisible={privacySettings.showGradeStats}
                    />
                    <StatListItem 
                        icon="🏆" 
                        title="דירוג הכי גבוה" 
                        value={userStats.highestGrade}
                        isVisible={privacySettings.showHighestGrade}
                    />
                    
                    {/* Clickable item for grade breakdown - only if grade stats are visible */}
                    {(privacySettings.showGradeStats || isOwner) && (
                        <TouchableOpacity 
                            style={[styles.statListItem, styles.statListClickable, { borderBottomColor: theme.border }]}
                            onPress={() => setShowStatsModal?.(true)}
                        >
                            <View style={styles.statListLeft}>
                                <Text style={styles.statListIcon}>📊</Text>
                                <Text style={[styles.statListTitle, { color: theme.textSecondary }]}>אחוזי סגירה לפי דירוג</Text>
                            </View>
                            <View style={styles.statListRight}>
                                <Text style={[styles.statListValue, { color: theme.text }]}>{overallPercentage}%</Text>
                                <Text style={[styles.statListArrow, { color: theme.primary }]}>→</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {userStats && userStats.joinDate && privacySettings && (privacySettings.showJoinDate || isOwner) && (
                <View style={styles.joinDateContainer}>
                    <View style={styles.joinDateContent}>
                        <Text style={[styles.joinDateText, { color: theme.textSecondary }]}>
                            🗓️ חבר מאז: {userStats.joinDate.toLocaleDateString("he-IL")}
                        </Text>
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
        justifyContent: "center",
        alignItems: "center",
    },
    joinDateText: {
        fontSize: 16,
        fontWeight: "500",
    },
    // New list-style stats
    statsList: {
        marginTop: 8,
    },
    statListItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
    },
    statListClickable: {
        paddingRight: 0,
    },
    statListLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    statListRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    statListIcon: {
        fontSize: 20,
    },
    statListTitle: {
        fontSize: 15,
        fontWeight: "500",
    },
    statListValue: {
        fontSize: 16,
        fontWeight: "bold",
    },
    statListArrow: {
        fontSize: 18,
        fontWeight: "bold",
    },
});

// Export the component with a simple alias for backwards compatibility
export const StatsDashboard = UnifiedStatsDashboard;
