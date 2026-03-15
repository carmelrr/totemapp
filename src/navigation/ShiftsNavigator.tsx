/**
 * @fileoverview Shifts Navigator
 * @description Stack navigator for shift management screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@/features/theme/ThemeContext';
import {
  ShiftsCalendarScreen,
  ShiftEditorScreen,
  ShiftDetailScreen,
  ShiftRolesManagementScreen,
} from '@/features/shifts';
import type { Shift } from '@/features/shifts';

export type ShiftsStackParamList = {
  ShiftsCalendar: undefined;
  ShiftEditor: { shift?: Shift } | undefined;
  ShiftDetail: { shift: Shift };
  ShiftRolesManagement: undefined;
};

const Stack = createNativeStackNavigator<ShiftsStackParamList>();

export default function ShiftsNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
        contentStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Stack.Screen name="ShiftsCalendar" component={ShiftsCalendarScreen} />
      <Stack.Screen name="ShiftEditor" component={ShiftEditorScreen} />
      <Stack.Screen name="ShiftDetail" component={ShiftDetailScreen} />
      <Stack.Screen name="ShiftRolesManagement" component={ShiftRolesManagementScreen} />
    </Stack.Navigator>
  );
}
