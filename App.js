import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config';
import WallMapScreen from './screens/WallMapScreen';
import ProfileScreen from './screens/ProfileScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import AddRouteScreen from './screens/AddRouteScreen';
import ColorPickerScreen from './screens/ColorPickerScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import { UserProvider } from './context/UserContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

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
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <UserProvider isAdmin={isAdmin}>
          <ThemedNavigator isAdmin={isAdmin} />
        </UserProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
