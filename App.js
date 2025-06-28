// App.js
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-config';
import { NavigationContainer } from '@react-navigation/native';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import WallMapScreen from './screens/WallMapScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={user ? 'HomeScreen' : 'LoginScreen'}>
          <Stack.Screen name="LoginScreen" component={LoginScreen} options={{ title: 'התחברות' }} />
          <Stack.Screen name="HomeScreen" component={HomeScreen} options={{ title: 'דף הבית' }} />
          <Stack.Screen name="WallMapScreen" component={WallMapScreen} options={{ title: 'מפת הקיר' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
