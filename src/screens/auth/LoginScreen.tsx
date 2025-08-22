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
} from "firebase/auth";
import { auth } from "@/features/data/firebase";
import GoogleLoginButton from "@/features/auth/GoogleAuth";
import { useTheme } from "@/features/theme/ThemeContext";

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
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
  });

export default function LoginScreen() {
  const { theme } = useTheme();
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

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("שגיאה", "יש למלא את כל השדות");
      return;
    }

    if (isSignUp && !displayName.trim()) {
      Alert.alert("שגיאה", "יש להזין שם משתמש");
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
        Alert.alert("הצלחה", "החשבון נוצר בהצלחה!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      Alert.alert("שגיאה", error.message);
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
            {isSignUp ? "Create Account" : "Welcome Back"}
          </Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="שם משתמש"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="מייל"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="סיסמה"
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
              {loading ? "Loading..." : isSignUp ? "Sign Up" : "Login"}
            </Text>
          </TouchableOpacity>

          <GoogleLoginButton />

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? "Already have an account? Login"
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
