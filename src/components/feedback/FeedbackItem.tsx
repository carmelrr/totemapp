import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StarRatingInput } from './StarRatingInput';
import { VideoLinkButton } from './VideoLinkButton';
import { CachedAvatar } from '@/components/ui/CachedAvatar';
import { getTextAlign, formatDisplayName } from '@/utils/textUtils';
import { useLanguage } from '@/features/language';
import { useTheme } from '@/features/theme/ThemeContext';

interface FeedbackItemProps {
    feedback: {
        id: string;
        userDisplayName?: string;
        userPhotoURL?: string;
        starRating: number;
        suggestedGrade?: string;
        comment?: string;
        videoUrl?: string;
        createdAt?: any;
        userId: string;
    };
    currentUserId?: string;
    isAdmin?: boolean;
    onEdit?: (feedback: any) => void;
    onDelete?: (feedbackId: string) => void;
}

export const FeedbackItem = React.memo<FeedbackItemProps>(({
    feedback,
    currentUserId,
    isAdmin = false,
    onEdit,
    onDelete,
}) => {
    const { t, language } = useLanguage();
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const canEdit = feedback.userId === currentUserId;
    const canDelete = canEdit || isAdmin;

    const handleDelete = () => {
        Alert.alert(
            t.routes.deleteFeedback,
            t.routes.deleteFeedbackConfirm,
            [
                { text: t.common.cancel, style: 'cancel' },
                {
                    text: t.common.delete,
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

        return date.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
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
                <CachedAvatar
                    photoURL={feedback.userPhotoURL}
                    displayName={feedback.userDisplayName}
                    size={40}
                    showBorder={true}
                />
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
                                <Text style={styles.editButtonText}>{t.feedbackList.edit}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={handleDelete}
                        >
                            <Text style={styles.deleteButtonText}>{t.common.delete}</Text>
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
                    <Text style={styles.gradeLabel}>{t.feedbackList.suggestedGrade}</Text>
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

            {/* Video Link Button */}
            {feedback.videoUrl && (
                <VideoLinkButton url={feedback.videoUrl} />
            )}
        </View>
    );
});

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        backgroundColor: theme.surface,
        padding: 16,
        marginVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    userInfo: {
        flex: 1,
        marginStart: 8,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.text,
    },
    date: {
        fontSize: 12,
        color: theme.textSecondary,
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: theme.card,
    },
    editButtonText: {
        fontSize: 12,
        color: theme.primary,
        fontWeight: '600',
    },
    deleteButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: theme.isDark ? 'rgba(255,68,68,0.15)' : '#ffe6e6',
    },
    deleteButtonText: {
        fontSize: 12,
        color: theme.error,
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
        color: theme.textSecondary,
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
        color: theme.textSecondary,
    },
    gradeBadge: {
        backgroundColor: theme.isDark ? 'rgba(25,118,210,0.15)' : '#e3f2fd',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    gradeText: {
        fontSize: 12,
        color: theme.primary,
        fontWeight: '600',
    },
    comment: {
        fontSize: 14,
        lineHeight: 20,
        color: theme.text,
    },
});
