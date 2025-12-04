// src/navigation/SprayNavigator.tsx
// Navigator for all SprayWall screens

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  SprayWallHomeScreen,
  AddWallScreen,
  AddRouteScreen,
  WallDetailScreen,
  RouteDetailsScreen,
  SprayRouteDetailScreen,
} from "@/screens/SprayWall";
import { Hold, SprayRoute } from "@/features/spraywall/types";

export type SprayStackParamList = {
  SprayHome: undefined;
  SprayWallHome: undefined; // Alias for SprayHome
  AddWall: undefined;
  AddRoute: { wallId?: string } | undefined;
  RouteDetails: { wallId: string; holds: Hold[] };
  WallDetail: { wallId: string; wallName?: string };
  SprayRouteDetail: { sprayRoute: SprayRoute; wallId: string };
};

const Stack = createNativeStackNavigator<SprayStackParamList>();

export const SprayNavigator: React.FC = () => {
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
        component={SprayWallHomeScreen}
        options={{ title: "Spray Wall" }}
      />
      <Stack.Screen
        name="SprayWallHome"
        component={SprayWallHomeScreen}
        options={{ title: "Spray Wall", headerShown: false }}
      />
      <Stack.Screen
        name="AddWall"
        component={AddWallScreen}
        options={{ title: "הוסף קיר חדש" }}
      />
      <Stack.Screen
        name="AddRoute"
        component={AddRouteScreen}
        options={{ title: "סמן אחיזות" }}
      />
      <Stack.Screen
        name="RouteDetails"
        component={RouteDetailsScreen}
        options={{ title: "פרטי המסלול" }}
      />
      <Stack.Screen
        name="WallDetail"
        component={WallDetailScreen}
        options={({ route }) => ({
          title: route.params?.wallName || "פרטי קיר",
        })}
      />
      <Stack.Screen
        name="SprayRouteDetail"
        component={SprayRouteDetailScreen}
        options={({ route }) => ({
          title: route.params?.sprayRoute?.name || "פרטי מסלול",
        })}
      />
    </Stack.Navigator>
  );
};

export default SprayNavigator;
