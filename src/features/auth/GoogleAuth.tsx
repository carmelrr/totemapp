import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet, Alert, Platform, ActivityIndicator } from "react-native";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";
import Constants from "expo-constants";

// Only import native Google Sign-In on non-web platforms
let GoogleSignin: any;
let statusCodes: any;
let isSuccessResponse: any;
let isErrorWithCode: any;

if (Platform.OS !== "web") {
  const nativeModule = require("@react-native-google-signin/google-signin");
  GoogleSignin = nativeModule.GoogleSignin;
  statusCodes = nativeModule.statusCodes;
  isSuccessResponse = nativeModule.isSuccessResponse;
  isErrorWithCode = nativeModule.isErrorWithCode;

  // Configure Google Sign-In (native only)
  GoogleSignin.configure({
    webClientId: Constants.expoConfig?.extra?.webClientId || "720872675049-60m0tk2krk77qi5tdf699o9kmlpsfdsd.apps.googleusercontent.com",
    iosClientId: Constants.expoConfig?.extra?.iosClientId,
    offlineAccess: false,
    scopes: ["profile", "email"],
  });
}

// Web Google Auth provider
const webGoogleProvider = new GoogleAuthProvider();
webGoogleProvider.addScope("profile");
webGoogleProvider.addScope("email");

export default function GoogleLoginButton() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleLoginWeb = async () => {
    // Use Firebase signInWithPopup for web
    const result = await signInWithPopup(auth, webGoogleProvider);
    console.log("✅ Firebase Auth (web popup) successful, UID:", result.user.uid);
    return result;
  };

  const handleGoogleLoginNative = async () => {
    // Check if Play Services are available (Android only)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Sign in with Google
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return null;
    }

    const { idToken } = response.data;
    if (!idToken) {
      throw new Error("No ID token received from Google");
    }

    // Create Firebase credential with the Google ID token
    const credential = GoogleAuthProvider.credential(idToken);

    // Sign in to Firebase
    const result = await signInWithCredential(auth, credential);
    console.log("✅ Firebase Auth (native) successful, UID:", result.user.uid);
    return result;
  };

  const handleGoogleLogin = async () => {
    if (isSigningIn) return;
    
    setIsSigningIn(true);
    
    try {
      const result = Platform.OS === "web"
        ? await handleGoogleLoginWeb()
        : await handleGoogleLoginNative();

      if (!result) return; // user cancelled or no success response

      // Create or update user document using setDoc with merge
      // This approach avoids read-before-write issues with Firestore rules
      const userDocRef = doc(db, "users", result.user.uid);
      
      try {
        console.log("📝 Creating/updating user document...");
        console.log("📝 User UID:", result.user.uid);
        console.log("📝 User Email:", result.user.email);
        
        const dataToWrite = {
          email: result.user.email?.toLowerCase().trim() || "",
          displayName: result.user.displayName || "",
          photoURL: result.user.photoURL || null,
          lastLogin: serverTimestamp(),
        };
        
        // Use setDoc with merge:true - this will create if not exists, or update if exists
        await setDoc(userDocRef, dataToWrite, { merge: true });
        console.log("✅ setDoc completed successfully!");
        
        // Now try to read and set default fields if they don't exist
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data() || {};
        
        // Only set these defaults if they don't already exist
        const updates: any = {};
        if (userData.createdAt === undefined) {
          updates.createdAt = serverTimestamp();
        }
        if (userData.isAdmin === undefined) {
          updates.isAdmin = false;
        }
        if (userData.privacy === undefined) {
          updates.privacy = {
            showProfile: true,
            showTotalRoutes: true,
            showHighestGrade: true,
            showFeedbackCount: true,
            showAverageRating: true,
            showGradeStats: true,
            showJoinDate: true,
          };
        }
        if (userData.stats === undefined) {
          updates.stats = {
            totalRoutesSent: 0,
            highestGrade: null,
            totalFeedbacks: 0,
            averageStarRating: 0,
          };
        }
        
        // Apply updates if there are any
        if (Object.keys(updates).length > 0) {
          await setDoc(userDocRef, updates, { merge: true });
          console.log("✅ User document defaults set:", Object.keys(updates));
        } else {
          console.log("✅ User document already complete");
        }
      } catch (firestoreError: any) {
        console.error("❌ Firestore error:", firestoreError.code, firestoreError.message);
        Alert.alert(
          "אזהרה", 
          "התחברת בהצלחה אך יש בעיה בשמירת הפרופיל. נסה להתחבר שוב או פנה לתמיכה.",
          [{ text: "אישור" }]
        );
      }
    } catch (error: any) {
      // Handle web popup closed/cancelled
      if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
        console.log("User cancelled sign-in (web popup)");
        return;
      }

      if (Platform.OS !== "web" && isErrorWithCode?.(error)) {
        switch (error.code) {
          case statusCodes?.SIGN_IN_CANCELLED:
            console.log("User cancelled sign-in");
            break;
          case statusCodes?.IN_PROGRESS:
            console.log("Sign-in already in progress");
            break;
          case statusCodes?.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("שגיאה", "Google Play Services לא זמין במכשיר זה");
            break;
          default:
            Alert.alert("שגיאה", "נכשל בהתחברות: " + error.message);
        }
      } else {
        console.error("Google sign-in error:", error);
        Alert.alert("שגיאה", "נכשל בהתחברות: " + (error.message || error.code));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.googleButton, isSigningIn && styles.googleButtonDisabled]}
      onPress={handleGoogleLogin}
      disabled={isSigningIn}
    >
      {isSigningIn ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text style={styles.googleButtonText}>🚀 התחברות עם Google</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    backgroundColor: "#db4437",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 5,
    textAlign: "right",
  },
});
