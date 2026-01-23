// src/navigation/MainTabNavigator.tsx
// Bottom Tab Navigator - Instagram-style navigation

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";

// Theme
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";

// Screens
import HomeScreen from "@/screens/HomeScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import UserProfileScreen from "@/screens/profile/UserProfileScreen";
import LeaderboardScreen from "@/screens/social/LeaderboardScreenV2";
import RoutesMapScreen from "@/features/routes-map/screens/RoutesMapScreen";
import RoutesArchiveScreen from "@/features/routes-map/screens/RoutesArchiveScreen";
import AddRouteMapScreen from "@/features/routes-map/screens/AddRouteMapScreen";
import RouteDetailsScreen from "@/screens/routes/RouteDetailsScreen";
import ColorPickerScreen from "@/screens/routes/ColorPickerScreen";

// Nested Navigators
import SprayNavigator from "./SprayNavigator";
import CommunityNavigator from "./CommunityNavigator";

// ===== Type Definitions =====

export type RootTabParamList = {
  HomeTab: undefined;
  RoutesMapTab: undefined;
  CommunityTab: undefined;
  LeaderboardTab: undefined;
  SprayWallTab: undefined;
  ProfileTab: undefined;
};

export type RoutesMapStackParamList = {
  RoutesMap: undefined;
  AddRoute: undefined;
  RouteDetails: { route: any };
  ColorPickerScreen: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  UserProfile: { userId: string };
};

// ===== Stack Navigators for each Tab =====

const RoutesMapStack = createNativeStackNavigator<RoutesMapStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// Routes Map Stack Navigator
function RoutesMapStackNavigator() {
  const { theme } = useTheme();

  return (
    <RoutesMapStack.Navigator
      id={undefined}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.headerGradient,
        },
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 20,
          color: "#fff",
        },
        headerTintColor: "#fff",
        headerTitleAlign: "center",
      }}
    >
      <RoutesMapStack.Screen
        name="RoutesMap"
        component={RoutesMapScreen}
        options={{ headerShown: false }}
      />
      <RoutesMapStack.Screen
        name="AddRoute"
        component={AddRouteMapScreen}
        options={{
          title: "הוסף מסלול",
          presentation: "modal",
          gestureEnabled: true,
        }}
      />
      <RoutesMapStack.Screen
        name="RouteDetails"
        component={RouteDetailsScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <RoutesMapStack.Screen
        name="ColorPickerScreen"
        component={ColorPickerScreen}
        options={{ title: "בחירת צבע" }}
      />
      <RoutesMapStack.Screen
        name="RoutesArchive"
        component={RoutesArchiveScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </RoutesMapStack.Navigator>
  );
}

// Profile Stack Navigator
function ProfileStackNavigator() {
  const { theme } = useTheme();

  return (
    <ProfileStack.Navigator
      id={undefined}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.headerGradient,
        },
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 20,
          color: "#fff",
        },
        headerTintColor: "#fff",
        headerTitleAlign: "center",
      }}
    >
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: "פרופיל משתמש" }}
      />
    </ProfileStack.Navigator>
  );
}

// ===== Main Tab Navigator =====

const Tab = createBottomTabNavigator<RootTabParamList>();

type TabIconName = "home" | "home-outline" | "map" | "map-outline" | "trophy" | "trophy-outline" | "grid" | "grid-outline" | "person" | "person-outline" | "images" | "images-outline";

interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
}

export function MainTabNavigator() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }: TabBarIconProps) => {
          let iconName: TabIconName;

          switch (route.name) {
            case "HomeTab":
              iconName = focused ? "home" : "home-outline";
              break;
            case "RoutesMapTab":
              iconName = focused ? "map" : "map-outline";
              break;
            case "CommunityTab":
              iconName = focused ? "images" : "images-outline";
              break;
            case "LeaderboardTab":
              iconName = focused ? "trophy" : "trophy-outline";
              break;
            case "SprayWallTab":
              iconName = focused ? "grid" : "grid-outline";
              break;
            case "ProfileTab":
              iconName = focused ? "person" : "person-outline";
              break;
            default:
              iconName = "home-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingTop: 5,
          paddingBottom: insets.bottom + 10, // Use safe area bottom + extra padding
          height: (Platform.OS === "ios" ? 85 : 65) + insets.bottom, // Add safe area height
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerShown: false, // Headers are handled by stack navigators
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: t.nav.home,
        }}
      />
      <Tab.Screen
        name="RoutesMapTab"
        component={RoutesMapStackNavigator}
        options={{
          tabBarLabel: t.nav.routesMap,
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            // Reset the stack to the first screen when tab is pressed
            const routeName = getFocusedRouteNameFromRoute(route);
            if (routeName && routeName !== 'RoutesMap') {
              e.preventDefault();
              navigation.reset({
                index: 0,
                routes: [{ name: 'RoutesMapTab' }],
              });
            }
          },
        })}
      />
      <Tab.Screen
        name="CommunityTab"
        component={CommunityNavigator}
        options={{
          tabBarLabel: t.nav.community,
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const routeName = getFocusedRouteNameFromRoute(route);
            if (routeName && routeName !== 'CommunityHome') {
              e.preventDefault();
              navigation.reset({
                index: 0,
                routes: [{ name: 'CommunityTab' }],
              });
            }
          },
        })}
      />
      <Tab.Screen
        name="LeaderboardTab"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: t.nav.leaderboard,
        }}
      />
      <Tab.Screen
        name="SprayWallTab"
        component={SprayNavigator}
        options={{
          tabBarLabel: t.nav.sprayWall,
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const routeName = getFocusedRouteNameFromRoute(route);
            if (routeName && routeName !== 'SprayHome') {
              // Prevent default behavior
              e.preventDefault();
              // Reset the stack to initial state
              navigation.reset({
                index: 0,
                routes: [{ name: 'SprayWallTab' }],
              });
            }
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: t.nav.profile,
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            // Always reset to Profile (user's own profile) when tab is pressed
            const routeName = getFocusedRouteNameFromRoute(route);
            if (routeName && routeName !== 'Profile') {
              // Prevent default behavior
              e.preventDefault();
              // Reset the stack to initial state - this clears the history
              navigation.reset({
                index: 0,
                routes: [{ name: 'ProfileTab' }],
              });
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

export default MainTabNavigator;
