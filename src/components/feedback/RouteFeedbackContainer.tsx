import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Text,
} from 'react-native';
import { auth } from '@/features/data/firebase';
import { FeedbackService } from '@/features/routes-map/services/FeedbackService';
import { tagUsersInFeedback } from '@/features/social/socialService';
import { useUser } from '@/features/auth/UserContext';

import { DraggableModal } from '@/components/ui/DraggableModal';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackList } from './FeedbackList';
import { useFeedbackForm } from '@/hooks/useFeedbackForm';

interface Route {
    id: string;
    name: string;
    grade?: string;
    // Add other route properties as needed
}

interface Feedback {
    id: string;
    userDisplayName?: string;
    starRating: number;
    suggestedGrade?: string;
    comment?: string;
    createdAt?: any;
    userId: string;
}

interface RouteFeedbackContainerProps {
    route: Route;
    visible: boolean;
    onClose: () => void;
    isAdmin?: boolean;
}

export const RouteFeedbackContainer: React.FC<RouteFeedbackContainerProps> = ({
    route,
    visible,
    onClose,
    isAdmin = false,
}) => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [userFeedback, setUserFeedback] = useState<Feedback | null>(null);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [loading, setLoading] = useState(false);

    const { isAdmin: userIsAdmin } = useUser();
    const user = auth.currentUser;
    const actualIsAdmin = isAdmin || userIsAdmin;

    // Form management
    const {
        formData,
        errors,
        isSubmitting,
        updateField,
        handleSubmit,
        resetForm,
        updateFormData,
    } = useFeedbackForm({
        onSubmit: handleFeedbackSubmit,
    });

    // Load feedbacks when route changes
    useEffect(() => {
        if (!route?.id) return;

        const unsubscribe = FeedbackService.subscribeFeedbacksForRoute(
            route.id,
            (fetchedFeedbacks) => {
                setFeedbacks(fetchedFeedbacks);

                // Find current user's feedback
                const currentUserFeedback = fetchedFeedbacks.find(
                    (fb) => fb.userId === user?.uid
                );
                setUserFeedback(currentUserFeedback || null);

                // If editing and user has feedback, populate form
                if (currentUserFeedback && isEditingFeedback) {
                    updateFormData({
                        starRating: currentUserFeedback.starRating,
                        suggestedGrade: currentUserFeedback.suggestedGrade || '',
                        comment: currentUserFeedback.comment || '',
                        closedRoute: true,
                    });
                }
            }
        );

        return unsubscribe;
    }, [route?.id, user?.uid, isEditingFeedback, updateFormData]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (visible) {
            if (userFeedback && !isEditingFeedback) {
                // Show existing feedback data but don't allow editing
                updateFormData({
                    starRating: userFeedback.starRating,
                    suggestedGrade: userFeedback.suggestedGrade || '',
                    comment: userFeedback.comment || '',
                    closedRoute: true,
                });
            } else {
                resetForm();
            }
        }
    }, [visible, userFeedback, isEditingFeedback, updateFormData, resetForm]);

    async function handleFeedbackSubmit(data: any) {
        if (!user || !route) {
            Alert.alert('שגיאה', 'משתמש או מסלול לא נמצאו');
            return;
        }

        try {
            const feedbackData = {
                userId: user.uid,
                userDisplayName: user.displayName || 'Anonymous',
                starRating: data.starRating,
                suggestedGrade: data.suggestedGrade,
                comment: data.comment,
                isCompleted: data.closedRoute,
            };

            if (userFeedback && isEditingFeedback) {
                // Update existing feedback
                await FeedbackService.updateFeedback(userFeedback.id, feedbackData);
                Alert.alert('הצלחה', 'המשוב עודכן בהצלחה');
            } else {
                // Add new feedback
                await FeedbackService.addFeedbackToRoute(route.id, feedbackData);

                // Tag users mentioned in the comment
                if (data.comment) {
                    try {
                        // Extract user IDs from mentions - this would need to be implemented
                        // For now, skip the tagging functionality
                        // await tagUsersInFeedback(feedbackId, route.id, taggedUserIds, data.comment);
                    } catch (error) {
                        console.warn('Failed to tag users:', error);
                    }
                }

                Alert.alert('הצלחה', 'המשוב נשלח בהצלחה');
            }

            setIsEditingFeedback(false);
            resetForm();
        } catch (error) {
            console.error('Error submitting feedback:', error);
            Alert.alert('שגיאה', 'שגיאה בשליחת המשוב');
            throw error;
        }
    }

    const handleEditFeedback = (feedback: Feedback) => {
        if (feedback.userId !== user?.uid && !actualIsAdmin) return;

        setIsEditingFeedback(true);
        updateFormData({
            starRating: feedback.starRating,
            suggestedGrade: feedback.suggestedGrade || '',
            comment: feedback.comment || '',
            closedRoute: true,
        });
    };

    const handleDeleteFeedback = async (feedbackId: string) => {
        try {
            await FeedbackService.deleteFeedback(feedbackId);
            Alert.alert('הצלחה', 'המשוב נמחק בהצלחה');
        } catch (error) {
            console.error('Error deleting feedback:', error);
            Alert.alert('שגיאה', 'שגיאה במחיקת המשוב');
        }
    };

    const handleCancel = () => {
        setIsEditingFeedback(false);
        resetForm();
    };

    const showForm = !userFeedback || isEditingFeedback;

    return (
        <DraggableModal
            visible={visible}
            onClose={onClose}
            title={`משוב - ${route?.name || 'מסלול'}`}
            initialHeight={500}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Feedback Form */}
                    {showForm && (
                        <View style={styles.formSection}>
                            <FeedbackForm
                                starRating={formData.starRating}
                                suggestedGrade={formData.suggestedGrade}
                                comment={formData.comment}
                                onStarRatingChange={(rating) => updateField('starRating', rating)}
                                onGradeChange={(grade) => updateField('suggestedGrade', grade)}
                                onCommentChange={(comment) => updateField('comment', comment)}
                                onSubmit={handleSubmit}
                                isSubmitting={isSubmitting}
                                errors={errors}
                            />

                            {isEditingFeedback && (
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={handleCancel}
                                    >
                                        <Text style={styles.cancelButtonText}>ביטול</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Feedback List */}
                    <FeedbackList
                        feedbacks={feedbacks}
                        currentUserId={user?.uid}
                        isAdmin={actualIsAdmin}
                        loading={loading}
                        onEditFeedback={handleEditFeedback}
                        onDeleteFeedback={handleDeleteFeedback}
                        showStatistics={true}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </DraggableModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    formSection: {
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginBottom: 16,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    cancelButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    cancelButtonText: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
    },
});
