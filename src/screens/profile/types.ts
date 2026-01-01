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
  showHistory: boolean;
};

export type UserStats = {
  totalRoutesSent: number; // כל המסלולים שסגר אי פעם (כולל ארכיון)
  highestGrade: string; // הדירוג הגבוה ביותר אי פעם (כולל ארכיון)
  totalFeedbacks: number;
  averageStarRating: number;
  completionPercentage: number; // אחוז סגירה מהמסלולים שעל הקיר כרגע
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
  photoURL?: string;
  isFollowing?: boolean;
  isAdmin?: boolean;
};

export type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;
