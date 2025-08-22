import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
  Image,
  Switch,
} from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { createStyles } from "../styles";
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
  onAdminPanel?: () => void;
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
  onAdminPanel,
  isAdmin,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (!visible) return null;

  const circleSizes = [
    { size: 8, label: "קטן", color: "#3498db" },
    { size: 12, label: "בינוני", color: "#2ecc71" },
    { size: 16, label: "גדול", color: "#e74c3c" },
  ];

  const renderCircleSize = (sizeData: any) => (
    <TouchableOpacity
      key={sizeData.size}
      style={[
        styles.circleSizeRow,
        circleSize === sizeData.size && styles.circleSizeRowSelected,
      ]}
      onPress={() => onCircleSizeChange(sizeData.size)}
    >
      <View style={styles.circleSizeRowContent}>
        <Text
          style={[
            styles.circleSizeRowLabel,
            circleSize === sizeData.size && styles.circleSizeRowLabelSelected,
          ]}
        >
          {sizeData.label}
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
            <Text style={styles.sidePanelTitle}>הגדרות פרופיל</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sidePanelScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.sideAvatar}>
                {user?.photoURL ? (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={styles.sideAvatar as any}
                  />
                ) : (
                  <View style={[styles.sideAvatar, { backgroundColor: "#ddd" }]} />
                )}
              </View>
              <View style={styles.avatarButtons}>
                <TouchableOpacity onPress={onImagePick}>
                  <Text style={styles.editPhoto}>ערוך תמונה</Text>
                </TouchableOpacity>
                {user?.photoURL && (
                  <TouchableOpacity onPress={onImageRemove}>
                    <Text style={styles.removePhoto}>הסר תמונה</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Profile Edit Section */}
            <View style={styles.profileEditSection}>
              <Text style={styles.sectionTitle}>פרטים אישיים</Text>

              <Text style={styles.fieldLabel}>שם תצוגה</Text>
              {isEditing ? (
                <TextInput
                  style={styles.sideInput}
                  value={editedUser?.displayName || ""}
                  onChangeText={(text) => onUserChange("displayName", text)}
                  placeholder="הכנס שם תצוגה"
                />
              ) : (
                <Text style={styles.fieldValue}>
                  {user?.displayName || "לא הוגדר"}
                </Text>
              )}

              <Text style={styles.fieldLabel}>אימייל</Text>
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
                  {isEditing ? "שמור שינויים" : "ערוך פרטים"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preferences Section */}
            <View style={styles.preferencesSection}>
              <Text style={styles.sectionTitle}>העדפות</Text>
              <Text style={styles.preferencesSubtitle}>גודל עיגולי הקווים במפה</Text>
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
                  בהיר
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
                  כהה
                </Text>
              </View>
            </View>

            {/* Admin Panel */}
            {isAdmin && onAdminPanel && (
              <View style={styles.adminSection}>
                <Text style={styles.adminTitle}>ניהול מערכת</Text>
                <View style={styles.adminButtons}>
                  <TouchableOpacity
                    style={styles.adminButton}
                    onPress={onAdminPanel}
                  >
                    <Text style={styles.adminButtonText}>פאנל ניהול</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>התנתק</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
};
