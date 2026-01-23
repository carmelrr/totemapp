/**
 * @fileoverview Video Link Input Component - קומפוננטה להזנת לינק לסרטון
 * @description מאפשרת למשתמשים להזין לינק לסרטון ומבצעת וולידציה בזמן אמת
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from 'react-native';
import { useLanguage } from '@/features/language';
import { validateVideoLink, getPlatformIcon, SUPPORTED_PLATFORMS } from '@/utils/linkValidation';
import { useTheme } from '@/features/theme';

interface VideoLinkInputProps {
    value: string;
    onChange: (value: string) => void;
    onValidationChange?: (isValid: boolean) => void;
    disabled?: boolean;
}

export const VideoLinkInput: React.FC<VideoLinkInputProps> = ({
    value,
    onChange,
    onValidationChange,
    disabled = false,
}) => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [isExpanded, setIsExpanded] = useState(!!value);
    const [error, setError] = useState<string | null>(null);
    const [platform, setPlatform] = useState<string | null>(null);
    const expandAnim = useState(new Animated.Value(value ? 1 : 0))[0];

    useEffect(() => {
        if (value) {
            setIsExpanded(true);
            Animated.timing(expandAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: false,
            }).start();
        }
    }, []);

    const handleToggle = () => {
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        Animated.timing(expandAnim, {
            toValue: newExpanded ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
        
        if (!newExpanded) {
            // Clear value when collapsing
            onChange('');
            setError(null);
            setPlatform(null);
        }
    };

    const handleChange = (text: string) => {
        onChange(text);
        
        if (!text.trim()) {
            setError(null);
            setPlatform(null);
            onValidationChange?.(true); // Empty is valid (optional field)
            return;
        }

        const validation = validateVideoLink(text);
        if (validation.isValid) {
            setError(null);
            setPlatform(validation.platform || null);
            onValidationChange?.(true);
        } else {
            setError(validation.error || t.videoLink.errors.invalidFormat);
            setPlatform(null);
            onValidationChange?.(false);
        }
    };

    const handleRemove = () => {
        onChange('');
        setError(null);
        setPlatform(null);
        onValidationChange?.(true);
    };

    const inputHeight = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 140],
    });

    const styles = createStyles(theme);

    return (
        <View style={styles.container}>
            {/* Toggle Button */}
            <TouchableOpacity
                style={[
                    styles.toggleButton,
                    isExpanded && styles.toggleButtonActive,
                    disabled && styles.toggleButtonDisabled,
                ]}
                onPress={handleToggle}
                disabled={disabled}
                activeOpacity={0.7}
            >
                <Text style={styles.toggleButtonText}>
                    {t.videoLink.shareVideo}
                </Text>
                <Text style={styles.toggleIcon}>
                    {isExpanded ? '▲' : '▼'}
                </Text>
            </TouchableOpacity>

            {/* Expandable Input Section */}
            <Animated.View style={[styles.inputContainer, { height: inputHeight, overflow: 'hidden' }]}>
                <View style={styles.inputWrapper}>
                    {/* Platform Icon */}
                    {platform && (
                        <View style={styles.platformBadge}>
                            <Text style={styles.platformIcon}>{getPlatformIcon(value)}</Text>
                            <Text style={styles.platformName}>{platform}</Text>
                        </View>
                    )}

                    {/* Text Input */}
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[
                                styles.input,
                                error && styles.inputError,
                                value && !error && styles.inputValid,
                            ]}
                            value={value}
                            onChangeText={handleChange}
                            placeholder={t.videoLink.videoLinkPlaceholder}
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            editable={!disabled}
                        />
                        {value && (
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={handleRemove}
                            >
                                <Text style={styles.clearButtonText}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Error Message */}
                    {error && (
                        <Text style={styles.errorText}>{error}</Text>
                    )}

                    {/* Supported Platforms Hint */}
                    {!value && (
                        <View style={styles.platformsHint}>
                            <Text style={styles.platformsHintText}>
                                {t.videoLink.supportedPlatforms}
                            </Text>
                            <View style={styles.platformsRow}>
                                {SUPPORTED_PLATFORMS.slice(0, 4).map((p) => (
                                    <Text key={p.name} style={styles.platformHintIcon}>
                                        {p.icon}
                                    </Text>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </Animated.View>
        </View>
    );
};

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: theme.surface || theme.card,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        gap: 8,
    },
    toggleButtonActive: {
        backgroundColor: theme.isDark ? '#1a365d' : '#e3f2fd',
        borderColor: theme.primary,
    },
    toggleButtonDisabled: {
        opacity: 0.5,
    },
    toggleButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.text,
    },
    toggleIcon: {
        fontSize: 12,
        color: theme.textSecondary,
    },
    inputContainer: {
        marginTop: 8,
    },
    inputWrapper: {
        padding: 12,
        backgroundColor: theme.surface || theme.card,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    platformBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    platformIcon: {
        fontSize: 18,
    },
    platformName: {
        fontSize: 14,
        color: theme.primary,
        fontWeight: '600',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 44,
        paddingHorizontal: 12,
        backgroundColor: theme.inputBackground || theme.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        fontSize: 14,
        color: theme.text,
        textAlign: 'left',
    },
    inputError: {
        borderColor: '#ff4444',
        backgroundColor: theme.isDark ? '#3d1f1f' : '#fff5f5',
    },
    inputValid: {
        borderColor: '#4CAF50',
        backgroundColor: theme.isDark ? '#1f3d1f' : '#f5fff5',
    },
    clearButton: {
        marginLeft: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.isDark ? '#333' : '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearButtonText: {
        fontSize: 14,
        color: theme.textSecondary,
    },
    errorText: {
        marginTop: 6,
        fontSize: 12,
        color: '#ff4444',
        textAlign: 'right',
    },
    platformsHint: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    platformsHintText: {
        fontSize: 12,
        color: theme.textSecondary,
    },
    platformsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    platformHintIcon: {
        fontSize: 16,
    },
});

export default VideoLinkInput;
