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
import { AuthProvider } from "@/context/AuthContext";
import { AdminProvider } from "@/context/AdminContext";
import { RolesProvider } from "@/features/roles";
import { RolesManagementScreen } from "@/features/roles";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

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

  // Debug לחיצות - הוספת לוג לכל לחיצה
  const originalTouchableOpacity = require("react-native").TouchableOpacity;
  console.log("🔧 Touch debugging enabled");
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
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
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

  if (loading) return null;

  // If user is not logged in, show login screen
  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
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
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <AdminProvider>
                <RolesProvider>
                  <UserProvider isAdmin={isAdmin}>
                    <ThemedNavigator isAdmin={isAdmin} />
                  </UserProvider>
                </RolesProvider>
              </AdminProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
