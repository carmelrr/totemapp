// src/types/navigation.ts
// Central navigation type definitions for the app

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// Import types from features
import type { Hold } from '@/features/spraywall/types';

// ===== Root Stack (App.tsx) =====
// Import shift types
import type { Shift } from '@/features/shifts/types';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList>;
  Competitions: NavigatorScreenParams<CompetitionStackParamList>;
  Shifts: NavigatorScreenParams<ShiftsStackParamList>;
  RolesManagement: undefined;
  AdminStatistics: undefined;
  DeleteAccount: undefined;
  ClassPlanner: undefined;
};

// ===== Shifts Stack =====
export type ShiftsStackParamList = {
  ShiftsCalendar: undefined;
  ShiftEditor: { shift?: Shift } | undefined;
  ShiftDetail: { shift: Shift };
  ShiftRolesManagement: undefined;
};

// ===== Main Tab Navigator =====
export type RootTabParamList = {
  HomeTab: undefined;
  RoutesMapTab: NavigatorScreenParams<RoutesMapStackParamList>;
  CommunityTab: NavigatorScreenParams<CommunityStackParamList>;
  LeaderboardTab: undefined;
  SprayWallTab: NavigatorScreenParams<SprayStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// ===== Routes Map Stack =====
export type RoutesMapStackParamList = {
  RoutesMap: undefined;
  AddRoute: undefined;
  RouteDetails: { route: any };
  ColorPickerScreen: undefined;
};

// ===== Profile Stack =====
export type ProfileStackParamList = {
  Profile: undefined;
  UserProfile: { userId: string; displayName?: string };
};

// ===== Spray Wall Stack =====
export type SprayStackParamList = {
  SprayHome: undefined;
  AddWall: undefined;
  AddRoute: { wallId?: string } | undefined;
  RouteDetails: { wallId: string; holds: Hold[] };
  SprayRouteDetail: { routeId: string; wallId: string };
};

// ===== Community Stack =====
export type CommunityStackParamList = {
  CommunityHome: undefined;
  AddCommunityRoute: undefined;
  CommunityRouteDetail: { routeId: string };
};

// ===== Competition Stack =====
export type CompetitionStackParamList = {
  CompetitionsList: undefined;
  CreateCompetition: undefined;
  ManageCompetition: { 
    competitionId: string; 
    initialTab?: 'overview' | 'participants' | 'judges' | 'leaderboard';
  };
  ManageParticipants: { competitionId: string };
  ManageCategories: { competitionId: string };
  ManageCompetitionRoutes: { competitionId: string };
  JudgeEntry: { competitionId: string };
  CompetitionRegistration: { competitionId: string };
};

// ===== Composite Navigation Props =====

// Navigation prop for screens in the root stack
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Navigation prop for screens in any tab
export type MainTabNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

// Navigation prop for screens in Routes Map stack
export type RoutesMapNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RoutesMapStackParamList>,
  MainTabNavigationProp
>;

// Navigation prop for screens in Profile stack
export type ProfileNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList>,
  MainTabNavigationProp
>;

// Navigation prop for screens in Spray Wall stack
export type SprayNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<SprayStackParamList>,
  MainTabNavigationProp
>;

// Navigation prop for screens in Community stack
export type CommunityNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<CommunityStackParamList>,
  MainTabNavigationProp
>;

// Navigation prop for screens in Competition stack
export type CompetitionNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<CompetitionStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ===== Type declaration for react-navigation =====
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
