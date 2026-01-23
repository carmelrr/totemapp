/**
 * @fileoverview Video Link Button Component - כפתור לצפייה בסרטון בטא
 * @description מציג כפתור שפותח את הלינק לסרטון בדפדפן חיצוני
 */

import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    Alert,
} from 'react-native';
import { useLanguage } from '@/features/language';
import { openVideoLink, getPlatformIcon, validateVideoLink } from '@/utils/linkValidation';
import { useTheme } from '@/features/theme';

interface VideoLinkButtonProps {
    url: string;
    compact?: boolean;
}

export const VideoLinkButton: React.FC<VideoLinkButtonProps> = ({
    url,
    compact = false,
}) => {
    const { t } = useLanguage();
    const { theme } = useTheme();

    // Validate the URL before showing the button
    const validation = validateVideoLink(url);
    if (!validation.isValid) {
        return null;
    }

    const handlePress = async () => {
        const success = await openVideoLink(url);
        if (!success) {
            Alert.alert(t.common.error, t.videoLink.errors.failedToOpen);
        }
    };

    const icon = getPlatformIcon(url);
    const styles = createStyles(theme);

    if (compact) {
        return (
            <TouchableOpacity
                style={styles.compactButton}
                onPress={handlePress}
                activeOpacity={0.7}
            >
                <Text style={styles.compactButtonText}>{icon}</Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={styles.button}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <Text style={styles.buttonIcon}>{icon}</Text>
            <Text style={styles.buttonText}>{t.videoLink.watchBeta}</Text>
        </TouchableOpacity>
    );
};

const createStyles = (theme: any) => StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: theme.isDark ? '#1a365d' : '#e3f2fd',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.primary,
        marginTop: 8,
        gap: 8,
    },
    buttonIcon: {
        fontSize: 18,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.isDark ? '#90cdf4' : theme.primary,
    },
    compactButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.isDark ? '#1a365d' : '#e3f2fd',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.primary,
    },
    compactButtonText: {
        fontSize: 18,
    },
});

export default VideoLinkButton;
