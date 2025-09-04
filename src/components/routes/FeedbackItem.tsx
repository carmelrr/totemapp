import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { THEME_COLORS } from '@/constants/colors';
import { Feedback } from '../../types/routes';

interface FeedbackItemProps {
  feedback: Feedback;
}

export default function FeedbackItem({ feedback }: FeedbackItemProps) {
  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'זה עתה';
    if (diffInHours < 24) return `לפני ${diffInHours} שעות`;
    if (diffInHours < 48) return 'אתמול';
    
    return date.toLocaleDateString('he-IL');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{feedback.user.displayName}</Text>
          <Text style={styles.timestamp}>{formatDate(feedback.createdAt)}</Text>
        </View>
        {feedback.rating && (
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>★ {feedback.rating}</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.text}>{feedback.text}</Text>
      
      {feedback.media && (
        <View style={styles.mediaContainer}>
          <Image source={{ uri: feedback.media }} style={styles.media} />
        </View>
      )}
      
      {feedback.likes && feedback.likes > 0 && (
        <View style={styles.likesContainer}>
          <Text style={styles.likes}>❤️ {feedback.likes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '500',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  mediaContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  likesContainer: {
    marginTop: 8,
  },
  likes: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
