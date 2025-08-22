import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AccessibilityInfo } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/features/data/firebase';
import WallMapScreen from '@/screens/routes/WallMapScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import UserProfileScreen from '@/screens/profile/UserProfileScreen';
import HomeScreen from '@/screens/HomeScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import AddRouteScreen from '@/screens/routes/AddRouteScreen';
import ColorPickerScreen from '@/screens/routes/ColorPickerScreen';
import LeaderboardScreen from '@/screens/social/LeaderboardScreen';
import SprayNavigator from '@/navigation/SprayNavigator';
import { UserProvider } from '@/features/auth/UserContext';
import { ThemeProvider, useTheme } from '@/features/theme/ThemeContext';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

// Enable React Native Screens for better performance and native feel
enableScreens();

// ✅ הגדרה להפחתת אנימציות נבחרות בלבד
if (__DEV__) {
  // בדיקה אם הפחתת תנועה מופעלת במכשיר
  AccessibilityInfo.isReduceMotionEnabled().then(reduceMotionEnabled => {
    if (reduceMotionEnabled) {
      console.log('Reduce motion is enabled - limiting complex animations only');
      // הגדרת Reanimated לצמצום אנימציות מסוימות בלבד
      if (global._WORKLET) {
        global._reduceMotion = true;
      }
    }
  });
  
  // Debug לחיצות - הוספת לוג לכל לחיצה
  const originalTouchableOpacity = require('react-native').TouchableOpacity;
  console.log('🔧 Touch debugging enabled');
}

const Stack = createNativeStackNavigator();

// Navigation wrapper that uses theme
function ThemedNavigator({ isAdmin }) {
  const { theme } = useTheme();
  
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.headerGradient,
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
            color: '#fff',
            fontFamily: 'System',
          },
          headerTintColor: '#fff',
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: 'בית' }}
        />
        <Stack.Screen 
          name="WallMapScreen" 
          component={WallMapScreen}
          options={{ title: 'מפת המסלולים' }}
        />
        <Stack.Screen 
          name="ProfileScreen" 
          component={ProfileScreen}
          options={{ title: 'פרופיל' }}
        />
        <Stack.Screen 
          name="UserProfile" 
          component={UserProfileScreen}
          options={{ title: 'פרופיל משתמש' }}
        />
        <Stack.Screen 
          name="AddRouteScreen" 
          component={AddRouteScreen}
          options={{ title: 'הוספת מסלול חדש' }}
        />
        <Stack.Screen 
          name="ColorPickerScreen" 
          component={ColorPickerScreen}
          options={{ title: 'בחירת צבע' }}
        />
        <Stack.Screen 
          name="LeaderboardScreen" 
          component={LeaderboardScreen}
          options={{ title: 'לוחות מובילים' }}
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
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setIsAdmin(data.isAdmin === true);
            global.__isAdmin = data.isAdmin === true;
          }
        } catch (e) {
          console.error('שגיאה בטעינת משתמש:', e);
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
          <NavigationContainer>
            <Stack.Navigator>
              <Stack.Screen 
                name="Login" 
                component={LoginScreen}
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <UserProvider isAdmin={isAdmin}>
            <ThemedNavigator isAdmin={isAdmin} />
          </UserProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
