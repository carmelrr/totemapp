import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
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
    const { t, language } = useLanguage();
    const layout = useResponsiveLayout();
    const { isLandscape, width: screenWidth } = layout;
    const insets = useSafeAreaInsets();
    
    const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);

    // Simple mode (for ProfileScreen)
    if (mode === 'simple') {
        if (loading) {
            return (
                <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.loadingText, { color: theme.text }]}>{t.profile.loadingStats}</Text>
                </View>
            );
        }

        if (!stats) {
            return (
                <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                        {t.profile.noStatsAvailable}
                    </Text>
                </View>
            );
        }

        return (
            <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
                <Text style={[styles.statsTitle, { color: theme.text }]}>📊 {t.profile.myStats}</Text>

                <View style={styles.statsGrid}>
                    <View style={[styles.simpleStatCard, { backgroundColor: theme.background }]}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalRoutesSent}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.routes.completed}</Text>
                    </View>

                    <View style={[styles.simpleStatCard, { backgroundColor: theme.background }]}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.highestGrade}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.profile.highestGrade}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.simpleStatCard, styles.clickableCard, { backgroundColor: theme.background }]}
                        onPress={onStatsPress}
                    >
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.completionPercentage || 0}%</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.profile.completionRate}</Text>
                        <Text style={[styles.clickHint, { color: theme.primary }]}>{t.routes.clickForDetails}</Text>
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
                    {isVisible || isOwner ? value : `🔒 ${t.profile.private}`}
                </Text>
            </View>
        );
    };

    return (
        <View style={[styles.statsContainer, { backgroundColor: theme.surface }]}>
            <View style={styles.statsHeader}>
                <Text style={[styles.statsTitle, { color: theme.text }]}>
                    📊 {t.profile.statistics}
                </Text>
            </View>

            {userStats && privacySettings && (
                <View style={styles.statsList}>
                    <StatListItem 
                        icon="⭐" 
                        title={t.profile.avgRating}
                        value={userStats.averageStarRating ? userStats.averageStarRating.toFixed(1) : t.common.noResults}
                        isVisible={privacySettings.showAverageRating}
                    />
                    <StatListItem 
                        icon="🎯" 
                        title={t.routes.completed}
                        value={userStats.totalRoutesSent}
                        isVisible={privacySettings.showTotalRoutes}
                    />
                    <StatListItem 
                        icon="💬" 
                        title={t.profile.feedbacks}
                        value={userStats.totalFeedbacks}
                        isVisible={privacySettings.showTotalRoutes}
                    />
                    <StatListItem 
                        icon="📈" 
                        title={t.profile.completionRate}
                        value={`${userStats.completionPercentage || 0}%`}
                        isVisible={privacySettings.showGradeStats}
                    />
                    <StatListItem 
                        icon="🏆" 
                        title={t.profile.highestGrade}
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
                                <Text style={[styles.statListTitle, { color: theme.textSecondary }]}>{t.profile.gradeStats}</Text>
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
                            🗓️ {t.profile.memberSince}: {userStats.joinDate.toLocaleDateString(language === 'he' ? "he-IL" : "en-US")}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const createStyles = (theme: any, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number; top: number; bottom: number }) => {
    const isLandscape = layout?.isLandscape ?? false;
    const screenWidth = layout?.width ?? 375;
    const isTablet = layout?.isTablet ?? false;
    const isPhoneLandscape = !isTablet && isLandscape;
    
    // Account for safe areas in phone landscape
    const safeLeft = insets?.left ?? 0;
    const safeRight = insets?.right ?? 0;
    const horizontalPadding = isPhoneLandscape ? 16 : (isLandscape ? 24 : 20);
    const totalHorizontalPadding = horizontalPadding * 2 + safeLeft + safeRight;
    const landscapeColumnWidth = isLandscape ? (screenWidth - totalHorizontalPadding - 24) / 2 : screenWidth - 40;

    return StyleSheet.create({
        statsContainer: {
            borderRadius: isLandscape ? 16 : 20,
            padding: isPhoneLandscape ? 12 : (isLandscape ? 16 : 20),
            marginBottom: isLandscape ? 0 : 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
            width: isLandscape ? landscapeColumnWidth : '100%',
        },
        statsHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: isLandscape ? 12 : 20,
        },
        statsTitle: {
            fontSize: isLandscape ? 16 : 20,
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
            borderStartWidth: 4,
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
            padding: isLandscape ? 12 : 16,
            borderRadius: 12,
            marginBottom: isLandscape ? 8 : 12,
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
            fontSize: isLandscape ? 18 : 24,
            fontWeight: "bold",
            marginBottom: 4,
        },
        statLabel: {
            fontSize: isLandscape ? 12 : 14,
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
            marginTop: isLandscape ? 12 : 20,
            paddingTop: isLandscape ? 12 : 20,
            borderTopWidth: 1,
            borderTopColor: "#e9ecef",
        },
        joinDateContent: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
        },
        joinDateText: {
            fontSize: isLandscape ? 14 : 16,
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
            paddingVertical: isLandscape ? 10 : 14,
            paddingHorizontal: 4,
            borderBottomWidth: 1,
        },
        statListClickable: {
            paddingEnd: 0,
        },
        statListLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: isLandscape ? 8 : 12,
        },
        statListRight: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        statListIcon: {
            fontSize: isLandscape ? 16 : 20,
        },
        statListTitle: {
            fontSize: isLandscape ? 13 : 15,
            fontWeight: "500",
        },
        statListValue: {
            fontSize: isLandscape ? 14 : 16,
            fontWeight: "bold",
        },
        statListArrow: {
            fontSize: 18,
            fontWeight: "bold",
        },
    });
};

// Export the component with a simple alias for backwards compatibility
export const StatsDashboard = UnifiedStatsDashboard;
