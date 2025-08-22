import React from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { createStyles } from "../styles";
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

  const renderUser = ({ item }: { item: SocialUser }) => (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName || item.email}</Text>
        {item.avatar ? (
          <Image 
            source={{ uri: item.avatar }} 
            style={styles.socialAvatar as any} 
          />
        ) : (
          <View style={[styles.socialAvatar, { backgroundColor: "#ddd" }]} />
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.followButton,
          item.isFollowing && styles.unfollowButton,
        ]}
        onPress={() =>
          onFollowToggle(item.id, item.isFollowing ? "unfollow" : "follow")
        }
      >
        <Text
          style={[
            styles.followButtonText,
            item.isFollowing && styles.unfollowButtonText,
          ]}
        >
          {item.isFollowing ? "הפסק מעקב" : "עקוב"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchInput = () => {
    if (activeTab !== "search") return null;
    
    return (
      <TextInput
        style={styles.searchInput}
        placeholder="חפש משתמשים..."
        value={searchQuery}
        onChangeText={onSearchChange}
        autoCapitalize="none"
      />
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return <Text style={styles.loadingText}>טוען...</Text>;
    }

    const emptyMessages = {
      followers: "אין עוקבים עדיין",
      following: "אתה לא עוקב אחרי אף אחד",
      requests: "אין בקשות חדשות",
      search: "הקלד כדי לחפש משתמשים",
    };

    return (
      <Text style={styles.emptyText}>
        {emptyMessages[activeTab] || "אין תוצאות"}
      </Text>
    );
  };

  return (
    <View style={styles.socialContent}>
      {renderSearchInput()}
      <View style={styles.userList}>
        {users.length > 0 ? (
          users.map((user) => (
            <View key={user.id}>
              {renderUser({ item: user })}
            </View>
          ))
        ) : (
          renderEmptyState()
        )}
      </View>
    </View>
  );
};
