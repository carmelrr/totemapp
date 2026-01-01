import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/features/theme/ThemeContext";
import { auth } from "@/features/data/firebase";
import { createStyles } from "../styles";
import { searchUsers, getAllUsers, getUserFollowing } from "@/features/social/socialService";
import type { SocialUser } from "../types";

interface SocialListProps {
  activeTab: string;
  users: SocialUser[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFollowToggle: (userId: string, action: string) => void;
  loading: boolean;
}

export const SocialList: React.FC<SocialListProps> = ({
  activeTab,
  users,
  searchQuery,
  onSearchChange,
  onFollowToggle,
  loading,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation();
  const currentUserId = auth.currentUser?.uid;
  
  // Local state for infinite scroll
  const [allUsers, setAllUsers] = useState<SocialUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SocialUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  // Load following list for current user
  useEffect(() => {
    const loadFollowing = async () => {
      if (currentUserId) {
        try {
          const followingData = await getUserFollowing(currentUserId);
          setFollowingIds(new Set(followingData.map((u: any) => u.id)));
        } catch (error) {
          console.error("Error loading following:", error);
        }
      }
    };
    loadFollowing();
  }, [currentUserId]);

  // Load all users when on search tab
  useEffect(() => {
    if (activeTab === "search") {
      loadInitialUsers();
    }
  }, [activeTab]);

  // Filter users when search query changes
  useEffect(() => {
    if (activeTab === "search") {
      if (searchQuery.trim() === "") {
        setFilteredUsers(allUsers);
      } else {
        const filtered = allUsers.filter((user) => {
          const displayName = user.displayName?.toLowerCase() || "";
          const email = user.email?.toLowerCase() || "";
          const query = searchQuery.toLowerCase();
          return displayName.includes(query) || email.includes(query);
        });
        setFilteredUsers(filtered);
      }
    }
  }, [searchQuery, allUsers, activeTab]);

  const loadInitialUsers = async () => {
    setLoadingUsers(true);
    try {
      const result = await getAllUsers(30, null);
      // Filter out current user
      const filteredResult = result.users.filter((u: any) => u.id !== currentUserId);
      setAllUsers(filteredResult);
      setFilteredUsers(filteredResult);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMoreUsers = async () => {
    if (loadingMore || !hasMore || searchQuery.trim() !== "") return;
    
    setLoadingMore(true);
    try {
      const result = await getAllUsers(20, lastDoc);
      setAllUsers((prev) => [...prev, ...result.users]);
      setFilteredUsers((prev) => [...prev, ...result.users]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading more users:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const navigateToUserProfile = (userId: string) => {
    navigation.navigate("UserProfile" as never, { userId } as never);
  };

  // Check if user is being followed
  const isFollowingUser = (userId: string): boolean => {
    return followingIds.has(userId);
  };

  // Handle follow toggle and update local state
  const handleLocalFollowToggle = async (userId: string, action: string) => {
    // Optimistically update UI
    if (action === "follow") {
      setFollowingIds((prev) => new Set([...prev, userId]));
    } else {
      setFollowingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
    
    // Call the parent handler
    onFollowToggle(userId, action);
  };

  const renderSearchInput = () => {
    if (activeTab !== "search") return null;
    
    return (
      <TextInput
        style={styles.searchInput}
        placeholder="חפש משתמשים..."
        placeholderTextColor={theme.textSecondary}
        value={searchQuery}
        onChangeText={onSearchChange}
        autoCapitalize="none"
      />
    );
  };

  const renderEmptyState = () => {
    if (loading || loadingUsers) {
      return (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { marginTop: 10 }]}>טוען משתמשים...</Text>
        </View>
      );
    }

    const emptyMessages: Record<string, string> = {
      followers: "אין עוקבים עדיין",
      following: "אתה לא עוקב אחרי אף אחד",
      search: searchQuery ? "לא נמצאו תוצאות" : "אין משתמשים",
    };

    return (
      <Text style={styles.emptyText}>
        {emptyMessages[activeTab] || "אין תוצאות"}
      </Text>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 15, alignItems: "center" }}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  };

  // Determine which users to display
  const displayUsers = activeTab === "search" ? filteredUsers : users;

  // Handle scroll to bottom for load more
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isCloseToBottom && activeTab === "search" && !loadingMore && hasMore) {
      loadMoreUsers();
    }
  };

  // Render a single user item
  const renderUserItem = (item: SocialUser) => {
    const isFollowing = item.isFollowing !== undefined ? item.isFollowing : isFollowingUser(item.id);
    
    return (
      <TouchableOpacity 
        key={item.id}
        style={styles.userItem}
        onPress={() => navigateToUserProfile(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName || item.email}</Text>
          {item.avatar || item.photoURL ? (
            <Image 
              source={{ uri: item.avatar || item.photoURL }} 
              style={styles.socialAvatar as any} 
            />
          ) : (
            <View style={[styles.socialAvatar, { backgroundColor: "#ddd" }]} />
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.followButton,
            isFollowing && styles.unfollowButton,
          ]}
          onPress={(e) => {
            e.stopPropagation();
            handleLocalFollowToggle(item.id, isFollowing ? "unfollow" : "follow");
          }}
        >
          <Text
            style={[
              styles.followButtonText,
              isFollowing && styles.unfollowButtonText,
            ]}
          >
            {isFollowing ? "הפסק מעקב" : "עקוב"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.socialContent}>
      {renderSearchInput()}
      <View style={[styles.userList, { maxHeight: 400 }]}>
        {displayUsers.length > 0 ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={400}
            nestedScrollEnabled={true}
          >
            {displayUsers.map(renderUserItem)}
            {renderFooter()}
          </ScrollView>
        ) : (
          renderEmptyState()
        )}
      </View>
    </View>
  );
};
