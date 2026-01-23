import React, { useState } from "react";
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
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: "center",
    },
    formContainer: {
      padding: 20,
      margin: 20,
      backgroundColor: theme.surface,
      borderRadius: 10,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 10,
      color: theme.text,
    },
    subtitle: {
      fontSize: 18,
      textAlign: "center",
      marginBottom: 30,
      color: theme.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      padding: 15,
      borderRadius: 8,
      marginBottom: 15,
      fontSize: 16,
      backgroundColor: theme.inputBackground,
      textAlign: "right",
      color: theme.text,
    },
    button: {
      backgroundColor: theme.primary,
      padding: 15,
      borderRadius: 8,
      alignItems: "center",
      marginBottom: 15,
    },
    buttonDisabled: {
      backgroundColor: theme.border,
    },
    buttonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
    },
    switchButton: {
      alignItems: "center",
      padding: 10,
    },
    switchText: {
      color: theme.primary,
      fontSize: 14,
    },
    forgotPasswordButton: {
      alignItems: "center",
      padding: 10,
      marginTop: 5,
    },
    forgotPasswordText: {
      color: theme.textSecondary,
      fontSize: 14,
      textDecorationLine: "underline",
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
  });

export default function LoginScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
        case "auth/invalid-credential":
          // User exists but password is wrong (expected)
          return true;
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
          privacy: {
            showProfile: true,
            showTotalRoutes: true,
            showHighestGrade: true,
            showFeedbackCount: true,
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
        
        Alert.alert(t.common.success, t.common.success);
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
          <Text style={styles.title}>🧗‍♂️ Climbing Gym</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? t.auth.signUp : t.home.welcomeBack}
          </Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder={t.auth.displayName}
              placeholderTextColor={theme.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}

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

          <TextInput
            style={styles.input}
            placeholder={t.auth.password}
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? t.common.loading : isSignUp ? t.auth.signUp : t.auth.login}
            </Text>
          </TouchableOpacity>

          <GoogleLoginButton />

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
