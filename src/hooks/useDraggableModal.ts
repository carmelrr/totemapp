import { useRef, useState } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';

interface UseDraggableModalProps {
    initialHeight: number;
    onClose: () => void;
    minHeight?: number;
    maxHeight?: number;
    closeThreshold?: number;
}

export const useDraggableModal = ({
    initialHeight,
    onClose,
    minHeight = 80,
    maxHeight = Dimensions.get('window').height - 100,
    closeThreshold = 150,
}: UseDraggableModalProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [currentHeight, setCurrentHeight] = useState(initialHeight);

    const translateY = useRef(new Animated.Value(0)).current;
    const startingHeight = useRef(initialHeight);
    const actualHeight = useRef(initialHeight);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Allow vertical drags
                return Math.abs(gestureState.dy) > 5;
            },
            onPanResponderGrant: () => {
                setIsDragging(true);
                // Store the actual current height when drag begins
                startingHeight.current = actualHeight.current;
            },
            onPanResponderMove: (evt, gestureState) => {
                // Calculate new height based on drag from starting position
                // Negative dy means dragging up (increase height)
                // Positive dy means dragging down (decrease height)
                const newHeight = Math.max(
                    minHeight,
                    Math.min(maxHeight, startingHeight.current - gestureState.dy),
                );

                // Update both the state and the ref immediately
                actualHeight.current = newHeight;
                setCurrentHeight(newHeight);
            },
            onPanResponderRelease: () => {
                setIsDragging(false);

                // If dragged below threshold, close the modal
                if (actualHeight.current < closeThreshold) {
                    onClose();
                }
            },
        }),
    ).current;

    const resetHeight = () => {
        setCurrentHeight(initialHeight);
        startingHeight.current = initialHeight;
        actualHeight.current = initialHeight;
    };

    return {
        isDragging,
        currentHeight,
        panResponder,
        resetHeight,
    };
};
