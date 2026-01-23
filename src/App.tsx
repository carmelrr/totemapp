import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccessibilityInfo } from "react-native";
import { enableScreens } from "react-native-screens";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";
import LoginScreen from "@/screens/auth/LoginScreen";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import CompetitionNavigator from "@/navigation/CompetitionNavigator";
import { UserProvider } from "@/features/auth/UserContext";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeContext";
import { LanguageProvider } from "@/features/language";
import { AuthProvider } from "@/context/AuthContext";
import { AdminProvider } from "@/context/AdminContext";
import { DefaultAvatarProvider } from "@/context/DefaultAvatarContext";
import { RolesProvider } from "@/features/roles";
import { RolesManagementScreen } from "@/features/roles";
import { 
  AnnouncementsManagementScreen, 
  AnnouncementEditorScreen 
} from "@/features/announcements";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

if (__DEV__) {
  console.log("🚀 App.tsx starting to load...");
}

// Enable React Native Screens for better performance and native feel
enableScreens();

// ✅ הגדרה להפחתת אנימציות נבחרות בלבד
if (__DEV__) {
  // בדיקה אם הפחתת תנועה מופעלת במכשיר
  AccessibilityInfo.isReduceMotionEnabled().then((reduceMotionEnabled) => {
    if (reduceMotionEnabled) {
      console.log(
        "Reduce motion is enabled - limiting complex animations only",
      );
      // הגדרת Reanimated לצמצום אנימציות מסוימות בלבד
      try {
        if ((globalThis as any)._WORKLET) {
          (globalThis as any)._reduceMotion = true;
        }
      } catch (e) {
        // Ignore errors in global access
      }
    }
  });
}

const Stack = createNativeStackNavigator();

// Root stack that includes tabs and competition screens
const RootStack = createNativeStackNavigator();

// Navigation wrapper that uses the new Tab Navigator
function ThemedNavigator({ isAdmin }: { isAdmin: boolean }) {
  return (
    <NavigationContainer>
      <RootStack.Navigator 
        id={undefined}
        screenOptions={{ headerShown: false }}
      >
        <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
        <RootStack.Group 
          screenOptions={{ 
            presentation: 'card',
            animation: 'slide_from_left',
          }}
        >
          <RootStack.Screen name="Competitions" component={CompetitionNavigator} />
          <RootStack.Screen 
            name="RolesManagement" 
            component={RolesManagementScreen}
            options={{
              headerShown: true,
              title: 'ניהול תפקידים',
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen 
            name="AnnouncementsManagement" 
            component={AnnouncementsManagementScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen 
            name="AnnouncementEditor" 
            component={AnnouncementEditorScreen}
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  if (__DEV__) console.log("🔧 App function starting...");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (__DEV__) console.log("🔧 Setting up auth state change listener...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (__DEV__) console.log("🔧 Auth state changed:", firebaseUser ? "User logged in" : "No user");
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (__DEV__) console.log("🔧 User document found, isAdmin:", data.isAdmin);
            setIsAdmin(data.isAdmin === true);
            (globalThis as any).__isAdmin = data.isAdmin === true;
          }
        } catch (e) {
          console.error("שגיאה בטעינת משתמש:", e);
        }
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return null;
  }

  // If user is not logged in, show login screen
  if (!user) {
    if (__DEV__) console.log("🔧 No user, showing login screen");
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <NavigationContainer>
                  <Stack.Navigator id={undefined}>
                    <Stack.Screen
                      name="Login"
                      component={LoginScreen}
                      options={{ headerShown: false }}
                    />
                  </Stack.Navigator>
                </NavigationContainer>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (__DEV__) console.log("🔧 User logged in, rendering main app");
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <AdminProvider>
                  <DefaultAvatarProvider>
                    <RolesProvider>
                      <UserProvider isAdmin={isAdmin}>
                        <ThemedNavigator isAdmin={isAdmin} />
                      </UserProvider>
                    </RolesProvider>
                  </DefaultAvatarProvider>
                </AdminProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
