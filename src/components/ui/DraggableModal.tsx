import React, { ReactNode } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Dimensions,
} from 'react-native';
import { useDraggableModal } from '@/hooks/useDraggableModal';
import { useTheme } from '@/features/theme/ThemeContext';

interface DraggableModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    initialHeight?: number;
    showCloseButton?: boolean;
    showDragHandle?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_INITIAL_HEIGHT = SCREEN_HEIGHT * 0.6;

export const DraggableModal: React.FC<DraggableModalProps> = ({
    visible,
    onClose,
    title,
    children,
    initialHeight = DEFAULT_INITIAL_HEIGHT,
    showCloseButton = true,
    showDragHandle = true,
}) => {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const { isDragging, currentHeight, panResponder, resetHeight } = useDraggableModal({
        initialHeight,
        onClose,
    });

    React.useEffect(() => {
        if (visible) {
            resetHeight();
        }
    }, [visible, resetHeight]);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Background tap to close */}
                <TouchableOpacity
                    style={[styles.background, { height: SCREEN_HEIGHT - currentHeight }]}
                    onPress={onClose}
                    activeOpacity={1}
                />

                {/* Modal Content */}
                <View
                    style={[
                        styles.container,
                        { height: currentHeight },
                        isDragging && styles.dragging,
                    ]}
                    {...panResponder.panHandlers}
                >
                    {/* Drag Handle */}
                    {showDragHandle && (
                        <View style={styles.dragHandle}>
                            <View style={styles.dragIndicator} />
                        </View>
                    )}

                    {/* Header */}
                    {(title || showCloseButton) && (
                        <View style={styles.header}>
                            {showCloseButton && (
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={onClose}
                                >
                                    <Text style={styles.closeButtonText}>×</Text>
                                </TouchableOpacity>
                            )}

                            {title && (
                                <Text style={styles.title}>{title}</Text>
                            )}
                        </View>
                    )}

                    {/* Content */}
                    <View style={styles.content}>
                        {children}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    background: {
        backgroundColor: theme.overlay,
    },
    container: {
        backgroundColor: theme.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: theme.shadow,
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    dragging: {
        shadowOpacity: 0.4,
        elevation: 8,
    },
    dragHandle: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: theme.border,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        textAlign: 'center',
        flex: 1,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.inputBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        fontSize: 24,
        color: theme.textSecondary,
        fontWeight: 'bold',
        lineHeight: 24,
    },
    content: {
        flex: 1,
    },
});
