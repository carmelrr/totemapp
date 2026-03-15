import React, { useState } from "react";
import { Platform, Alert, ActivityIndicator, View, StyleSheet } from "react-native";
import { OAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";
import { useLanguage } from "@/features/language";

let AppleAuthentication: any;
if (Platform.OS === "ios") {
  AppleAuthentication = require("expo-apple-authentication");
}

export default function AppleLoginButton() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { t } = useLanguage();

  if (Platform.OS !== "ios") return null;

  const handleAppleLogin = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }

      const oAuthProvider = new OAuthProvider("apple.com");
      const oAuthCredential = oAuthProvider.credential({
        idToken: credential.identityToken,
      });

      const result = await signInWithCredential(auth, oAuthCredential);

      // Create or update user document
      const userDocRef = doc(db, "users", result.user.uid);

      try {
        const dataToWrite: any = {
          lastLogin: serverTimestamp(),
        };

        // Apple only provides name/email on FIRST sign-in
        if (result.user.email) {
          dataToWrite.email = result.user.email.toLowerCase().trim();
        }
        if (credential.fullName) {
          const givenName = credential.fullName.givenName ?? "";
          const familyName = credential.fullName.familyName ?? "";
          const fullName = `${givenName} ${familyName}`.trim();
          if (fullName) {
            dataToWrite.displayName = fullName;
          }
        }

        await setDoc(userDocRef, dataToWrite, { merge: true });

        // Set defaults for new users
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data() || {};
        const updates: any = {};

        if (userData.createdAt === undefined) {
          updates.createdAt = serverTimestamp();
        }
        if (userData.isAdmin === undefined) {
          updates.isAdmin = false;
        }
        if (userData.displayName === undefined && !dataToWrite.displayName) {
          updates.displayName = result.user.email ?? "User";
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
        if (userData.acceptedTermsAt === undefined) {
          updates.acceptedTermsAt = serverTimestamp();
        }

        if (Object.keys(updates).length > 0) {
          await setDoc(userDocRef, updates, { merge: true });
        }
      } catch (firestoreError: any) {
        console.error("Firestore error after Apple sign-in:", firestoreError);
        Alert.alert(
          "אזהרה",
          "התחברת בהצלחה אך יש בעיה בשמירת הפרופיל. נסה להתחבר שוב או פנה לתמיכה.",
          [{ text: "אישור" }]
        );
      }
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        // User cancelled — do nothing
        return;
      }
      console.error("Apple Sign-In error:", error);
      Alert.alert(t.common.error, t.alerts.loginFailed(error.message || "Apple Sign-In failed"));
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isSigningIn) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#000" />
      </View>
    );
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={10}
      style={styles.appleButton}
      onPress={handleAppleLogin}
    />
  );
}

const styles = StyleSheet.create({
  appleButton: {
    width: "100%",
    height: 50,
    marginTop: 12,
  },
  loadingContainer: {
    width: "100%",
    height: 50,
    marginTop: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    borderRadius: 10,
  },
});
