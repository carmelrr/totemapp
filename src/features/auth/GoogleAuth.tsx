import React from "react";
import { TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";
import Constants from "expo-constants";

export default function GoogleLoginButton() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Constants.expoConfig.extra.expoClientId,
    iosClientId: Constants.expoConfig.extra.iosClientId,
    androidClientId: Constants.expoConfig.extra.androidClientId,
  });

  React.useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      signInWithCredential(auth, credential)
        .then(async (result) => {
          // Check if user document exists, if not create it
          const userDocRef = doc(db, "users", result.user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Create user document for new Google users
            await setDoc(userDocRef, {
              email: result.user.email?.toLowerCase().trim() || "",
              displayName: result.user.displayName || "",
              photoURL: result.user.photoURL || null,
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
          } else if (!userDoc.data()?.email) {
            // Update existing document with email if missing
            await setDoc(userDocRef, {
              email: result.user.email?.toLowerCase().trim() || "",
            }, { merge: true });
          }
          
          Alert.alert("הצלחה", `ברוך הבא ${result.user.displayName}!`);
        })
        .catch((error) => {
          Alert.alert("שגיאה", "נכשל בהתחברות: " + error.message);
        });
    } else if (response?.type === "error") {
      Alert.alert("שגיאה", "נכשל בהתחברות Google");
    }
  }, [response]);

  const handleGoogleLogin = async () => {
    try {
      await promptAsync();
    } catch (error) {
      Alert.alert("שגיאה", "נכשל בפתיחת Google Login: " + error.message);
    }
  };

  return (
    <TouchableOpacity
      style={styles.googleButton}
      onPress={handleGoogleLogin}
      disabled={!request}
    >
      <Text style={styles.googleButtonText}>🚀 התחברות עם Google</Text>
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
  googleButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 5,
    textAlign: "right",
  },
});
