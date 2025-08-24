import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface StarRatingInputProps {
    rating: number;
    onRatingChange: (rating: number) => void;
    disabled?: boolean;
    size?: number;
    color?: string;
    showLabels?: boolean;
}

const STAR_LABELS = ['גרוע', 'בסדר', 'טוב', 'מעולה', 'מושלם'];

export const StarRatingInput: React.FC<StarRatingInputProps> = ({
    rating,
    onRatingChange,
    disabled = false,
    size = 30,
    color = '#FFD700',
    showLabels = true,
}) => {
    const stars = [1, 2, 3, 4, 5];

    return (
        <View style={styles.container}>
            <View style={styles.starsContainer}>
                {stars.map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => !disabled && onRatingChange(star)}
                        disabled={disabled}
                        style={[
                            styles.starButton,
                            { width: size, height: size },
                            disabled && styles.disabled,
                        ]}
                    >
                        <Text
                            style={[
                                styles.star,
                                { fontSize: size * 0.8, color: star <= rating ? color : '#ccc' },
                            ]}
                        >
                            ★
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {showLabels && rating > 0 && (
                <Text style={styles.ratingLabel}>
                    {STAR_LABELS[rating - 1]}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    starButton: {
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 2,
    },
    star: {
        fontWeight: 'bold',
    },
    disabled: {
        opacity: 0.5,
    },
    ratingLabel: {
        marginTop: 8,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        fontFamily: 'system',
    },
});
