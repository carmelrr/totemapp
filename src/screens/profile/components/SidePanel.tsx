import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
} from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage, Language } from "@/features/language";
import { createStyles } from "../styles";
import { CachedAvatar } from "@/components/ui/CachedAvatar";
import type { PrivacySettings } from "../types";

interface SidePanelProps {
  visible: boolean;
  onClose: () => void;
  slideAnim: Animated.Value;
  user: any;
  isEditing: boolean;
  onEditToggle: () => void;
  onSave: () => void;
  editedUser: any;
  onUserChange: (field: string, value: string) => void;
  privacySettings: PrivacySettings;
  onPrivacyChange: (key: keyof PrivacySettings, value: boolean) => void;
  circleSize: number;
  onCircleSizeChange: (size: number) => void;
  onImagePick: () => void;
  onImageRemove: () => void;
  onThemeToggle: () => void;
  isDarkMode: boolean;
  onLogout: () => void;
  onDeleteAccount?: () => void;
  onPrivacySettings?: () => void;
  onAdminPanel?: () => void;
  onShiftsManagement?: () => void;
  isWorker?: boolean;
  isAdmin?: boolean;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  visible,
  onClose,
  slideAnim,
  user,
  isEditing,
  onEditToggle,
  onSave,
  editedUser,
  onUserChange,
  privacySettings,
  onPrivacyChange,
  circleSize,
  onCircleSizeChange,
  onImagePick,
  onImageRemove,
  onThemeToggle,
  isDarkMode,
  onLogout,
  onDeleteAccount,
  onPrivacySettings,
  onAdminPanel,
  onShiftsManagement,
  isWorker,
  isAdmin,
}) => {
  const { theme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const styles = createStyles(theme);

  if (!visible) return null;

  const circleSizes = [
    { size: 6, labelKey: "small" as const, color: "#3498db" },
    { size: 12, labelKey: "medium" as const, color: "#2ecc71" },
    { size: 20, labelKey: "large" as const, color: "#e74c3c" },
  ];



  const renderCircleSize = (sizeData: { size: number; labelKey: "small" | "medium" | "large"; color: string }) => (
    <TouchableOpacity
      key={sizeData.size}
      style={[
        styles.circleSizeRow,
        circleSize === sizeData.size && styles.circleSizeRowSelected,
      ]}
      onPress={() => onCircleSizeChange(sizeData.size)}
      activeOpacity={0.7}
      delayPressIn={0}
    >
      <View style={styles.circleSizeRowContent}>
        <Text
          style={[
            styles.circleSizeRowLabel,
            circleSize === sizeData.size && styles.circleSizeRowLabelSelected,
          ]}
        >
          {t.profile[sizeData.labelKey]}
        </Text>
        <View style={styles.circleSizeRowPreview}>
          <View
            style={{
              width: sizeData.size,
              height: sizeData.size,
              borderRadius: sizeData.size / 2,
              backgroundColor: sizeData.color,
            }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <Animated.View
        style={[
          styles.sidePanel,
          {
            right: slideAnim,
          },
        ]}
      >
        <View style={styles.sidePanelContent}>
          <View style={styles.sidePanelHeader}>
            <Text style={styles.sidePanelTitle}>{t.profile.settings}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sidePanelScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <CachedAvatar
                photoURL={user?.photoURL}
                displayName={user?.displayName}
                size={100}
                showBorder={true}
              />
              <View style={styles.avatarButtons}>
                <TouchableOpacity 
                  onPress={onImagePick}
                  activeOpacity={0.7}
                  delayPressIn={0}
                >
                  <Text style={styles.editPhoto}>{t.profile.editPhoto}</Text>
                </TouchableOpacity>
                {user?.photoURL && (
                  <TouchableOpacity 
                    onPress={onImageRemove}
                    activeOpacity={0.7}
                    delayPressIn={0}
                  >
                    <Text style={styles.removePhoto}>{t.profile.removePhoto}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Profile Edit Section */}
            <View style={styles.profileEditSection}>
              <Text style={styles.sectionTitle}>{t.profile.personalDetails}</Text>

              <Text style={styles.fieldLabel}>{t.profile.displayName}</Text>
              {isEditing ? (
                <TextInput
                  style={styles.sideInput}
                  value={editedUser?.displayName || ""}
                  onChangeText={(text) => onUserChange("displayName", text)}
                  placeholder={t.profile.enterDisplayName}
                />
              ) : (
                <Text style={styles.fieldValue}>
                  {user?.displayName || t.profile.notSet}
                </Text>
              )}

              <Text style={styles.fieldLabel}>{t.profile.email}</Text>
              <Text style={styles.fieldValue}>{user?.email || ""}</Text>

              <TouchableOpacity
                style={[
                  isEditing ? styles.saveButton : styles.editButton,
                  isEditing && styles.editButtonActive,
                ]}
                onPress={isEditing ? onSave : onEditToggle}
              >
                <Text
                  style={[
                    styles.buttonText,
                    isEditing && styles.editButtonTextActive,
                  ]}
                >
                  {isEditing ? t.profile.saveChanges : t.profile.editDetails}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preferences Section */}
            <View style={styles.preferencesSection}>
              <Text style={styles.sectionTitle}>{t.profile.preferences}</Text>
              <Text style={styles.preferencesSubtitle}>{t.profile.circleSizeOnMap}</Text>
              <View style={styles.circleSizeColumn}>
                {circleSizes.map(renderCircleSize)}
              </View>
            </View>

            {/* Theme Toggle */}
            <View style={styles.themeToggleContainer}>
              <View style={styles.themeOption}>
                <Text
                  style={[
                    styles.themeOptionLabel,
                    !isDarkMode && styles.themeOptionLabelSelected,
                  ]}
                >
                  {t.profile.themeLight}
                </Text>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.themeToggle,
                  isDarkMode && styles.themeToggleDark,
                ]}
                onPress={onThemeToggle}
              >
                <View
                  style={[
                    styles.themeToggleThumb,
                    isDarkMode && styles.themeToggleThumbDark,
                  ]}
                />
              </TouchableOpacity>
              
              <View style={styles.themeOption}>
                <Text
                  style={[
                    styles.themeOptionLabel,
                    isDarkMode && styles.themeOptionLabelSelected,
                  ]}
                >
                  {t.profile.themeDark}
                </Text>
              </View>
            </View>

            {/* Privacy Settings Button */}
            {onPrivacySettings && (
              <TouchableOpacity
                style={[styles.privacySettingsButton, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}
                onPress={onPrivacySettings}
                activeOpacity={0.7}
              >
                <Text style={styles.privacySettingsIcon}>🔒</Text>
                <View style={styles.privacySettingsTextContainer}>
                  <Text style={[styles.privacySettingsTitle, { color: theme.text }]}>
                    {t.privacy.title}
                  </Text>
                  <Text style={[styles.privacySettingsDesc, { color: theme.textSecondary }]}>
                    {t.privacy.description}
                  </Text>
                </View>
                <Text style={[styles.privacySettingsArrow, { color: theme.primary }]}>→</Text>
              </TouchableOpacity>
            )}

            {/* Language Selector */}
            <View style={styles.languageSection}>
              <View style={styles.languageRow}>
                <Text style={styles.languageLabel}>{t.profile.language}</Text>
                <View style={styles.languageButtons}>
                  <TouchableOpacity
                    style={[
                      styles.languageButton,
                      language === "he" && styles.languageButtonActive,
                    ]}
                    onPress={() => setLanguage("he")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.languageButtonText,
                        language === "he" && styles.languageButtonTextActive,
                      ]}
                    >
                      {t.profile.hebrew}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.languageButton,
                      language === "en" && styles.languageButtonActive,
                    ]}
                    onPress={() => setLanguage("en")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.languageButtonText,
                        language === "en" && styles.languageButtonTextActive,
                      ]}
                    >
                      {t.profile.english}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Admin Panel */}
            {isAdmin && onAdminPanel && (
              <View style={styles.adminSection}>
                <Text style={styles.adminTitle}>{t.admin.title}</Text>
                <View style={styles.adminButtons}>
                  <TouchableOpacity
                    style={styles.adminButton}
                    onPress={onAdminPanel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.adminButtonText}>{t.admin.adminPanel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Shifts Section - for non-admin workers */}
            {isWorker && !isAdmin && onShiftsManagement && (
              <View style={styles.adminSection}>
                <Text style={styles.adminTitle}>{'משמרות'}</Text>
                <View style={styles.adminButtons}>
                  <TouchableOpacity
                    style={[styles.adminButton, { backgroundColor: '#FF5722' }]}
                    onPress={onShiftsManagement}
                  >
                    <Text style={styles.adminButtonText}>{'משמרות שלי'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Announcements inside Admin section (for admins) */}

            {/* Delete Account Button */}
            {onDeleteAccount && (
              <TouchableOpacity
                style={[styles.logoutButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.error, marginTop: 8 }]}
                onPress={onDeleteAccount}
              >
                <Text style={[styles.logoutButtonText, { color: theme.error }]}>
                  {t.deleteAccount?.sidePanelButton ?? 'Delete Account'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>{t.auth.logout}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
};
