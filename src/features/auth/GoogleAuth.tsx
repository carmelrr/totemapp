import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet, Alert, Platform, ActivityIndicator } from "react-native";
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";
import Constants from "expo-constants";

// Configure Google Sign-In
GoogleSignin.configure({
  // Web client ID from Google Cloud Console (required for Firebase auth)
  webClientId: Constants.expoConfig?.extra?.webClientId || "720872675049-60m0tk2krk77qi5tdf699o9kmlpsfdsd.apps.googleusercontent.com",
  // iOS client ID (optional, uses GoogleService-Info.plist by default)
  iosClientId: Constants.expoConfig?.extra?.iosClientId,
  offlineAccess: false,
  scopes: ["profile", "email"],
});

export default function GoogleLoginButton() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (isSigningIn) return;
    
    setIsSigningIn(true);
    
    try {
      // Check if Play Services are available (Android only)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Sign in with Google
      const response = await GoogleSignin.signIn();
      
      if (isSuccessResponse(response)) {
        const { idToken } = response.data;
        
        if (!idToken) {
          throw new Error("No ID token received from Google");
        }
        
        // Create Firebase credential with the Google ID token
        const credential = GoogleAuthProvider.credential(idToken);
        
        // Sign in to Firebase
        const result = await signInWithCredential(auth, credential);
        console.log("✅ Firebase Auth successful, UID:", result.user.uid);
        
        // Create or update user document using setDoc with merge
        // This approach avoids read-before-write issues with Firestore rules
        const userDocRef = doc(db, "users", result.user.uid);
        
        try {
          console.log("📝 Creating/updating user document...");
          console.log("📝 User UID:", result.user.uid);
          console.log("📝 User Email:", result.user.email);
          console.log("📝 db instance:", db ? "exists" : "null");
          console.log("📝 userDocRef path:", userDocRef.path);
          
          const dataToWrite = {
            email: result.user.email?.toLowerCase().trim() || "",
            displayName: result.user.displayName || "",
            photoURL: result.user.photoURL || null,
            lastLogin: serverTimestamp(),
          };
          console.log("📝 Data to write:", JSON.stringify(dataToWrite, null, 2));
          
          // Use setDoc with merge:true - this will create if not exists, or update if exists
          // Only sets the base fields that should always exist
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
          // Don't block login if Firestore fails - user is already authenticated
          // But show a warning
          Alert.alert(
            "אזהרה", 
            "התחברת בהצלחה אך יש בעיה בשמירת הפרופיל. נסה להתחבר שוב או פנה לתמיכה.",
            [{ text: "אישור" }]
          );
        }
      }
    } catch (error: any) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User cancelled the sign-in flow
            console.log("User cancelled sign-in");
            break;
          case statusCodes.IN_PROGRESS:
            // Sign-in is already in progress
            console.log("Sign-in already in progress");
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("שגיאה", "Google Play Services לא זמין במכשיר זה");
            break;
          default:
            Alert.alert("שגיאה", "נכשל בהתחברות: " + error.message);
        }
      } else {
        Alert.alert("שגיאה", "נכשל בהתחברות: " + error.message);
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
