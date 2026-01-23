import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/features/theme/ThemeContext";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface UserProfileHeaderProps {
    userProfile: {
        displayName?: string;
        photoURL?: string;
    };
    followers: any[];
    following: any[];
    currentUserId: string;
    userId: string;
    isFollowed: boolean;
    handleFollowToggle: () => void;
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
    userProfile,
    followers,
    following,
    currentUserId,
    userId,
    isFollowed,
    handleFollowToggle,
}) => {
    const { theme } = useTheme();
    const layout = useResponsiveLayout();
    const { isLandscape, width: screenWidth } = layout;
    const insets = useSafeAreaInsets();
    
    const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
    
    const avatarSource = userProfile.photoURL
        ? { uri: userProfile.photoURL }
        : require("../../assets/splash.png");

    return (
        <View style={styles.profileHeader}>
            <View style={styles.headerContent}>
                <View style={styles.avatarContainer}>
                    <Image source={avatarSource} style={styles.avatar} />
                </View>

                <View style={styles.profileInfo}>
                    <Text style={styles.name}>
                        {userProfile.displayName || "משתמש"}
                    </Text>

                    <View style={styles.followStats}>
                        <Text style={styles.followStat}>{followers.length} עוקבים</Text>
                        <Text style={styles.followStat}> • </Text>
                        <Text style={styles.followStat}>{following.length} עוקב</Text>
                    </View>

                    {currentUserId !== userId && (
                        <TouchableOpacity
                            style={[
                                styles.followButton,
                                isFollowed && styles.unfollowButton,
                            ]}
                            onPress={handleFollowToggle}
                        >
                            <Text
                                style={[
                                    styles.followButtonText,
                                    isFollowed && styles.unfollowButtonText,
                                ]}
                            >
                                {isFollowed ? "ביטול מעקב" : "מעקב"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const createStyles = (theme: any, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number; top: number; bottom: number }) => {
    const isLandscape = layout?.isLandscape ?? false;
    const screenWidth = layout?.width ?? 375;
    const isTablet = layout?.isTablet ?? false;
    const isPhoneLandscape = !isTablet && isLandscape;
    
    // Account for safe areas in phone landscape
    const safeLeft = insets?.left ?? 0;
    const safeRight = insets?.right ?? 0;
    const horizontalPadding = isPhoneLandscape ? 16 : (isLandscape ? 24 : 20);
    const totalHorizontalPadding = horizontalPadding * 2 + safeLeft + safeRight;
    const landscapeColumnWidth = isLandscape ? (screenWidth - totalHorizontalPadding - 24) / 2 : screenWidth - 40;

    return StyleSheet.create({
        profileHeader: {
            backgroundColor: theme.surface,
            borderRadius: isLandscape ? 16 : 20,
            padding: isPhoneLandscape ? 12 : (isLandscape ? 16 : 20),
            marginBottom: isLandscape ? 0 : 20,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
            width: isLandscape ? landscapeColumnWidth : '100%',
        },
        headerContent: {
            flexDirection: isLandscape ? 'row' : 'column',
            alignItems: 'center',
        },
        avatarContainer: {
            alignItems: "center",
            marginBottom: isLandscape ? 0 : 16,
            marginRight: isLandscape ? 16 : 0,
        },
        avatar: {
            width: isLandscape ? 70 : 100,
            height: isLandscape ? 70 : 100,
            borderRadius: isLandscape ? 35 : 50,
            backgroundColor: theme.border,
            borderWidth: isLandscape ? 3 : 4,
            borderColor: theme.secondary,
        },
        profileInfo: {
            alignItems: "center",
            flex: isLandscape ? 1 : undefined,
        },
        name: {
            fontSize: isLandscape ? 18 : 24,
            fontWeight: "bold",
            color: theme.text,
            marginBottom: 6,
            textAlign: "center",
        },
        followStats: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: isLandscape ? 10 : 15,
        },
        followStat: {
            fontSize: isLandscape ? 14 : 16,
            color: theme.textSecondary,
            fontWeight: "500",
        },
        followButton: {
            backgroundColor: theme.secondary,
            paddingHorizontal: isLandscape ? 16 : 20,
            paddingVertical: isLandscape ? 8 : 10,
            borderRadius: 25,
            minWidth: isLandscape ? 100 : 120,
        },
        unfollowButton: {
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.secondary,
        },
        followButtonText: {
            color: "#fff",
            fontWeight: "600",
            fontSize: isLandscape ? 14 : 16,
            textAlign: "center",
        },
        unfollowButtonText: {
            color: theme.secondary,
        },
    });
};
