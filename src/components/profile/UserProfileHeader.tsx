import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";

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
    const avatarSource = userProfile.photoURL
        ? { uri: userProfile.photoURL }
        : require("../../assets/default-avatar.png");

    return (
        <View style={styles.profileHeader}>
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
    );
};

const styles = StyleSheet.create({
    profileHeader: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    avatarContainer: {
        alignItems: "center",
        marginBottom: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#eee",
        borderWidth: 4,
        borderColor: "#8e44ad",
    },
    profileInfo: {
        alignItems: "center",
    },
    name: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 8,
        textAlign: "center",
    },
    followStats: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 15,
    },
    followStat: {
        fontSize: 16,
        color: "#6c757d",
        fontWeight: "500",
    },
    followButton: {
        backgroundColor: "#8e44ad",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        minWidth: 120,
    },
    unfollowButton: {
        backgroundColor: "#e9ecef",
        borderWidth: 1,
        borderColor: "#8e44ad",
    },
    followButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
        textAlign: "center",
    },
    unfollowButtonText: {
        color: "#8e44ad",
    },
});
