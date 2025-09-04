import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import RatingStars from './RatingStars';
import { THEME_COLORS } from '@/constants/colors';

interface FeedbackComposerProps {
  onSubmit: (text: string, rating?: number) => Promise<void>;
  placeholder?: string;
  showRating?: boolean;
  currentUserRating?: number;
}

export default function FeedbackComposer({
  onSubmit,
  placeholder = "כתוב את הפידבק שלך...",
  showRating = true,
  currentUserRating = 0,
}: FeedbackComposerProps) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(currentUserRating);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) {
      Alert.alert('שגיאה', 'אנא כתוב פידבק');
      return;
    }

    if (showRating && rating === 0) {
      Alert.alert('שגיאה', 'אנא בחר דירוג');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(text.trim(), showRating ? rating : undefined);
      setText('');
      if (showRating) setRating(0);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('שגיאה', 'נכשל בשליחת הפידבק');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {showRating && (
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>הדירוג שלי:</Text>
          <RatingStars
            rating={rating}
            onRatingChange={setRating}
            size="medium"
          />
        </View>
      )}
      
      <View style={styles.inputSection}>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          maxLength={500}
          textAlignVertical="top"
        />
        
        <View style={styles.footer}>
          <Text style={styles.charCount}>{text.length}/500</Text>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!text.trim() || (showRating && rating === 0) || isSubmitting) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!text.trim() || (showRating && rating === 0) || isSubmitting}
          >
            <Text style={[
              styles.submitButtonText,
              (!text.trim() || (showRating && rating === 0) || isSubmitting) && styles.submitButtonTextDisabled
            ]}>
              {isSubmitting ? 'שולח...' : 'שלח'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME_COLORS.text,
    marginRight: 12,
  },
  inputSection: {
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: THEME_COLORS.text,
    minHeight: 80,
    maxHeight: 120,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  submitButton: {
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
