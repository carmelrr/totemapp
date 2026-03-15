// src/features/statistics/types.ts
// Type definitions for the admin statistics module

// ===== Date Filtering =====
export type DatePeriod = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ===== Dashboard =====
export interface DashboardData {
  activeRoutes: number;
  activeRoutesChange: number; // % change from previous period
  avgRating: number;
  activeUsers: number;
  dailyActivity: number[]; // sparkline data points
  sprayRoutesCount: number;
  topSprayRoute: { name: string; topsCount: number } | null;
  newCommunityRoutes: number;
  communityChange: number; // % change from previous period
  totalFeedbacks: number;
  flashRate: number;
}

// ===== Routes Analytics =====
export interface RoutesKPIs {
  activeRoutes: number;
  avgRating: number;
  totalSends: number;
  flashRate: number;
}

export interface GradeDistributionEntry {
  grade: string;
  count: number;
  avgRating?: number;
  totalSends?: number;
}

export type GradeFilter = 'all' | 'active' | 'archived';

export interface GradeConsensusEntry {
  routeId: string;
  routeName: string;
  routeNameHe?: string;
  routeNameEn?: string;
  officialGrade: string;
  suggestedGradeAvg: number;
  deviation: number;
  voteCount: number;
}

export interface TopRouteEntry {
  id: string;
  name: string;
  nameHe?: string;
  nameEn?: string;
  grade: string;
  color: string;
  sends: number;
  flashes: number;
  rating: number;
  feedbacks: number;
  createdAt?: Date;
}

export type RouteSortField = 'sends' | 'flashes' | 'rating' | 'feedbacks';

export interface HeatmapCell {
  hour: number;
  day: number;
  count: number;
}

export interface ActivityHeatmapData {
  cells: HeatmapCell[];
  maxValue: number;
}

export interface GradeHourData {
  hour: number;
  easy: number;   // VB-V2
  medium: number;  // V3-V5
  hard: number;    // V6-V8
  elite: number;   // V9+
}

export interface RatingDistribution {
  stars: { rating: number; count: number }[];
  totalFeedbacks: number;
}

export interface LowRatedRoute {
  id: string;
  name: string;
  nameHe?: string;
  nameEn?: string;
  grade: string;
  color: string;
  avgRating: number;
  feedbackCount: number;
  createdAt: Date;
}

// ===== Users & Activity =====
export interface UsersKPIs {
  activeUsersInPeriod: number;
  totalRegistered: number;
  avgSendsPerDay: number;
  peakDay: { date: string; count: number };
}

export interface DAUDataPoint {
  date: string;
  dau: number;
  wau: number;
  mau: number;
}

export interface TopClimber {
  userId: string;
  displayName: string;
  sends: number;
  flashes: number;
  flashRate: number;
  avgRating: number;
  feedbacks: number;
}

export interface RetentionData {
  weeklyRetention: number;
  monthlyRetention: number;
  weeklyTrend: { period: string; rate: number }[];
  monthlyTrend: { period: string; rate: number }[];
}

// ===== Spray Wall =====
export interface SprayKPIs {
  totalSprayRoutes: number;
  avgRating: number;
  totalTops: number;
  uniqueCreators: number;
}

export type SpraySortMode = 'popularity' | 'rating' | 'trending';

export interface SprayRouteEntry {
  id: string;
  name: string;
  creator: string;
  creatorName?: string;
  grade: string;
  topsCount: number;
  avgRating: number;
  feedbackCount: number;
}

export interface SprayCreator {
  userId: string;
  displayName: string;
  routesCreated: number;
  avgRating: number;
  totalTops: number;
}

export interface SprayTrendPoint {
  period: string;
  newRoutes: number;
  tops: number;
}

// ===== Community Routes =====
export interface CommunityKPIs {
  liveRoutes: number;
  newThisWeek: number;
  totalSends: number;
  uniqueCreators: number;
}

export interface CommunityCreator {
  userId: string;
  displayName: string;
  routeCount: number;
  totalLikes: number;
  totalSends: number;
  totalViews: number;
}

export interface CommunityRouteCard {
  id: string;
  name: string;
  creator: string;
  creatorName?: string;
  grade: string;
  likes: number;
  sends: number;
  views: number;
  createdAt: Date;
  daysUntilExpiry: number;
}
