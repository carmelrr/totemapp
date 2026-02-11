// src/screens/profile/DeleteAccountScreen.tsx
// Screen for permanent account deletion – Google Play compliant

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { useAuth } from "@/context/AuthContext";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { auth, db } from "@/features/data/firebase";
import { deleteAccountCallable } from "@/features/data/deleteAccountClient";
import {
  signInWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signOut,
} from "firebase/auth";

const CONFIRMATION_WORD = "DELETE";

const DeleteAccountScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState("");
  const [showReAuth, setShowReAuth] = useState(false);

  const isConfirmed = confirmText.toUpperCase() === CONFIRMATION_WORD;

  // Reauthenticate with email/password
  const reauthenticateEmail = useCallback(async () => {
    if (!user?.email || !reAuthPassword) {
      Alert.alert(
        t.deleteAccount?.errorTitle ?? "Error",
        t.deleteAccount?.enterPassword ?? "Please enter your password."
      );
      return false;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, reAuthPassword);
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (err: any) {
      Alert.alert(
        t.deleteAccount?.errorTitle ?? "Error",
        t.deleteAccount?.reAuthFailed ?? "Re-authentication failed. Check your password."
      );
      return false;
    }
  }, [user, reAuthPassword, t]);

  // Reauthenticate with Google (web only – on native, use @react-native-google-signin)
  const reauthenticateGoogle = useCallback(async () => {
    try {
      // For React Native with @react-native-google-signin, get an idToken first:
      const { GoogleSignin } = require("@react-native-google-signin/google-signin");
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.data?.idToken;
      if (!idToken) throw new Error("No ID token from Google");
      const googleCredential = GoogleAuthProvider.credential(idToken);
      await reauthenticateWithCredential(user!, googleCredential);
      return true;
    } catch (err: any) {
      console.error("Google re-auth error:", err);
      Alert.alert(
        t.deleteAccount?.errorTitle ?? "Error",
        t.deleteAccount?.googleReAuthFailed ??
          "Could not re-authenticate with Google. Please try again."
      );
      return false;
    }
  }, [user, t]);

  const handleDeleteAccount = useCallback(async () => {
    if (!isConfirmed) return;
    if (!user) {
      Alert.alert(
        t.deleteAccount?.errorTitle ?? "Error",
        t.deleteAccount?.notLoggedIn ?? "You are not logged in."
      );
      return;
    }

    // Final confirmation
    Alert.alert(
      t.deleteAccount?.finalConfirmTitle ?? "Are you absolutely sure?",
      t.deleteAccount?.finalConfirmMessage ??
        "This will permanently delete your account and all associated data. This action CANNOT be undone.",
      [
        { text: t.common?.cancel ?? "Cancel", style: "cancel" },
        {
          text: t.deleteAccount?.deleteForever ?? "Delete Forever",
          style: "destructive",
          onPress: performDeletion,
        },
      ]
    );
  }, [isConfirmed, user, t]);

  const performDeletion = useCallback(async () => {
    setLoading(true);
    try {
      const result = await deleteAccountCallable();

      // Sign out locally
      await signOut(auth);

      Alert.alert(
        t.deleteAccount?.successTitle ?? "Account Deleted",
        t.deleteAccount?.successMessage ??
          "Your account and all data have been permanently deleted."
      );
      // Auth state listener in App.tsx will redirect to LoginScreen
    } catch (err: any) {
      console.error("Delete account error:", err);

      // Handle requires-recent-login
      if (
        err?.code === "functions/unauthenticated" ||
        err?.message?.includes("requires-recent-login") ||
        err?.code === "auth/requires-recent-login"
      ) {
        setShowReAuth(true);
        Alert.alert(
          t.deleteAccount?.reAuthRequiredTitle ?? "Re-authentication Required",
          t.deleteAccount?.reAuthRequiredMessage ??
            "For security, please re-authenticate before deleting your account."
        );
      } else {
        Alert.alert(
          t.deleteAccount?.errorTitle ?? "Error",
          err?.message ??
            (t.deleteAccount?.genericError ??
              "Something went wrong. Please try again.")
        );
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleReAuthAndDelete = useCallback(async () => {
    setLoading(true);
    try {
      const providers = user?.providerData?.map((p) => p.providerId) ?? [];
      let success = false;

      if (providers.includes("google.com")) {
        success = await reauthenticateGoogle();
      } else {
        success = await reauthenticateEmail();
      }

      if (success) {
        setShowReAuth(false);
        await performDeletion();
      }
    } catch (err: any) {
      console.error("ReAuth error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, reauthenticateEmail, reauthenticateGoogle, performDeletion]);

  const styles = useMemo(
    () => createStyles(theme, layout, insets),
    [theme, layout, insets]
  );

  // If not logged in, navigate back
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.title}>
            {t.deleteAccount?.notLoggedIn ?? "You must be logged in to delete your account."}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{t.common?.back ?? "Back"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t.deleteAccount?.title ?? "Delete Account"}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Warning Icon */}
          <View style={styles.warningIconContainer}>
            <Ionicons name="warning" size={64} color={theme.error} />
          </View>

          {/* Warning Text */}
          <Text style={styles.warningTitle}>
            {t.deleteAccount?.warningTitle ?? "This action is permanent"}
          </Text>
          <Text style={styles.warningBody}>
            {t.deleteAccount?.warningBody ??
              "Deleting your account will permanently remove:"}
          </Text>

          {/* Data list */}
          <View style={styles.dataList}>
            {[
              t.deleteAccount?.dataProfile ?? "Your profile information",
              t.deleteAccount?.dataRoutes ?? "All your saved routes and progress",
              t.deleteAccount?.dataPhotos ?? "All uploaded photos",
              t.deleteAccount?.dataSocial ?? "Followers, following, and social data",
              t.deleteAccount?.dataCommunity ?? "Community route submissions",
            ].map((item, idx) => (
              <View key={idx} style={styles.dataListItem}>
                <Ionicons name="close-circle" size={20} color={theme.error} />
                <Text style={styles.dataListText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.irreversibleText}>
            {t.deleteAccount?.irreversible ??
              "This action is IRREVERSIBLE. You will not be able to recover your data."}
          </Text>

          {/* Confirmation input */}
          <Text style={styles.confirmLabel}>
            {t.deleteAccount?.typeToConfirm ??
              `Type "${CONFIRMATION_WORD}" to confirm:`}
          </Text>
          <TextInput
            style={[
              styles.confirmInput,
              isConfirmed && styles.confirmInputValid,
            ]}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={CONFIRMATION_WORD}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />

          {/* Re-authentication section */}
          {showReAuth && (
            <View style={styles.reAuthSection}>
              <Text style={styles.reAuthTitle}>
                {t.deleteAccount?.reAuthTitle ?? "Re-authenticate to continue"}
              </Text>

              {user.providerData?.some(
                (p) => p.providerId === "password"
              ) && (
                <>
                  <TextInput
                    style={styles.confirmInput}
                    value={reAuthPassword}
                    onChangeText={setReAuthPassword}
                    placeholder={t.auth?.password ?? "Password"}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    editable={!loading}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.reAuthButton, loading && styles.buttonDisabled]}
                onPress={handleReAuthAndDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.reAuthButtonText}>
                    {user.providerData?.some(
                      (p) => p.providerId === "google.com"
                    )
                      ? t.deleteAccount?.reAuthGoogle ?? "Re-authenticate with Google"
                      : t.deleteAccount?.reAuthPassword ?? "Verify & Delete"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Delete button */}
          {!showReAuth && (
            <TouchableOpacity
              style={[
                styles.deleteButton,
                (!isConfirmed || loading) && styles.buttonDisabled,
              ]}
              onPress={handleDeleteAccount}
              disabled={!isConfirmed || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.deleteButtonText}>
                  {t.deleteAccount?.deleteButton ?? "Permanently Delete My Account"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>
              {t.common?.cancel ?? "Cancel"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ===== Styles =====
const createStyles = (theme: any, layout: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerBack: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 60,
    },
    warningIconContainer: {
      alignItems: "center",
      marginBottom: 16,
    },
    warningTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: theme.error,
      textAlign: "center",
      marginBottom: 12,
    },
    warningBody: {
      fontSize: 16,
      color: theme.text,
      textAlign: "center",
      marginBottom: 16,
      lineHeight: 22,
    },
    dataList: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    dataListItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    dataListText: {
      fontSize: 15,
      color: theme.text,
      marginLeft: 10,
      flex: 1,
    },
    irreversibleText: {
      fontSize: 14,
      color: theme.error,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
    },
    confirmLabel: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "600",
      marginBottom: 8,
    },
    confirmInput: {
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      padding: 14,
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
      borderWidth: 2,
      borderColor: theme.border,
      marginBottom: 16,
      letterSpacing: 4,
    },
    confirmInputValid: {
      borderColor: theme.error,
    },
    title: {
      fontSize: 18,
      color: theme.text,
      textAlign: "center",
      marginBottom: 16,
    },
    backButton: {
      backgroundColor: theme.buttonPrimary,
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 12,
    },
    backButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "bold",
    },
    deleteButton: {
      backgroundColor: theme.error,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      marginBottom: 12,
    },
    deleteButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "bold",
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    cancelButton: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelButtonText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: "600",
    },
    reAuthSection: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.warning,
    },
    reAuthTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 12,
      textAlign: "center",
    },
    reAuthButton: {
      backgroundColor: theme.error,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    reAuthButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "bold",
    },
  });

export default DeleteAccountScreen;
