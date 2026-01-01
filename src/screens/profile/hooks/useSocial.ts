import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { auth } from "@/features/data/firebase";
import {
  searchUsers,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
  getAllUsers,
} from "@/features/social/socialService";
import type { SocialUser, ProfileNavigation } from "../types";

export function useSocial() {
  const navigation = useNavigation<ProfileNavigation>();
  const user = auth.currentUser;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [followers, setFollowers] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [socialActiveTab, setSocialActiveTab] = useState<"search" | "followers" | "following">("search");

  const loadSocialData = async () => {
    if (!user) return;

    try {
      const [followersData, followingData] = await Promise.all([
        getUserFollowers(user.uid),
        getUserFollowing(user.uid),
      ]);

      setFollowers(followersData);
      setFollowing(followingData);
    } catch (error) {
      console.error("Error loading social data:", error);
    }
  };

  const handleSearch = useCallback(async (text: string) => {
    setSearchTerm(text);
    // Search is now handled in SocialList component directly
    // This function is kept for backward compatibility and state management
  }, []);

  const handleFollowToggle = async (userId: string, isFollowing: boolean) => {
    if (!user) return;
    
    try {
      if (isFollowing) {
        await unfollowUser(user.uid, userId);
        setFollowing((prev) => prev.filter((u) => u.id !== userId));
      } else {
        await followUser(user.uid, userId);
        const userToAdd = searchResults.find((u) => u.id === userId);
        if (userToAdd) {
          setFollowing((prev) => [...prev, userToAdd]);
        }
      }

      // Refresh social data
      await loadSocialData();
    } catch (error) {
      Alert.alert("שגיאה", "נכשל בעדכון מעקב");
    }
  };

  const isUserFollowed = (userId: string): boolean => {
    return following.some((u) => u.id === userId);
  };

  const showUserProfile = (userToShow: SocialUser) => {
    navigation.navigate("UserProfile", { userId: userToShow.id });
  };

  useEffect(() => {
    loadSocialData();
  }, [user]);

  return {
    searchTerm,
    searchResults,
    followers,
    following,
    socialActiveTab,
    setSocialActiveTab,
    handleSearch,
    handleFollowToggle,
    isUserFollowed,
    showUserProfile,
    reloadSocialData: loadSocialData,
  };
}
