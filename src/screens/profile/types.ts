import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type ProfileStackParamList = {
  UserProfile: { userId: string };
  // add other screens if needed
};

export type PrivacySettings = {
  showTotalRoutes: boolean;
  showHighestGrade: boolean;
  showFeedbackCount: boolean;
  showAverageRating: boolean;
  showGradeStats: boolean;
  showJoinDate: boolean;
};

export type UserStats = {
  totalRoutesSent: number;
  highestGrade: string;
  totalFeedbacks: number;
  averageStarRating: number;
  joinDate: Date | null;
};

export type GradeStatsEntry = { 
  total: number; 
  completed: number; 
  percentage: number; 
};

export type GradeStatsMap = Record<string, GradeStatsEntry>;

export type SocialUser = { 
  id: string; 
  displayName?: string; 
  email?: string; 
  avatar?: string; 
  isFollowing?: boolean;
};

export type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;
