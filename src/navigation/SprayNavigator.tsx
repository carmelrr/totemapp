import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SprayWallHomeScreen from '../screens/spray/SprayWallHomeScreen';
import SprayResetScreen from '../screens/spray/SprayResetScreen';
import SprayEditorScreen from '../screens/spray/SprayEditorScreen';
import SprayLeaderboardScreen from '../screens/spray/SprayLeaderboardScreen';

const Stack = createNativeStackNavigator();

const SprayNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="SprayWallHome" 
        component={SprayWallHomeScreen}
        options={{
          title: 'Spray Wall',
        }}
      />
      <Stack.Screen 
        name="SprayReset" 
        component={SprayResetScreen}
        options={{
          title: 'Reset Spray Wall',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="SprayEditor" 
        component={SprayEditorScreen}
        options={{
          title: 'Add Route',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen 
        name="SprayLeaderboard" 
        component={SprayLeaderboardScreen}
        options={{
          title: 'Leaderboard',
        }}
      />
    </Stack.Navigator>
  );
};

export default SprayNavigator;
