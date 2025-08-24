import React from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    Switch,
    StyleSheet
} from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { GradeStatsMap, PrivacySettings, UserStats } from "../../screens/profile/types";

interface GradeStatsModalProps {
    // Common props
    visible: boolean;
    onClose: () => void;
    gradeStats: GradeStatsMap;

    // Simple mode props (ProfileScreen)
    stats?: UserStats | null;
    privacySettings?: PrivacySettings;
    onPrivacyChange?: (key: keyof PrivacySettings, value: boolean) => void;

    // Detailed mode props (UserProfileScreen)
    showStatsModal?: boolean;
    setShowStatsModal?: (show: boolean) => void;
    allRoutes?: any[];

    // Display mode
    mode?: 'simple' | 'detailed';
}

export const UnifiedGradeStatsModal: React.FC<GradeStatsModalProps> = ({
    visible,
    onClose,
    gradeStats,
    stats,
    privacySettings,
    onPrivacyChange,
    showStatsModal,
    setShowStatsModal,
    allRoutes = [],
    mode = 'simple'
}) => {
    const { theme } = useTheme();

    // Use the appropriate visibility prop based on mode
    const isVisible = mode === 'simple' ? visible : showStatsModal;
    const handleClose = mode === 'simple' ? onClose : () => setShowStatsModal?.(false);

    const sortedGrades = Object.keys(gradeStats).sort((a, b) => {
        const gradeOrder: Record<string, number> = {
            V1: 1, V2: 2, V3: 3, V4: 4, V5: 5,
            V6: 6, V7: 7, V8: 8, V9: 9, V10: 10,
        };
        return (gradeOrder[a] || 999) - (gradeOrder[b] || 999);
    });

    const totalRoutes = mode === 'detailed' ? allRoutes.length :
        Object.values(gradeStats).reduce((sum: number, stat: any) => sum + (stat.total || 0), 0);

    const totalCompleted = Object.values(gradeStats).reduce(
        (sum: number, stat: any) => sum + (stat.completed || 0),
        0,
    );

    const overallPercentage =
        totalRoutes > 0
            ? ((totalCompleted / totalRoutes) * 100).toFixed(1)
            : "0.0";

    // For simple mode, check if grade stats should be shown
    if (mode === 'simple' && privacySettings && !privacySettings.showGradeStats) {
        return null;
    }

    // For detailed mode, check the specific privacy setting
    if (mode === 'detailed' && !privacySettings?.showGradeStats) {
        return null;
    }

    return (
        <Modal
            visible={isVisible || false}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                        📈 אחוזי סגירה לפי דירוג
                    </Text>
                    <TouchableOpacity
                        style={[styles.modalCloseButton, { backgroundColor: theme.surface }]}
                        onPress={handleClose}
                    >
                        <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.overallStatsContainer, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.overallStatsText, { color: theme.text }]}>
                        סיכום כללי: {totalCompleted} מתוך {totalRoutes} מסלולים ({overallPercentage}%)
                    </Text>
                </View>

                <ScrollView style={styles.modalContent}>
                    {sortedGrades.map((grade) => {
                        const stat = gradeStats[grade];
                        const progressWidth = stat.percentage;

                        return (
                            <View key={grade} style={[styles.gradeStatRow, { backgroundColor: theme.surface }]}>
                                <View style={styles.gradeStatHeader}>
                                    <Text style={[styles.gradeLabel, { color: theme.text }]}>{grade}</Text>
                                    <Text style={[styles.gradePercentage, { color: theme.textSecondary }]}>
                                        {stat.percentage}%
                                    </Text>
                                </View>

                                <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
                                    <View
                                        style={[
                                            styles.progressBar,
                                            {
                                                width: `${progressWidth}%`,
                                                backgroundColor:
                                                    progressWidth === 100
                                                        ? "#28a745"
                                                        : progressWidth >= 75
                                                            ? "#ffc107"
                                                            : progressWidth >= 50
                                                                ? "#fd7e14"
                                                                : progressWidth >= 25
                                                                    ? "#17a2b8"
                                                                    : "#dc3545",
                                            },
                                        ]}
                                    />
                                </View>

                                <Text style={[styles.gradeStatDetails, { color: theme.textSecondary }]}>
                                    {stat.completed} מתוך {stat.total} מסלולים
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Privacy Settings for Simple Mode */}
                {mode === 'simple' && privacySettings && onPrivacyChange && (
                    <View style={[styles.privacySection, { borderTopColor: theme.border }]}>
                        <Text style={[styles.privacySectionTitle, { color: theme.text }]}>הגדרות פרטיות</Text>
                        <View style={styles.privacyOption}>
                            <Text style={[styles.privacyLabel, { color: theme.textSecondary }]}>
                                הצג סטטיסטיקות דירוגים לאחרים
                            </Text>
                            <Switch
                                value={privacySettings.showGradeStats}
                                onValueChange={(value) => onPrivacyChange('showGradeStats', value)}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor={privacySettings.showGradeStats ? theme.primary : theme.background}
                            />
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        borderBottomWidth: 1,
        paddingTop: 60,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    modalCloseText: {
        fontSize: 18,
        fontWeight: "bold",
    },
    overallStatsContainer: {
        padding: 16,
        margin: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#8e44ad",
    },
    overallStatsText: {
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    gradeStatRow: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    gradeStatHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    gradeLabel: {
        fontSize: 18,
        fontWeight: "bold",
    },
    gradePercentage: {
        fontSize: 16,
        fontWeight: "600",
    },
    progressBarContainer: {
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
    },
    progressBar: {
        height: "100%",
        borderRadius: 4,
    },
    gradeStatDetails: {
        fontSize: 14,
        textAlign: "center",
    },
    privacySection: {
        borderTopWidth: 1,
        padding: 20,
    },
    privacySectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
    },
    privacyOption: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    privacyLabel: {
        fontSize: 16,
        flex: 1,
    },
});

// Export with simple alias for backwards compatibility
export const GradeStatsModal = UnifiedGradeStatsModal;
