/**
 * @fileoverview Competition Navigator
 * @description Stack navigator for competition-related screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@/features/theme/ThemeContext';

// Competition Screens
import {
  CompetitionsListScreen,
  CreateCompetitionScreen,
  ManageCompetitionScreen,
  ManageParticipantsScreen,
  ManageJudgesScreen,
  ManageCompetitionRoutesScreen,
  JudgeEntryScreen,
} from '@/features/competitions';

export type CompetitionStackParamList = {
  CompetitionsList: undefined;
  CreateCompetition: undefined;
  ManageCompetition: { competitionId: string };
  ManageParticipants: { competitionId: string };
  ManageJudges: { competitionId: string };
  ManageCompetitionRoutes: { competitionId: string };
  JudgeEntry: { competitionId: string };
};

const Stack = createNativeStackNavigator<CompetitionStackParamList>();

export default function CompetitionNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left', // RTL friendly
        contentStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Stack.Screen 
        name="CompetitionsList" 
        component={CompetitionsListScreen} 
      />
      <Stack.Screen 
        name="CreateCompetition" 
        component={CreateCompetitionScreen}
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="ManageCompetition" 
        component={ManageCompetitionScreen} 
      />
      <Stack.Screen 
        name="ManageParticipants" 
        component={ManageParticipantsScreen} 
      />
      <Stack.Screen 
        name="ManageJudges" 
        component={ManageJudgesScreen} 
      />
      <Stack.Screen 
        name="ManageCompetitionRoutes" 
        component={ManageCompetitionRoutesScreen} 
      />
      <Stack.Screen 
        name="JudgeEntry" 
        component={JudgeEntryScreen}
        options={{
          gestureEnabled: false, // Prevent accidental back swipe when entering results
        }}
      />
    </Stack.Navigator>
  );
}
