import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SprayWallHomeScreen from "@/screens/SprayWall/SprayWallHomeScreen";
import SprayResetScreen from "@/screens/SprayWall/SprayResetScreen";
import SprayEditorScreen from "@/screens/SprayWall/SprayEditorScreen";
import SprayLeaderboardScreen from "@/screens/SprayWall/SprayLeaderboardScreen";

type SprayStackParamList = {
  SprayWallHome: undefined;
  SprayReset: undefined;
  SprayEditor: undefined;
  SprayLeaderboard: undefined;
};

const Stack = createNativeStackNavigator<SprayStackParamList>();

const SprayNavigator = () => {
  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="SprayWallHome"
        component={SprayWallHomeScreen}
        options={{
          title: "Spray Wall",
        }}
      />
      <Stack.Screen
        name="SprayReset"
        component={SprayResetScreen}
        options={{
          title: "Reset Spray Wall",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="SprayEditor"
        component={SprayEditorScreen}
        options={{
          title: "Add Route",
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="SprayLeaderboard"
        component={SprayLeaderboardScreen}
        options={{
          title: "Leaderboard",
        }}
      />
    </Stack.Navigator>
  );
};

export default SprayNavigator;
