import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Modal,
    Alert,
} from 'react-native';
import { StarRatingInput } from './StarRatingInput';
import { GradeSelector } from './GradeSelector';
import { VideoLinkInput } from './VideoLinkInput';
import { useUserTagging } from '@/hooks/useUserTagging';
import { getTextAlign } from '@/utils/textUtils';

interface FeedbackFormProps {
    starRating: number;
    suggestedGrade: string;
    comment: string;
    videoUrl?: string;
    onStarRatingChange: (rating: number) => void;
    onGradeChange: (grade: string) => void;
    onCommentChange: (comment: string) => void;
    onVideoUrlChange?: (url: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    disabled?: boolean;
    errors?: {
        starRating?: string;
        comment?: string;
        videoUrl?: string;
    };
}

interface UserSuggestion {
    id: string;
    displayName: string;
    username?: string;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
    starRating,
    suggestedGrade,
    comment,
    videoUrl = '',
    onStarRatingChange,
    onGradeChange,
    onCommentChange,
    onVideoUrlChange,
    onSubmit,
    isSubmitting,
    disabled = false,
    errors = {},
}) => {
    const [textInputHeight, setTextInputHeight] = useState(80);
    const [isVideoLinkValid, setIsVideoLinkValid] = useState(true);

    const {
        showUserSuggestions,
        userSuggestions,
        isSearching,
        handleTextChange,
        selectUser,
        hideSuggestions,
    } = useUserTagging({
        onTextChange: onCommentChange,
    });

    const handleCommentChange = (text: string) => {
        handleTextChange(text);
    };

    const handleUserSelect = (user: UserSuggestion) => {
        const newText = selectUser(user, comment);
        onCommentChange(newText);
    };

    const handleSubmit = () => {
        if (starRating === 0) {
            Alert.alert('שגיאה', 'אנא בחר דירוג');
            return;
        }
        if (!comment.trim()) {
            Alert.alert('שגיאה', 'אנא הוסף תגובה');
            return;
        }
        if (!isVideoLinkValid) {
            Alert.alert('שגיאה', 'הלינק לסרטון לא תקין');
            return;
        }
        onSubmit();
    };

    return (
        <View style={styles.container}>
            {/* Star Rating */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>דירוג:</Text>
                <StarRatingInput
                    rating={starRating}
                    onRatingChange={onStarRatingChange}
                    disabled={disabled}
                />
                {errors.starRating && (
                    <Text style={styles.errorText}>{errors.starRating}</Text>
                )}
            </View>

            {/* Grade Selector */}
            <GradeSelector
                selectedGrade={suggestedGrade}
                onGradeChange={onGradeChange}
                disabled={disabled}
            />

            {/* Comment Input */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>תגובה:</Text>
                <TextInput
                    style={[
                        styles.commentInput,
                        {
                            height: Math.max(80, textInputHeight),
                            textAlign: getTextAlign(comment),
                        },
                        errors.comment && styles.inputError,
                    ]}
                    multiline
                    placeholder="שתף את החוויה שלך..."
                    placeholderTextColor="#999"
                    value={comment}
                    onChangeText={handleCommentChange}
                    onContentSizeChange={(e) => {
                        setTextInputHeight(e.nativeEvent.contentSize.height);
                    }}
                    editable={!disabled}
                    maxLength={500}
                />

                <View style={styles.commentFooter}>
                    {errors.comment && (
                        <Text style={styles.errorText}>{errors.comment}</Text>
                    )}
                    <Text style={styles.characterCount}>
                        {comment.length}/500
                    </Text>
                </View>
            </View>

            {/* Video Link Input */}
            {onVideoUrlChange && (
                <VideoLinkInput
                    value={videoUrl}
                    onChange={onVideoUrlChange}
                    onValidationChange={setIsVideoLinkValid}
                    disabled={disabled}
                />
            )}

            {/* User Suggestions Modal */}
            <Modal
                visible={showUserSuggestions}
                transparent
                animationType="fade"
                onRequestClose={hideSuggestions}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={hideSuggestions}
                >
                    <View style={styles.suggestionsContainer}>
                        {isSearching ? (
                            <Text style={styles.loadingText}>מחפש משתמשים...</Text>
                        ) : (
                            <FlatList
                                data={userSuggestions}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.suggestionItem}
                                        onPress={() => handleUserSelect(item)}
                                    >
                                        <Text style={styles.suggestionText}>
                                            {item.displayName}
                                        </Text>
                                        {item.username && (
                                            <Text style={styles.suggestionUsername}>
                                                @{item.username}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                                style={{ maxHeight: 200 }}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Submit Button */}
            <TouchableOpacity
                style={[
                    styles.submitButton,
                    (isSubmitting || disabled) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || disabled}
            >
                <Text style={styles.submitButtonText}>
                    {isSubmitting ? 'שולח...' : 'שלח משוב'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'right',
        color: '#333',
    },
    commentInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
        textAlignVertical: 'top',
    },
    inputError: {
        borderColor: '#ff6b6b',
    },
    commentFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    characterCount: {
        fontSize: 12,
        color: '#999',
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 12,
        textAlign: 'right',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    suggestionsContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        margin: 20,
        maxWidth: 300,
        maxHeight: 250,
    },
    loadingText: {
        padding: 16,
        textAlign: 'center',
        color: '#666',
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    suggestionText: {
        fontSize: 16,
        color: '#333',
        textAlign: 'right',
    },
    suggestionUsername: {
        fontSize: 12,
        color: '#666',
        textAlign: 'right',
        marginTop: 2,
    },
    submitButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    submitButtonDisabled: {
        backgroundColor: '#ccc',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
