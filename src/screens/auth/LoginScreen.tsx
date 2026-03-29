import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  Image,
} from "react-native";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";
import GoogleLoginButton from "@/features/auth/GoogleAuth";
import AppleLoginButton from "@/features/auth/AppleAuth";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGuest } from "@/context/GuestContext";

const createStyles = (theme, layout, insets) => {
  const { isLandscape, isTablet, width, height, scaleFactor } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  
  // In landscape, make the form narrower and centered
  const formMaxWidth = isLandscape ? Math.min(450, width * 0.5) : undefined;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: "center",
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingStart: isLandscape ? Math.max(20, insets.left) : 0,
      paddingEnd: isLandscape ? Math.max(20, insets.right) : 0,
    },
    formContainer: {
      padding: isPhoneLandscape ? 16 : 24,
      margin: isPhoneLandscape ? 10 : 20,
      backgroundColor: theme.surface,
      borderRadius: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      maxWidth: formMaxWidth,
      alignSelf: isLandscape ? 'center' : undefined,
      width: isLandscape ? formMaxWidth : undefined,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: isPhoneLandscape ? 8 : 16,
    },
    logoImage: {
      width: isPhoneLandscape ? 80 : 120,
      height: isPhoneLandscape ? 80 : 120,
    },
    title: {
      fontSize: isPhoneLandscape ? 22 : 28,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: isPhoneLandscape ? 4 : 8,
      color: theme.text,
    },
    subtitle: {
      fontSize: isPhoneLandscape ? 14 : 16,
      textAlign: "center",
      marginBottom: isPhoneLandscape ? 16 : 24,
      color: theme.textSecondary,
    },
    inputContainer: {
      marginBottom: isPhoneLandscape ? 10 : 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      padding: isPhoneLandscape ? 10 : 14,
      borderRadius: 10,
      fontSize: 16,
      backgroundColor: theme.inputBackground,
      color: theme.text,
    },
    inputFocused: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    button: {
      backgroundColor: theme.buttonPrimary,
      padding: isPhoneLandscape ? 12 : 16,
      borderRadius: 10,
      alignItems: "center",
      marginBottom: isPhoneLandscape ? 8 : 12,
      marginTop: isPhoneLandscape ? 4 : 8,
    },
    buttonDisabled: {
      backgroundColor: theme.border,
    },
    buttonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
    },
    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: isPhoneLandscape ? 10 : 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    dividerText: {
      marginHorizontal: 12,
      color: theme.textSecondary,
      fontSize: 14,
    },
    switchButton: {
      alignItems: "center",
      padding: isPhoneLandscape ? 8 : 12,
      marginTop: isPhoneLandscape ? 4 : 8,
    },
    switchText: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: "500",
    },
    forgotPasswordButton: {
      alignItems: "center",
      padding: isPhoneLandscape ? 6 : 10,
      marginTop: 4,
    },
    forgotPasswordText: {
      color: theme.textSecondary,
      fontSize: 14,
      textDecorationLine: "underline",
    },
    termsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: isPhoneLandscape ? 8 : 12,
      marginTop: isPhoneLandscape ? 4 : 8,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderWidth: 2,
      borderColor: theme.primary,
      borderRadius: 4,
      marginEnd: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: {
      backgroundColor: theme.primary,
    },
    checkboxMark: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "bold",
    },
    termsText: {
      color: theme.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    termsLink: {
      color: theme.primary,
      textDecorationLine: "underline",
    },
    guestButton: {
      alignItems: "center",
      padding: isPhoneLandscape ? 10 : 14,
      marginTop: isPhoneLandscape ? 8 : 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
    },
    guestButtonText: {
      color: theme.textSecondary,
      fontSize: 15,
    },
  });
};

