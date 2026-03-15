import React, { useState, useCallback, useMemo } from "react";
import { View, ScrollView, Text, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { useAdmin } from "@/context/AdminContext";
import { useMyShiftRoles } from "@/features/shifts";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import {
  createStyles,
  useProfileBasics,
  useProfileStats,
  useProfilePrivacy,
  useSocial,
  useSidePanel,
  ProfileHeader,
  SocialTabs,
  SocialList,
  SidePanel,
} from "./";
import { UnifiedStatsDashboard as StatsDashboard, UnifiedGradeStatsModal as GradeStatsModal } from "../../components/profile";
import { pickImage, removeProfileImage } from "./services/imageService";

const ProfileScreen: React.FC = () => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  const navigation = useNavigation();
  const { isAdmin } = useAdmin();
  const { isWorker } = useMyShiftRoles();

  // Local state for modals
  const [statsModalVisible, setStatsModalVisible] = useState(false);

  // Hooks
  const profileData = useProfileBasics();
  const statsData = useProfileStats();
  const privacyData = useProfilePrivacy();
  const socialData = useSocial();
  const sidePanelData = useSidePanel();

  // Construct user object from profile data
  const user = {
    uid: profileData.userId,
    displayName: profileData.displayName,
    email: profileData.email,
    photoURL: profileData.photoURL,
  };

  // Image pick handler
  const handleImagePick = useCallback(async () => {
    const uri = await pickImage(t);
    if (uri) {
      await profileData.handleImageUpload(uri);
    }
  }, [profileData]);

  // Image remove handler
  const handleImageRemove = useCallback(async () => {
    if (profileData.userId) {
      await removeProfileImage(profileData.userId, profileData.photoURL, t);
      profileData.setPhotoURL(null);
    }
  }, [profileData]);

  // Get current social users based on active tab
  const getCurrentSocialUsers = () => {
    switch (socialData.socialActiveTab) {
      case "followers":
        return socialData.followers;
      case "following":
        return socialData.following;
      case "search":
        return socialData.searchResults;
      default:
        return [];
    }
  };

  // Show loading if profile is still loading
  if (profileData.loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]} edges={["top"]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.mainContent}>
        <ProfileHeader onMenuPress={sidePanelData.toggleSidePanel} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Social Section */}
          <View style={styles.socialSection}>
            <SocialTabs
              activeTab={socialData.socialActiveTab}
              onTabPress={(tab) => socialData.setSocialActiveTab(tab as "search" | "followers" | "following")}
            />
            <SocialList
              activeTab={socialData.socialActiveTab}
              users={getCurrentSocialUsers()}
              searchQuery={socialData.searchTerm}
              onSearchChange={socialData.handleSearch}
              onFollowToggle={(userId) => {
                const isFollowing = socialData.isUserFollowed(userId);
                socialData.handleFollowToggle(userId, isFollowing);
              }}
              loading={false} // No loading state in hook yet
            />
          </View>

          {/* Statistics Dashboard */}
          <StatsDashboard
            mode="simple"
            stats={statsData.userStats}
            onStatsPress={() => setStatsModalVisible(true)}
            loading={statsData.refreshing}
          />
        </ScrollView>
      </View>

      {/* Grade Stats Modal */}
      <GradeStatsModal
        mode="simple"
        visible={statsModalVisible}
        onClose={() => setStatsModalVisible(false)}
        stats={statsData.userStats}
        gradeStats={statsData.gradeStats}
        privacySettings={privacyData.privacySettings}
        onPrivacyChange={privacyData.updatePrivacySetting}
      />

      {/* Side Panel */}
      <SidePanel
        visible={sidePanelData.showSidePanel}
        onClose={sidePanelData.toggleSidePanel}
        slideAnim={sidePanelData.slideAnim}
        user={user}
        isEditing={profileData.editing}
        onEditToggle={() => profileData.setEditing(!profileData.editing)}
        onSave={profileData.handleSave}
        editedUser={{ displayName: profileData.displayName }}
        onUserChange={(field, value) => {
          if (field === 'displayName') {
            profileData.setDisplayName(value);
          }
        }}
        privacySettings={privacyData.privacySettings}
        onPrivacyChange={privacyData.updatePrivacySetting}
        circleSize={profileData.circleSize}
        onCircleSizeChange={profileData.setCircleSize}
        onImagePick={handleImagePick}
        onImageRemove={handleImageRemove}
        onThemeToggle={toggleTheme}
        isDarkMode={isDarkMode}
        onLogout={profileData.handleLogout}
        onDeleteAccount={() => {
          sidePanelData.toggleSidePanel();
          // Navigate to DeleteAccount in the root stack
          (navigation as any).getParent()?.getParent()?.navigate('DeleteAccount');
        }}
        onPrivacySettings={() => {
          sidePanelData.toggleSidePanel();
          // Navigate to UserProfile with settings tab open
          if (profileData.userId) {
            (navigation as any).navigate('UserProfile', { 
              userId: profileData.userId, 
              autoEdit: true 
            });
          }
        }}
        onAdminPanel={() => {
          sidePanelData.toggleSidePanel();
          (navigation as any).getParent()?.getParent()?.navigate('AdminPanel');
        }}
        onShiftsManagement={() => {
          sidePanelData.toggleSidePanel();
          (navigation as any).getParent()?.getParent()?.navigate('Shifts');
        }}
        isWorker={isWorker}
        isAdmin={isAdmin}
      />
    </SafeAreaView>
  );
};

export default ProfileScreen;
