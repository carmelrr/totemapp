import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { FeedbackItem } from './FeedbackItem';

interface Feedback {
    id: string;
    userDisplayName?: string;
    starRating: number;
    suggestedGrade?: string;
    comment?: string;
    createdAt?: any;
    userId: string;
}

interface FeedbackListProps {
    feedbacks: Feedback[];
    currentUserId?: string;
    isAdmin?: boolean;
    loading?: boolean;
    onEditFeedback?: (feedback: Feedback) => void;
    onDeleteFeedback?: (feedbackId: string) => void;
    onRefresh?: () => void;
    showStatistics?: boolean;
}

export const FeedbackList: React.FC<FeedbackListProps> = ({
    feedbacks,
    currentUserId,
    isAdmin = false,
    loading = false,
    onEditFeedback,
    onDeleteFeedback,
    onRefresh,
    showStatistics = true,
}) => {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!onRefresh) return;

        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    };

    const calculateStats = () => {
        if (feedbacks.length === 0) {
            return {
                averageRating: 0,
                totalCount: 0,
                gradeDistribution: {},
            };
        }

        const totalRating = feedbacks.reduce((sum, fb) => sum + fb.starRating, 0);
        const averageRating = totalRating / feedbacks.length;

        const gradeDistribution: Record<string, number> = {};
        feedbacks.forEach(fb => {
            if (fb.suggestedGrade) {
                gradeDistribution[fb.suggestedGrade] = (gradeDistribution[fb.suggestedGrade] || 0) + 1;
            }
        });

        return {
            averageRating: Math.round(averageRating * 10) / 10,
            totalCount: feedbacks.length,
            gradeDistribution,
        };
    };

    const stats = calculateStats();
    const sortedFeedbacks = [...feedbacks].sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;

        const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);

        return dateB.getTime() - dateA.getTime(); // Most recent first
    });

    const renderFeedbackItem = ({ item }: { item: Feedback }) => (
        <FeedbackItem
            feedback={item}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onEdit={onEditFeedback}
            onDelete={onDeleteFeedback}
        />
    );

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.title}>משובי משתמשים</Text>

            {showStatistics && feedbacks.length > 0 && (
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>דירוג ממוצע:</Text>
                        <Text style={styles.statValue}>
                            {stats.averageRating} ⭐ ({stats.totalCount} משובים)
                        </Text>
                    </View>

                    {Object.keys(stats.gradeDistribution).length > 0 && (
                        <View style={styles.gradeStats}>
                            <Text style={styles.statLabel}>דרגות מוצעות:</Text>
                            <View style={styles.gradeList}>
                                {Object.entries(stats.gradeDistribution)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([grade, count]) => (
                                        <Text key={grade} style={styles.gradeItem}>
                                            {grade} ({count})
                                        </Text>
                                    ))}
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>אין משובים עדיין</Text>
            <Text style={styles.emptySubText}>היה הראשון לשתף את החוויה שלך!</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}

            <FlatList
                data={sortedFeedbacks}
                renderItem={renderFeedbackItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.listContent,
                    sortedFeedbacks.length === 0 && styles.emptyList,
                ]}
                refreshControl={
                    onRefresh ? (
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#007AFF']}
                            tintColor={'#007AFF'}
                        />
                    ) : undefined
                }
                ListEmptyComponent={renderEmpty}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'right',
        color: '#333',
        marginBottom: 12,
    },
    statsContainer: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
    },
    statItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
        textAlign: 'right',
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    gradeStats: {
        marginTop: 8,
    },
    gradeList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    gradeItem: {
        fontSize: 12,
        color: '#007AFF',
        marginHorizontal: 4,
        marginVertical: 2,
    },
    listContent: {
        paddingHorizontal: 16,
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
});
