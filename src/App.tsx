import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AccessibilityInfo } from "react-native";
import { enableScreens } from "react-native-screens";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import UserProfileScreen from "@/screens/profile/UserProfileScreen";
import HomeScreen from "@/screens/HomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import ColorPickerScreen from "@/screens/routes/ColorPickerScreen";
import LeaderboardScreen from "@/screens/social/LeaderboardScreen";
import SprayNavigator from "@/navigation/SprayNavigator";
import RoutesMapScreen from "@/features/routes-map/screens/RoutesMapScreen";
import AddRouteMapScreen from "@/features/routes-map/screens/AddRouteMapScreen";
import AnalyticsScreen from "@/components/analytics/AnalyticsScreen";
import { UserProvider } from "@/features/auth/UserContext";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
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

// Navigation wrapper that uses theme
function ThemedNavigator({ isAdmin }: { isAdmin: boolean }) {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator
        id={undefined}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.headerGradient,
          },
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 20,
            color: "#fff",
            fontFamily: "System",
          },
          headerTintColor: "#fff",
          headerTitleAlign: "center",
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "בית" }}
        />
        <Stack.Screen
          name="ProfileScreen"
          component={ProfileScreen}
          options={{ title: "פרופיל" }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ title: "פרופיל משתמש" }}
        />
        <Stack.Screen
          name="RoutesMap"
          component={RoutesMapScreen}
          options={{ title: "Routes Map" }}
        />
        <Stack.Screen
          name="AddRoute"
          component={AddRouteMapScreen}
          options={{
            title: "Add Route",
            presentation: 'modal',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="ColorPickerScreen"
          component={ColorPickerScreen}
          options={{ title: "בחירת צבע" }}
        />
        <Stack.Screen
          name="LeaderboardScreen"
          component={LeaderboardScreen}
          options={{ title: "לוחות מובילים" }}
        />
        <Stack.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ title: "אנליטיקה" }}
        />
        <Stack.Screen
          name="SprayWall"
          component={SprayNavigator}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
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
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider>
            <UserProvider isAdmin={isAdmin}>
              <ThemedNavigator isAdmin={isAdmin} />
            </UserProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
