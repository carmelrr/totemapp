// src/navigation/CommunityNavigator.tsx
// Navigator for all Community Routes screens

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@/features/theme/ThemeContext';
import {
  CommunityRoutesListScreen,
  AddCommunityRouteScreen,
  CommunityRouteDetailScreen,
} from '@/screens/CommunityRoutes';

export type CommunityStackParamList = {
  CommunityHome: undefined;
  AddCommunityRoute: undefined;
  CommunityRouteDetail: { routeId: string };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export const CommunityNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.headerGradient,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#fff',
        },
        headerTintColor: '#fff',
        headerTitleAlign: 'center',
        contentStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Stack.Screen
        name="CommunityHome"
        component={CommunityRoutesListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddCommunityRoute"
        component={AddCommunityRouteScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="CommunityRouteDetail"
        component={CommunityRouteDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default CommunityNavigator;
