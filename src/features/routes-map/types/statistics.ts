// src/features/routes-map/types/statistics.ts
// Types for admin statistics dashboard

export interface RouteOverview {
  totalActive: number;
  totalArchived: number;
  totalDraft: number;
  averageRating: number;
  totalFeedbacks: number;
  totalCompletions: number;
}

export interface TopRoute {
  id: string;
  name: string;
  nameHe?: string;
  nameEn?: string;
  grade: string;
  color: string;
  completionCount: number;
  averageStarRating: number;
  feedbackCount: number;
}

export interface GradeDistributionEntry {
  grade: string;
  count: number;
}

export interface UserEngagement {
  totalUsers: number;
  usersWithCompletions: number;
  totalSends: number;
  totalFlashes: number;
  flashRate: number; // percentage 0-100
}

export interface SprayWallStats {
  totalSprayRoutes: number;
  averageRating: number;
  totalFeedbacks: number;
  topSprayRoutes: {
    id: string;
    name: string;
    grade: string;
    topsCount: number;
    averageStarRating: number;
  }[];
}

export interface ActivityPatterns {
  peakHours: { hour: number; count: number }[];
  peakDays: { day: number; dayName: string; count: number }[];
}

export interface CompetitionOverview {
  totalCompetitions: number;
  activeCompetitions: number;
  totalParticipants: number;
}

export interface RatingDistribution {
  stars: { rating: number; count: number }[];
  totalFeedbacks: number;
}

export interface CommunityRoutesOverview {
  totalRoutes: number;
  averageRating: number;
  totalSends: number;
}

export interface WallStatistics {
  routeOverview: RouteOverview;
  topRoutes: TopRoute[];
  lowestRatedRoutes: TopRoute[];
  gradeDistribution: GradeDistributionEntry[];
  userEngagement: UserEngagement;
  sprayWallStats: SprayWallStats;
  activityPatterns: ActivityPatterns;
  competitionOverview: CompetitionOverview;
  ratingDistribution: RatingDistribution;
  communityRoutesOverview: CommunityRoutesOverview;
}
