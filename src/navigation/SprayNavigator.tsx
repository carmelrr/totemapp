// src/navigation/SprayNavigator.tsx
// Navigator for all SprayWall screens

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  AddWallScreen,
  AddRouteScreen,
  WallDetailScreen,
  RouteDetailsScreen,
  SprayRouteDetailScreen,
} from "@/screens/SprayWall";
import { Hold } from "@/features/spraywall/types";
import { useLanguage } from "@/features/language";

export type SprayStackParamList = {
  SprayHome: undefined;
  AddWall: undefined;
  AddRoute: { wallId?: string } | undefined;
  RouteDetails: { wallId: string; holds: Hold[] };
  SprayRouteDetail: { routeId: string; wallId: string };
};

const Stack = createNativeStackNavigator<SprayStackParamList>();

export const SprayNavigator: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerStyle: {
          backgroundColor: "#2a2a2a",
        },
        headerTitleStyle: {
          fontWeight: "bold",
          color: "#fff",
        },
        headerTintColor: "#fff",
        headerTitleAlign: "center",
        contentStyle: {
          backgroundColor: "#1a1a1a",
        },
      }}
    >
      <Stack.Screen
        name="SprayHome"
        component={WallDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddWall"
        component={AddWallScreen}
        options={{ title: t.nav.addNewWall }}
      />
      <Stack.Screen
        name="AddRoute"
        component={AddRouteScreen}
        options={{ title: t.nav.markHolds }}
      />
      <Stack.Screen
        name="RouteDetails"
        component={RouteDetailsScreen}
        options={{ title: t.nav.routeDetails }}
      />
      <Stack.Screen
        name="SprayRouteDetail"
        component={SprayRouteDetailScreen}
        options={{ title: t.nav.routeDetails }}
      />
    </Stack.Navigator>
  );
};

export default SprayNavigator;