export default function LoginScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  const { setIsGuest } = useGuest();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    // Reset form
    setEmail("");
    setPassword("");
    setDisplayName("");
    setIsSignUp(false);
    setLoading(false);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Helper function to check if email exists in Firestore users collection
  const checkEmailExistsInFirestore = async (emailToCheck: string): Promise<boolean> => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", emailToCheck.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking email in Firestore:", error);
      return false;
    }
  };

  // Check if email exists using password reset (without actually sending if we can detect early)
  const checkEmailExistsViaAuth = async (emailToCheck: string): Promise<boolean | null> => {
    try {
      // Try to sign in with a dummy password to trigger specific error codes
      await signInWithEmailAndPassword(auth, emailToCheck, "__dummy_password_check__");
      // If somehow this succeeds (shouldn't happen), user exists
      return true;
    } catch (error: any) {
      switch (error.code) {
        case "auth/user-not-found":
          return false;
        case "auth/wrong-password":
          // User exists but password is wrong (expected)
          return true;
        case "auth/invalid-credential":
          // Firebase returns this for BOTH non-existent users and wrong passwords
          // so we cannot reliably distinguish — return null to fall back to Firestore check
          return null;
        case "auth/invalid-email":
          return null; // Invalid email format
        default:
          return null; // Can't determine
      }
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert(t.common.error, t.errors.general);
      return;
    }

    if (isSignUp && !displayName.trim()) {
      Alert.alert(t.common.error, t.auth.displayName);
      return;
    }

    if (isSignUp && !acceptedTerms) {
      Alert.alert(t.common.error, t.auth.mustAcceptTerms);
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        // Update the user's profile with the display name
        await updateProfile(userCredential.user, {
          displayName: displayName.trim(),
        });
        
        // Create user document in Firestore with email for future lookups
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: email.toLowerCase().trim(),
          displayName: displayName.trim(),
          createdAt: serverTimestamp(),
          isAdmin: false,
          acceptedTermsAt: serverTimestamp(),
          privacy: {
            showProfile: true,
            showTotalRoutes: true,
            showHighestGrade: true,
            showAverageRating: true,
            showGradeStats: true,
            showJoinDate: true,
          },
          stats: {
            totalRoutesSent: 0,
            highestGrade: null,
            totalFeedbacks: 0,
            averageStarRating: 0,
          },
        });
      } else {
        // Try to sign in
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (signInError: any) {
          // If we get invalid-credential, determine if it's email or password issue
          if (signInError.code === "auth/invalid-credential") {
            // First check Firestore, then fallback to Auth check
            let emailExists = await checkEmailExistsInFirestore(email);
            
            // If not found in Firestore, do a more thorough check via Auth
            if (!emailExists) {
              const authCheck = await checkEmailExistsViaAuth(email);
              if (authCheck === true) {
                emailExists = true;
              }
            }
            
            if (!emailExists) {
              // Email doesn't exist - Priority 1
              Alert.alert(
                t.auth.userNotFound,
                t.auth.userNotFoundMessage,
                [
                  { text: t.common.no, style: "cancel" },
                  { 
                    text: t.auth.createAccount, 
                    onPress: () => setIsSignUp(true) 
                  },
                ]
              );
            } else {
              // Email exists but password is wrong - Priority 2
              Alert.alert(
                t.auth.wrongPassword,
                t.auth.wrongPasswordMessage,
                [
                  { text: t.common.cancel, style: "cancel" },
                  { 
                    text: t.auth.forgotPassword, 
                    onPress: () => handleForgotPassword() 
                  },
                ]
              );
            }
            setLoading(false);
            return;
          }
          // Re-throw other errors to be handled below
          throw signInError;
        }
      }
    } catch (error: any) {
      // Handle specific Firebase auth errors with helpful messages
      const errorCode = error.code;
      
      switch (errorCode) {
        case "auth/user-not-found":
          Alert.alert(
            t.auth.userNotFound,
            t.auth.userNotFoundMessage,
            [
              { text: t.common.no, style: "cancel" },
              { 
                text: t.auth.createAccount, 
                onPress: () => setIsSignUp(true) 
              },
            ]
          );
          break;
        case "auth/wrong-password":
          Alert.alert(
            t.auth.wrongPassword,
            t.auth.wrongPasswordMessage,
            [
              { text: t.common.cancel, style: "cancel" },
              { 
                text: t.auth.forgotPassword, 
                onPress: () => handleForgotPassword() 
              },
            ]
          );
          break;
        case "auth/invalid-email":
          Alert.alert(t.common.error, t.auth.invalidEmailMessage);
          break;
        case "auth/email-already-in-use":
          Alert.alert(t.common.error, t.auth.emailInUseMessage);
          break;
        case "auth/weak-password":
          Alert.alert(t.common.error, t.auth.weakPasswordMessage);
          break;
        case "auth/invalid-credential":
          // This shouldn't happen now as we handle it above, but keep as fallback
          Alert.alert(
            t.auth.loginError,
            t.auth.wrongPasswordMessage,
            [
              { text: t.common.cancel, style: "cancel" },
              { 
                text: t.auth.forgotPassword, 
                onPress: () => handleForgotPassword() 
              },
            ]
          );
          break;
        case "auth/too-many-requests":
          Alert.alert(t.common.error, t.errors.network);
          break;
        case "auth/network-request-failed":
          Alert.alert(t.common.error, t.errors.network);
          break;
        default:
          Alert.alert(t.common.error, error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(t.common.error, t.auth.email);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t.common.error, t.auth.invalidEmailMessage);
      return;
    }

    // First check if email exists in our system before sending reset email
    const emailExists = await checkEmailExistsInFirestore(email);
    if (!emailExists) {
      // Double check via auth
      const authCheck = await checkEmailExistsViaAuth(email);
      if (authCheck === false) {
        Alert.alert(
          t.auth.userNotFound,
          t.auth.userNotFoundMessage,
          [
            { text: t.common.no, style: "cancel" },
            { 
              text: t.auth.createAccount, 
              onPress: () => setIsSignUp(true) 
            },
          ]
        );
        return;
      }
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        t.auth.resetEmailSent,
        t.auth.resetEmailSentMessage
      );
    } catch (error: any) {
      const errorCode = error.code;
      
      switch (errorCode) {
        case "auth/user-not-found":
          Alert.alert(
            t.auth.userNotFound,
            t.auth.userNotFoundMessage,
            [
              { text: t.common.no, style: "cancel" },
              { 
                text: t.auth.createAccount, 
                onPress: () => setIsSignUp(true) 
              },
            ]
          );
          break;
        case "auth/invalid-email":
          Alert.alert(t.common.error, t.auth.invalidEmailMessage);
          break;
        case "auth/too-many-requests":
          Alert.alert(t.common.error, t.errors.network);
          break;
        default:
          Alert.alert(t.common.error, t.errors.general);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3498db"]}
            tintColor="#3498db"
          />
        }
      >
        <View style={styles.formContainer}>
          <View style={styles.logoContainer}>
            <BrandLogo variant="icon" color={theme.isDark ? "white" : "dark"} size={120} />
          </View>
          <Text style={styles.title}>ברוכים הבאים לטוטם</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? t.auth.signUp : t.auth.login}
          </Text>

          {isSignUp && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t.auth.displayName}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.auth.displayName}
                placeholderTextColor={theme.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t.auth.email}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.auth.email}
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t.auth.password}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.auth.password}
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {isSignUp && (
            <View style={styles.termsRow}>
              <TouchableOpacity
                style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                {acceptedTerms && <Text style={styles.checkboxMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                {t.auth.acceptTerms}{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => {
                    const { Linking } = require("react-native");
                    Linking.openURL("https://carmelrr.github.io/totemapp/terms.html");
                  }}
                >
                  {t.auth.termsOfUse}
                </Text>
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? t.common.loading : isSignUp ? t.auth.signUp : t.auth.login}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>או</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleLoginButton />
          <AppleLoginButton />

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? t.auth.alreadyHaveAccount
                : t.auth.dontHaveAccount}
            </Text>
          </TouchableOpacity>

          {!isSignUp && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>
                {t.auth.forgotPassword}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => setIsGuest(true)}
          >
            <Text style={styles.guestButtonText}>
              {t.auth.continueAsGuest}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
