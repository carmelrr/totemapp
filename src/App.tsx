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
import ShiftsNavigator from "@/navigation/ShiftsNavigator";
import { UserProvider } from "@/features/auth/UserContext";
import { ThemeProvider } from "@/features/theme/ThemeContext";
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
import { WallEditorScreen } from "@/features/wall-editor";
import AdminPanelScreen from "@/screens/admin/AdminPanelScreen";
import AdminStatisticsScreen from "@/screens/admin/AdminStatisticsScreen";
import WallTapeManagementScreen from "@/features/routes-map/screens/WallTapeManagementScreen";
import FontPreviewScreen from "@/screens/admin/FontPreviewScreen";
import DeleteAccountScreen from "@/screens/profile/DeleteAccountScreen";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { GuestProvider, useGuest } from "@/context/GuestContext";

if (__DEV__) {
  console.log("🚀 App.tsx starting to load...");
}

// Layout is always forced to LTR in App.js for consistent visual layout.
// Hebrew text direction is handled per-component via writingDirection style.

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
// Deep-link configuration
const linking = {
  prefixes: ['totem-app://'],
  config: {
    screens: {
      DeleteAccount: 'delete-account',
      MainTabs: {
        screens: {
          HomeTab: 'home',
          ProfileTab: 'profile',
        },
      },
    },
  },
};

function ThemedNavigator({ isAdmin }: { isAdmin: boolean }) {
  return (
    <NavigationContainer linking={linking}>
      <RootStack.Navigator 
        id={undefined}
        screenOptions={{ headerShown: false }}
      >
        <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
        <RootStack.Group 
          screenOptions={{ 
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        >
          <RootStack.Screen name="Competitions" component={CompetitionNavigator} />
          <RootStack.Screen 
            name="Shifts" 
            component={ShiftsNavigator}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: false,
            }}
          />
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
          <RootStack.Screen 
            name="WallEditor" 
            component={WallEditorScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen 
            name="AdminPanel" 
            component={AdminPanelScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen 
            name="AdminStatistics" 
            component={AdminStatisticsScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen 
            name="WallTapeManagement" 
            component={WallTapeManagementScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen 
            name="FontPreview" 
            component={FontPreviewScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen 
            name="DeleteAccount" 
            component={DeleteAccountScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  if (__DEV__) console.log("🔧 App function starting...");
  return (
    <GestureHandlerRootView style={{ flex: 1, direction: 'ltr', backgroundColor: '#0B0B0F' }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <GuestProvider>
              <AuthProvider>
                <AppContent />
              </AuthProvider>
            </GuestProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { isGuest } = useGuest();
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
          // Try to get user document, with retries for new users
          let userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          
          // If document doesn't exist, wait a bit and retry (for new Google sign-ins)
          if (!userDoc.exists()) {
            if (__DEV__) console.log("🔧 User document not found, waiting for creation...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          }
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (__DEV__) console.log("🔧 User document found, isAdmin:", data.isAdmin);
            setIsAdmin(data.isAdmin === true);
            (globalThis as any).__isAdmin = data.isAdmin === true;
          } else {
            if (__DEV__) console.log("🔧 User document still not found after retry");
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

  // If user is not logged in and not a guest, show login screen
  if (!user && !isGuest) {
    if (__DEV__) console.log("🔧 No user, showing login screen");
    return (
      <NavigationContainer>
        <Stack.Navigator id={undefined}>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (__DEV__) console.log("🔧 User logged in or guest, rendering main app");
  return (
    <ErrorBoundary>
      <AdminProvider>
        <DefaultAvatarProvider>
          <RolesProvider>
            <UserProvider isAdmin={isAdmin}>
              <ThemedNavigator isAdmin={isAdmin} />
            </UserProvider>
          </RolesProvider>
        </DefaultAvatarProvider>
      </AdminProvider>
    </ErrorBoundary>
  );
}
