import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';

interface RatingStarsProps {
  rating?: number;
  maxRating?: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'small' | 'medium' | 'large';
  showRatingText?: boolean;
}

export default function RatingStars({
  rating = 0,
  maxRating = 5,
  onRatingChange,
  readonly = false,
  size = 'medium',
  showRatingText = false,
}: RatingStarsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [tempRating, setTempRating] = useState<number | null>(null);
  
  const currentRating = tempRating !== null ? tempRating : rating;
  
  const starSize = {
    small: 16,
    medium: 24,
    large: 32,
  }[size];

  const renderStar = (index: number) => {
    const starNumber = index + 1;
    const isFilled = starNumber <= currentRating;
    
    if (readonly) {
      return (
        <View key={index} style={[styles.star, { width: starSize, height: starSize }]}>
          <Text style={[styles.starText, { fontSize: starSize }, isFilled ? styles.filledStar : styles.emptyStar]}>
            ★
          </Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        style={[styles.star, { width: starSize, height: starSize }]}
        onPress={() => onRatingChange?.(starNumber)}
        onPressIn={() => setTempRating(starNumber)}
        onPressOut={() => setTempRating(null)}
        activeOpacity={0.7}
      >
        <Text style={[styles.starText, { fontSize: starSize }, isFilled ? styles.filledStar : styles.emptyStar]}>
          ★
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {Array.from({ length: maxRating }, (_, index) => renderStar(index))}
      </View>
      {showRatingText && (
        <Text style={styles.ratingText}>
          {currentRating.toFixed(1)} / {maxRating}
        </Text>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  starText: {
    textAlign: 'center',
  },
  filledStar: {
    color: theme.starColor,
  },
  emptyStar: {
    color: theme.border,
  },
  ratingText: {
    marginTop: 4,
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
});
