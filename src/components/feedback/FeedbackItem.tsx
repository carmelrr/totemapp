import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StarRatingInput } from './StarRatingInput';
import { getTextAlign, formatDisplayName } from '@/utils/textUtils';

interface FeedbackItemProps {
    feedback: {
        id: string;
        userDisplayName?: string;
        starRating: number;
        suggestedGrade?: string;
        comment?: string;
        createdAt?: any;
        userId: string;
    };
    currentUserId?: string;
    isAdmin?: boolean;
    onEdit?: (feedback: any) => void;
    onDelete?: (feedbackId: string) => void;
}

export const FeedbackItem: React.FC<FeedbackItemProps> = ({
    feedback,
    currentUserId,
    isAdmin = false,
    onEdit,
    onDelete,
}) => {
    const canEdit = feedback.userId === currentUserId;
    const canDelete = canEdit || isAdmin;

    const handleDelete = () => {
        Alert.alert(
            'מחיקת משוב',
            'האם אתה בטוח שברצונך למחוק את המשוב?',
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: () => onDelete?.(feedback.id),
                },
            ]
        );
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';

        let date: Date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else {
            date = new Date(timestamp);
        }

        return date.toLocaleDateString('he-IL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                        {formatDisplayName(feedback.userDisplayName)}
                    </Text>
                    <Text style={styles.date}>
                        {formatDate(feedback.createdAt)}
                    </Text>
                </View>

                {canDelete && (
                    <View style={styles.actions}>
                        {canEdit && onEdit && (
                            <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => onEdit(feedback)}
                            >
                                <Text style={styles.editButtonText}>ערוך</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={handleDelete}
                        >
                            <Text style={styles.deleteButtonText}>מחק</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Rating */}
            <View style={styles.ratingContainer}>
                <StarRatingInput
                    rating={feedback.starRating}
                    onRatingChange={() => { }} // Read-only
                    disabled={true}
                    size={20}
                    showLabels={false}
                />
                <Text style={styles.ratingText}>
                    ({feedback.starRating}/5)
                </Text>
            </View>

            {/* Suggested Grade */}
            {feedback.suggestedGrade && (
                <View style={styles.gradeContainer}>
                    <Text style={styles.gradeLabel}>דרגה מוצעת:</Text>
                    <View style={styles.gradeBadge}>
                        <Text style={styles.gradeText}>{feedback.suggestedGrade}</Text>
                    </View>
                </View>
            )}

            {/* Comment */}
            {feedback.comment && (
                <Text style={[
                    styles.comment,
                    { textAlign: getTextAlign(feedback.comment) }
                ]}>
                    {feedback.comment}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        padding: 16,
        marginVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'right',
    },
    date: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
        textAlign: 'right',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#f0f0f0',
    },
    editButtonText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
    },
    deleteButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#ffe6e6',
    },
    deleteButtonText: {
        fontSize: 12,
        color: '#ff4444',
        fontWeight: '600',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 8,
        gap: 8,
    },
    ratingText: {
        fontSize: 14,
        color: '#666',
    },
    gradeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 12,
        gap: 8,
    },
    gradeLabel: {
        fontSize: 14,
        color: '#666',
    },
    gradeBadge: {
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    gradeText: {
        fontSize: 12,
        color: '#1976d2',
        fontWeight: '600',
    },
    comment: {
        fontSize: 14,
        lineHeight: 20,
        color: '#333',
    },
});
