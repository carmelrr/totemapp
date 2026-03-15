/**
 * @fileoverview Comprehensive Statistics Service for Admin Dashboard
 * Provides all data needed for the 5-tab statistics module
 */
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  getCountFromServer,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import {
  GRADE_ORDER,
  gradeIndex,
  getGradeGroup,
  toDate,
  getPreviousPeriodDates,
} from '../constants';
import type {
  DateRange,
  DashboardData,
  RoutesKPIs,
  GradeDistributionEntry,
  GradeFilter,
  GradeConsensusEntry,
  TopRouteEntry,
  ActivityHeatmapData,
  GradeHourData,
  RatingDistribution,
  LowRatedRoute,
  UsersKPIs,
  DAUDataPoint,
  TopClimber,
  RetentionData,
  SprayKPIs,
  SprayRouteEntry,
  SprayCreator,
  SprayTrendPoint,
  CommunityKPIs,
  CommunityCreator,
  CommunityRouteCard,
} from '../types';

const routesRef = collection(db, 'routes');
const feedbacksRef = collection(db, 'routeFeedbacks');
const usersRef = collection(db, 'users');
const userRoutesRef = collection(db, 'userRoutes');
const sprayRoutesRef = collection(db, 'sprayRoutes');
const communityRoutesRef = collection(db, 'communityRoutes');
const communityRouteSendsRef = collection(db, 'communityRouteSends');
const competitionsRef = collection(db, 'competitions');

// ============================================================
// Helpers
// ============================================================

function tsRange(range: DateRange) {
  return {
    start: Timestamp.fromDate(range.startDate),
    end: Timestamp.fromDate(range.endDate),
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.round(Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)));
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return dateKey(start);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================================
// 1. DASHBOARD
// ============================================================

export async function getDashboard(range: DateRange): Promise<DashboardData> {
  try {
    const { start, end } = tsRange(range);
    const prev = getPreviousPeriodDates(range.startDate, range.endDate);
    const { start: prevStart, end: prevEnd } = tsRange(prev);

    // Fetch routes (for active count & rating)
    const routesSnap = await getDocs(routesRef);
    let activeRoutes = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    routesSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.status === 'active') activeRoutes++;
      if (data.averageStarRating > 0) {
        ratingSum += data.averageStarRating;
        ratingCount++;
      }
    });

    // Fetch feedbacks in period + previous period
    const fbSnap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
    const prevFbSnap = await getDocs(query(feedbacksRef, where('createdAt', '>=', prevStart), where('createdAt', '<=', prevEnd)));

    // Active users (unique)
    const activeUserSet = new Set<string>();
    const dailyMap: Record<string, number> = {};
    let totalSends = 0;
    let totalFlashes = 0;

    fbSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.userId) activeUserSet.add(data.userId);
      const dt = toDate(data.createdAt);
      const dk = dateKey(dt);
      dailyMap[dk] = (dailyMap[dk] || 0) + 1;
      if (data.isCompleted) totalSends++;
    });

    // Sparkline: last N days of activity
    const days = daysBetween(range.startDate, range.endDate);
    const sparklineDays = Math.min(days, 30);
    const dailyActivity: number[] = [];
    for (let i = sparklineDays - 1; i >= 0; i--) {
      const d = new Date(range.endDate.getTime() - i * 24 * 60 * 60 * 1000);
      dailyActivity.push(dailyMap[dateKey(d)] || 0);
    }

    // Flash rate from userRoutes
    const urSnap = await getDocs(userRoutesRef);
    urSnap.docs.forEach((d) => {
      Object.values(d.data()).forEach((val: any) => {
        if (val && typeof val === 'object' && val.status === 'flashed') totalFlashes++;
      });
    });
    const flashRate = (totalSends + totalFlashes) > 0 ? (totalFlashes / (totalSends + totalFlashes)) * 100 : 0;

    // Spray stats
    const spraySnap = await getDocs(sprayRoutesRef);
    let topSpray: { name: string; topsCount: number } | null = null;
    spraySnap.docs.forEach((d) => {
      const data = d.data();
      if (!topSpray || (data.topsCount || 0) > topSpray.topsCount) {
        topSpray = { name: data.name || '', topsCount: data.topsCount || 0 };
      }
    });

    // Community stats
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const cmSnap = await getDocs(communityRoutesRef);
    let newThisWeek = 0;
    let newPrevWeek = 0;
    cmSnap.docs.forEach((d) => {
      const data = d.data();
      const created = toDate(data.createdAt);
      if (created >= weekAgo) newThisWeek++;
      else if (created >= twoWeeksAgo) newPrevWeek++;
    });
    const communityChange = newPrevWeek > 0 ? ((newThisWeek - newPrevWeek) / newPrevWeek) * 100 : 0;

    // Routes change from previous period
    const prevActiveRoutes = routesSnap.docs.filter((d) => {
      const data = d.data();
      const created = toDate(data.createdAt);
      return data.status === 'active' && created <= prev.endDate;
    }).length;
    const activeRoutesChange = prevActiveRoutes > 0
      ? ((activeRoutes - prevActiveRoutes) / prevActiveRoutes) * 100 : 0;

    return {
      activeRoutes,
      activeRoutesChange,
      avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
      activeUsers: activeUserSet.size,
      dailyActivity,
      sprayRoutesCount: spraySnap.size,
      topSprayRoute: topSpray,
      newCommunityRoutes: newThisWeek,
      communityChange,
      totalFeedbacks: fbSnap.size,
      flashRate,
    };
  } catch (error) {
    console.error('Error loading dashboard:', error);
    return {
      activeRoutes: 0, activeRoutesChange: 0, avgRating: 0, activeUsers: 0,
      dailyActivity: [], sprayRoutesCount: 0, topSprayRoute: null,
      newCommunityRoutes: 0, communityChange: 0, totalFeedbacks: 0, flashRate: 0,
    };
  }
}

// ============================================================
// 2. ROUTES ANALYTICS
// ============================================================

export async function getRoutesKPIs(range: DateRange): Promise<RoutesKPIs> {
  try {
    const { start, end } = tsRange(range);
    const routesSnap = await getDocs(query(routesRef, where('status', '==', 'active')));
    let ratingSum = 0;
    let ratingCount = 0;
    routesSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.averageStarRating > 0) {
        ratingSum += data.averageStarRating;
        ratingCount++;
      }
    });

    const fbSnap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
    let sends = 0;
    fbSnap.docs.forEach((d) => { if (d.data().isCompleted) sends++; });

    // Flash rate from userRoutes
    const urSnap = await getDocs(userRoutesRef);
    let totalSends = 0;
    let totalFlashes = 0;
    urSnap.docs.forEach((d) => {
      Object.values(d.data()).forEach((val: any) => {
        if (val?.status === 'sent') totalSends++;
        else if (val?.status === 'flashed') totalFlashes++;
      });
    });

    return {
      activeRoutes: routesSnap.size,
      avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
      totalSends: sends,
      flashRate: (totalSends + totalFlashes) > 0 ? (totalFlashes / (totalSends + totalFlashes)) * 100 : 0,
    };
  } catch (error) {
    console.error('Error loading routes KPIs:', error);
    return { activeRoutes: 0, avgRating: 0, totalSends: 0, flashRate: 0 };
  }
}

export async function getGradeDistribution(filter: GradeFilter = 'all'): Promise<GradeDistributionEntry[]> {
  try {
    let q;
    if (filter === 'all') {
      q = routesRef;
    } else {
      q = query(routesRef, where('status', '==', filter));
    }
    const snap = await getDocs(q);
    const dist: Record<string, { count: number; ratingSum: number; ratingCount: number; sends: number }> = {};

    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, any>;
      const grade = data.grade || 'Unknown';
      if (!dist[grade]) dist[grade] = { count: 0, ratingSum: 0, ratingCount: 0, sends: 0 };
      dist[grade].count++;
      if (data.averageStarRating > 0) {
        dist[grade].ratingSum += data.averageStarRating;
        dist[grade].ratingCount++;
      }
      dist[grade].sends += data.completionCount || 0;
    });

    return Object.entries(dist)
      .sort(([a], [b]) => gradeIndex(a) - gradeIndex(b))
      .map(([grade, d]) => ({
        grade,
        count: d.count,
        avgRating: d.ratingCount > 0 ? d.ratingSum / d.ratingCount : undefined,
        totalSends: d.sends,
      }));
  } catch (error) {
    console.error('Error loading grade distribution:', error);
    return [];
  }
}

export async function getGradeConsensus(): Promise<GradeConsensusEntry[]> {
  try {
    const routesSnap = await getDocs(query(routesRef, where('status', '==', 'active')));
    const routeMap = new Map<string, { name: string; nameHe?: string; nameEn?: string; grade: string }>();
    routesSnap.docs.forEach((d) => {
      const data = d.data();
      routeMap.set(d.id, { name: data.name || '', nameHe: data.nameHe, nameEn: data.nameEn, grade: data.grade || '' });
    });

    const fbSnap = await getDocs(feedbacksRef);
    const routeSuggestions: Record<string, { grades: number[]; }> = {};
    fbSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.suggestedGrade !== undefined && data.suggestedGrade !== null && data.routeId) {
        if (!routeSuggestions[data.routeId]) routeSuggestions[data.routeId] = { grades: [] };
        const gradeVal = typeof data.suggestedGrade === 'string'
          ? gradeIndex(data.suggestedGrade)
          : data.suggestedGrade;
        if (typeof gradeVal === 'number' && gradeVal < 99) {
          routeSuggestions[data.routeId].grades.push(gradeVal);
        }
      }
    });

    const results: GradeConsensusEntry[] = [];
    for (const [routeId, suggestions] of Object.entries(routeSuggestions)) {
      const route = routeMap.get(routeId);
      if (!route || suggestions.grades.length < 3) continue;
      const officialIdx = gradeIndex(route.grade);
      const avgSuggested = suggestions.grades.reduce((a, b) => a + b, 0) / suggestions.grades.length;
      results.push({
        routeId,
        routeName: route.name,
        routeNameHe: route.nameHe,
        routeNameEn: route.nameEn,
        officialGrade: route.grade,
        suggestedGradeAvg: avgSuggested,
        deviation: avgSuggested - officialIdx,
        voteCount: suggestions.grades.length,
      });
    }

    results.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    return results;
  } catch (error) {
    console.error('Error loading grade consensus:', error);
    return [];
  }
}

export async function getTopRoutes(range: DateRange, sortBy: string = 'sends'): Promise<TopRouteEntry[]> {
  try {
    const routesSnap = await getDocs(query(routesRef, where('status', '==', 'active')));
    const routeMap = new Map<string, any>();
    routesSnap.docs.forEach((d) => {
      routeMap.set(d.id, { ...d.data(), id: d.id });
    });

    // Count sends & feedbacks per route in period
    const { start, end } = tsRange(range);
    const fbSnap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
    const routeStats: Record<string, { sends: number; feedbacks: number }> = {};
    fbSnap.docs.forEach((d) => {
      const data = d.data();
      const rid = data.routeId;
      if (!rid) return;
      if (!routeStats[rid]) routeStats[rid] = { sends: 0, feedbacks: 0 };
      routeStats[rid].feedbacks++;
      if (data.isCompleted) routeStats[rid].sends++;
    });

    // Count flashes from userRoutes
    const urSnap = await getDocs(userRoutesRef);
    const routeFlashes: Record<string, number> = {};
    urSnap.docs.forEach((d) => {
      Object.entries(d.data()).forEach(([routeId, val]: [string, any]) => {
        if (val?.status === 'flashed') routeFlashes[routeId] = (routeFlashes[routeId] || 0) + 1;
      });
    });

    const entries: TopRouteEntry[] = [];
    routeMap.forEach((r, id) => {
      const stats = routeStats[id] || { sends: 0, feedbacks: 0 };
      entries.push({
        id,
        name: r.name || '',
        nameHe: r.nameHe,
        nameEn: r.nameEn,
        grade: r.grade || '',
        color: r.color || '#999',
        sends: r.completionCount || 0,
        flashes: routeFlashes[id] || 0,
        rating: r.averageStarRating || 0,
        feedbacks: r.feedbackCount || 0,
        createdAt: r.createdAt ? toDate(r.createdAt) : undefined,
      });
    });

    // Sort
    switch (sortBy) {
      case 'flashes': entries.sort((a, b) => b.flashes - a.flashes); break;
      case 'rating': entries.sort((a, b) => b.rating - a.rating); break;
      case 'feedbacks': entries.sort((a, b) => b.feedbacks - a.feedbacks); break;
      default: entries.sort((a, b) => b.sends - a.sends);
    }

    return entries;
  } catch (error) {
    console.error('Error loading top routes:', error);
    return [];
  }
}

export async function getActivityHeatmap(range: DateRange): Promise<ActivityHeatmapData> {
  try {
    const { start, end } = tsRange(range);
    const snap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));

    const cells: Record<string, number> = {};
    let maxValue = 0;
    snap.docs.forEach((d) => {
      const dt = toDate(d.data().createdAt);
      const hour = dt.getHours();
      const day = dt.getDay();
      const key = `${day}-${hour}`;
      cells[key] = (cells[key] || 0) + 1;
      if (cells[key] > maxValue) maxValue = cells[key];
    });

    const result: ActivityHeatmapData = { cells: [], maxValue };
    for (let day = 0; day < 7; day++) {
      for (let hour = 6; hour <= 23; hour++) {
        result.cells.push({ hour, day, count: cells[`${day}-${hour}`] || 0 });
      }
    }
    return result;
  } catch (error) {
    console.error('Error loading heatmap:', error);
    return { cells: [], maxValue: 0 };
  }
}

export async function getGradeByHour(range: DateRange): Promise<GradeHourData[]> {
  try {
    const { start, end } = tsRange(range);
    // Get route grades
    const routesSnap = await getDocs(routesRef);
    const gradeMap = new Map<string, string>();
    routesSnap.docs.forEach((d) => gradeMap.set(d.id, d.data().grade || ''));

    const fbSnap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));

    const hourData: Record<number, { easy: number; medium: number; hard: number; elite: number }> = {};
    for (let h = 6; h <= 23; h++) hourData[h] = { easy: 0, medium: 0, hard: 0, elite: 0 };

    fbSnap.docs.forEach((d) => {
      const data = d.data();
      const grade = gradeMap.get(data.routeId);
      if (!grade) return;
      const hour = toDate(data.createdAt).getHours();
      if (hour < 6) return;
      const group = getGradeGroup(grade);
      hourData[hour][group]++;
    });

    return Object.entries(hourData)
      .map(([h, d]) => ({ hour: parseInt(h), ...d }))
      .sort((a, b) => a.hour - b.hour);
  } catch (error) {
    console.error('Error loading grade by hour:', error);
    return [];
  }
}

export async function getRatingDistribution(range: DateRange): Promise<RatingDistribution> {
  try {
    const { start, end } = tsRange(range);
    const snap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
    const stars: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    snap.docs.forEach((d) => {
      const rating = d.data().starRating;
      if (rating >= 1 && rating <= 5) stars[Math.round(rating)]++;
    });

    return {
      stars: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: stars[r] })),
      totalFeedbacks: snap.size,
    };
  } catch (error) {
    console.error('Error loading rating distribution:', error);
    return { stars: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 })), totalFeedbacks: 0 };
  }
}

export async function getLowRatedRoutes(): Promise<LowRatedRoute[]> {
  try {
    const snap = await getDocs(query(routesRef, where('status', '==', 'active')));
    const routes: LowRatedRoute[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if ((data.feedbackCount || 0) >= 3 && (data.averageStarRating || 5) < 2.5) {
        routes.push({
          id: d.id,
          name: data.name || '',
          nameHe: data.nameHe,
          nameEn: data.nameEn,
          grade: data.grade || '',
          color: data.color || '#999',
          avgRating: data.averageStarRating || 0,
          feedbackCount: data.feedbackCount || 0,
          createdAt: toDate(data.createdAt),
        });
      }
    });
    routes.sort((a, b) => a.avgRating - b.avgRating);
    return routes;
  } catch (error) {
    console.error('Error loading low rated routes:', error);
    return [];
  }
}

// ============================================================
// 3. USERS & ACTIVITY
// ============================================================

export async function getUsersKPIs(range: DateRange): Promise<UsersKPIs> {
  try {
    const { start, end } = tsRange(range);
    const totalSnap = await getCountFromServer(usersRef);

    const fbSnap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
    const userSet = new Set<string>();
    const dayCount: Record<string, number> = {};
    let totalSends = 0;

    fbSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.userId) userSet.add(data.userId);
      const dk = dateKey(toDate(data.createdAt));
      dayCount[dk] = (dayCount[dk] || 0) + 1;
      if (data.isCompleted) totalSends++;
    });

    const numDays = daysBetween(range.startDate, range.endDate);
    let peakDay = { date: '', count: 0 };
    Object.entries(dayCount).forEach(([date, count]) => {
      if (count > peakDay.count) peakDay = { date, count };
    });

    return {
      activeUsersInPeriod: userSet.size,
      totalRegistered: totalSnap.data().count,
      avgSendsPerDay: numDays > 0 ? totalSends / numDays : 0,
      peakDay,
    };
  } catch (error) {
    console.error('Error loading users KPIs:', error);
    return { activeUsersInPeriod: 0, totalRegistered: 0, avgSendsPerDay: 0, peakDay: { date: '', count: 0 } };
  }
}

export async function getDAUData(range: DateRange): Promise<DAUDataPoint[]> {
  try {
    const { start, end } = tsRange(range);
    const snap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));

    // Build daily user sets
    const dailyUsers: Record<string, Set<string>> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.userId) return;
      const dk = dateKey(toDate(data.createdAt));
      if (!dailyUsers[dk]) dailyUsers[dk] = new Set();
      dailyUsers[dk].add(data.userId);
    });

    const days = daysBetween(range.startDate, range.endDate);
    const points: DAUDataPoint[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(range.startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dk = dateKey(d);
      const dau = dailyUsers[dk]?.size || 0;

      // WAU: unique users in last 7 days
      const wauSet = new Set<string>();
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        const wd = dateKey(new Date(range.startDate.getTime() + j * 24 * 60 * 60 * 1000));
        dailyUsers[wd]?.forEach((u) => wauSet.add(u));
      }

      // MAU: unique users in last 30 days
      const mauSet = new Set<string>();
      for (let j = Math.max(0, i - 29); j <= i; j++) {
        const md = dateKey(new Date(range.startDate.getTime() + j * 24 * 60 * 60 * 1000));
        dailyUsers[md]?.forEach((u) => mauSet.add(u));
      }

      points.push({ date: dk, dau, wau: wauSet.size, mau: mauSet.size });
    }

    return points;
  } catch (error) {
    console.error('Error loading DAU data:', error);
    return [];
  }
}

export async function getUniqueUsersHeatmap(range: DateRange): Promise<ActivityHeatmapData> {
  try {
    const { start, end } = tsRange(range);
    const snap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));

    // Track unique users per hour-day combo
    const cellUsers: Record<string, Set<string>> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.userId) return;
      const dt = toDate(data.createdAt);
      const key = `${dt.getDay()}-${dt.getHours()}`;
      if (!cellUsers[key]) cellUsers[key] = new Set();
      cellUsers[key].add(data.userId);
    });

    let maxValue = 0;
    const cells = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 6; hour <= 23; hour++) {
        const count = cellUsers[`${day}-${hour}`]?.size || 0;
        cells.push({ hour, day, count });
        if (count > maxValue) maxValue = count;
      }
    }

    return { cells, maxValue };
  } catch (error) {
    console.error('Error loading unique users heatmap:', error);
    return { cells: [], maxValue: 0 };
  }
}

export async function getTopClimbers(range: DateRange): Promise<TopClimber[]> {
  try {
    const { start, end } = tsRange(range);

    // Get feedbacks in range
    const fbSnap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
    const userStats: Record<string, { sends: number; feedbacks: number; ratingSum: number; ratingCount: number }> = {};
    fbSnap.docs.forEach((d) => {
      const data = d.data();
      if (!data.userId) return;
      if (!userStats[data.userId]) userStats[data.userId] = { sends: 0, feedbacks: 0, ratingSum: 0, ratingCount: 0 };
      userStats[data.userId].feedbacks++;
      if (data.isCompleted) userStats[data.userId].sends++;
      if (data.starRating) {
        userStats[data.userId].ratingSum += data.starRating;
        userStats[data.userId].ratingCount++;
      }
    });

    // Get flashes from userRoutes
    const urSnap = await getDocs(userRoutesRef);
    const userFlashes: Record<string, number> = {};
    urSnap.docs.forEach((d) => {
      let flashes = 0;
      Object.values(d.data()).forEach((val: any) => {
        if (val?.status === 'flashed') flashes++;
      });
      if (flashes > 0) userFlashes[d.id] = flashes;
    });

    // Get user display names
    const usersSnap = await getDocs(usersRef);
    const userNames: Record<string, string> = {};
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      userNames[d.id] = data.displayName || data.name || 'Unknown';
    });

    const climbers: TopClimber[] = Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        displayName: userNames[userId] || 'Unknown',
        sends: stats.sends,
        flashes: userFlashes[userId] || 0,
        flashRate: (stats.sends + (userFlashes[userId] || 0)) > 0
          ? ((userFlashes[userId] || 0) / (stats.sends + (userFlashes[userId] || 0))) * 100 : 0,
        avgRating: stats.ratingCount > 0 ? stats.ratingSum / stats.ratingCount : 0,
        feedbacks: stats.feedbacks,
      }))
      .sort((a, b) => b.sends - a.sends)
      .slice(0, 20);

    return climbers;
  } catch (error) {
    console.error('Error loading top climbers:', error);
    return [];
  }
}

export async function getRetention(range: DateRange): Promise<RetentionData> {
  try {
    const { start, end } = tsRange(range);
    const snap = await getDocs(query(feedbacksRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));

    // Build weekly and monthly user sets
    const weeklyUsers: Record<string, Set<string>> = {};
    const monthlyUsers: Record<string, Set<string>> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.userId) return;
      const dt = toDate(data.createdAt);
      const wk = weekKey(dt);
      const mk = monthKey(dt);
      if (!weeklyUsers[wk]) weeklyUsers[wk] = new Set();
      weeklyUsers[wk].add(data.userId);
      if (!monthlyUsers[mk]) monthlyUsers[mk] = new Set();
      monthlyUsers[mk].add(data.userId);
    });

    // Calculate weekly retention
    const weeks = Object.keys(weeklyUsers).sort();
    const weeklyTrend: { period: string; rate: number }[] = [];
    for (let i = 1; i < weeks.length; i++) {
      const prev = weeklyUsers[weeks[i - 1]];
      const curr = weeklyUsers[weeks[i]];
      let retained = 0;
      curr.forEach((u) => { if (prev.has(u)) retained++; });
      weeklyTrend.push({ period: weeks[i], rate: prev.size > 0 ? (retained / prev.size) * 100 : 0 });
    }

    // Calculate monthly retention
    const months = Object.keys(monthlyUsers).sort();
    const monthlyTrend: { period: string; rate: number }[] = [];
    for (let i = 1; i < months.length; i++) {
      const prev = monthlyUsers[months[i - 1]];
      const curr = monthlyUsers[months[i]];
      let retained = 0;
      curr.forEach((u) => { if (prev.has(u)) retained++; });
      monthlyTrend.push({ period: months[i], rate: prev.size > 0 ? (retained / prev.size) * 100 : 0 });
    }

    return {
      weeklyRetention: weeklyTrend.length > 0 ? weeklyTrend[weeklyTrend.length - 1].rate : 0,
      monthlyRetention: monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1].rate : 0,
      weeklyTrend,
      monthlyTrend,
    };
  } catch (error) {
    console.error('Error loading retention:', error);
    return { weeklyRetention: 0, monthlyRetention: 0, weeklyTrend: [], monthlyTrend: [] };
  }
}

// ============================================================
// 4. SPRAY WALL
// ============================================================

export async function getSprayKPIs(range: DateRange): Promise<SprayKPIs> {
  try {
    const snap = await getDocs(sprayRoutesRef);
    let ratingSum = 0;
    let ratingCount = 0;
    let totalTops = 0;
    const creators = new Set<string>();

    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.averageStarRating > 0) { ratingSum += data.averageStarRating; ratingCount++; }
      totalTops += data.topsCount || 0;
      if (data.createdBy) creators.add(data.createdBy);
    });

    return {
      totalSprayRoutes: snap.size,
      avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
      totalTops,
      uniqueCreators: creators.size,
    };
  } catch (error) {
    console.error('Error loading spray KPIs:', error);
    return { totalSprayRoutes: 0, avgRating: 0, totalTops: 0, uniqueCreators: 0 };
  }
}

export async function getTopSprayRoutes(sortMode: string = 'popularity'): Promise<SprayRouteEntry[]> {
  try {
    const snap = await getDocs(sprayRoutesRef);

    // Get user display names for creators
    const creatorIds = new Set<string>();
    snap.docs.forEach((d) => { if (d.data().createdBy) creatorIds.add(d.data().createdBy); });
    const usersSnap = await getDocs(usersRef);
    const userNames: Record<string, string> = {};
    usersSnap.docs.forEach((d) => { userNames[d.id] = d.data().displayName || d.data().name || ''; });

    const routes: SprayRouteEntry[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || '',
        creator: data.createdBy || '',
        creatorName: userNames[data.createdBy] || '',
        grade: data.grade || '',
        topsCount: data.topsCount || 0,
        avgRating: data.averageStarRating || 0,
        feedbackCount: data.feedbackCount || 0,
      };
    });

    switch (sortMode) {
      case 'rating':
        routes.sort((a, b) => {
          if (a.feedbackCount < 3 && b.feedbackCount >= 3) return 1;
          if (b.feedbackCount < 3 && a.feedbackCount >= 3) return -1;
          return b.avgRating - a.avgRating;
        });
        break;
      case 'trending':
        routes.sort((a, b) => b.topsCount - a.topsCount);
        break;
      default:
        routes.sort((a, b) => b.topsCount - a.topsCount);
    }

    return routes.slice(0, 20);
  } catch (error) {
    console.error('Error loading top spray routes:', error);
    return [];
  }
}

export async function getSprayCreators(): Promise<SprayCreator[]> {
  try {
    const snap = await getDocs(sprayRoutesRef);
    const usersSnap = await getDocs(usersRef);
    const userNames: Record<string, string> = {};
    usersSnap.docs.forEach((d) => { userNames[d.id] = d.data().displayName || d.data().name || ''; });

    const creators: Record<string, { routes: number; ratingSum: number; ratingCount: number; tops: number }> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const uid = data.createdBy;
      if (!uid) return;
      if (!creators[uid]) creators[uid] = { routes: 0, ratingSum: 0, ratingCount: 0, tops: 0 };
      creators[uid].routes++;
      if (data.averageStarRating > 0) {
        creators[uid].ratingSum += data.averageStarRating;
        creators[uid].ratingCount++;
      }
      creators[uid].tops += data.topsCount || 0;
    });

    return Object.entries(creators)
      .map(([userId, c]) => ({
        userId,
        displayName: userNames[userId] || 'Unknown',
        routesCreated: c.routes,
        avgRating: c.ratingCount > 0 ? c.ratingSum / c.ratingCount : 0,
        totalTops: c.tops,
      }))
      .sort((a, b) => b.routesCreated - a.routesCreated)
      .slice(0, 20);
  } catch (error) {
    console.error('Error loading spray creators:', error);
    return [];
  }
}

export async function getSprayGradeDistribution(): Promise<GradeDistributionEntry[]> {
  try {
    const snap = await getDocs(sprayRoutesRef);
    const dist: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const grade = d.data().grade || 'Unknown';
      dist[grade] = (dist[grade] || 0) + 1;
    });

    return Object.entries(dist)
      .sort(([a], [b]) => gradeIndex(a) - gradeIndex(b))
      .map(([grade, count]) => ({ grade, count }));
  } catch (error) {
    console.error('Error loading spray grade distribution:', error);
    return [];
  }
}

export async function getSprayTrend(): Promise<SprayTrendPoint[]> {
  try {
    const snap = await getDocs(sprayRoutesRef);
    const weeklyNew: Record<string, number> = {};
    const weeklyTops: Record<string, number> = {};

    snap.docs.forEach((d) => {
      const data = d.data();
      const created = toDate(data.createdAt);
      const wk = weekKey(created);
      weeklyNew[wk] = (weeklyNew[wk] || 0) + 1;
      weeklyTops[wk] = (weeklyTops[wk] || 0) + (data.topsCount || 0);
    });

    const allWeeks = new Set([...Object.keys(weeklyNew), ...Object.keys(weeklyTops)]);
    return Array.from(allWeeks)
      .sort()
      .slice(-12)
      .map((period) => ({
        period,
        newRoutes: weeklyNew[period] || 0,
        tops: weeklyTops[period] || 0,
      }));
  } catch (error) {
    console.error('Error loading spray trend:', error);
    return [];
  }
}

// ============================================================
// 5. COMMUNITY ROUTES
// ============================================================

export async function getCommunityKPIs(range: DateRange): Promise<CommunityKPIs> {
  try {
    const snap = await getDocs(communityRoutesRef);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let liveRoutes = 0;
    let newThisWeek = 0;
    const creators = new Set<string>();

    snap.docs.forEach((d) => {
      const data = d.data();
      const created = toDate(data.createdAt);
      if (created >= thirtyDaysAgo) liveRoutes++;
      if (created >= weekAgo) newThisWeek++;
      if (data.createdBy) creators.add(data.createdBy);
    });

    const sendsSnap = await getCountFromServer(communityRouteSendsRef);

    return {
      liveRoutes,
      newThisWeek,
      totalSends: sendsSnap.data().count,
      uniqueCreators: creators.size,
    };
  } catch (error) {
    console.error('Error loading community KPIs:', error);
    return { liveRoutes: 0, newThisWeek: 0, totalSends: 0, uniqueCreators: 0 };
  }
}

export async function getCommunityCreationTrend(): Promise<{ period: string; newRoutes: number; sends: number }[]> {
  try {
    const snap = await getDocs(communityRoutesRef);
    const weeklyNew: Record<string, number> = {};
    const weeklySends: Record<string, number> = {};

    snap.docs.forEach((d) => {
      const data = d.data();
      const wk = weekKey(toDate(data.createdAt));
      weeklyNew[wk] = (weeklyNew[wk] || 0) + 1;
      weeklySends[wk] = (weeklySends[wk] || 0) + (data.sentCount || 0);
    });

    const allWeeks = new Set([...Object.keys(weeklyNew), ...Object.keys(weeklySends)]);
    return Array.from(allWeeks).sort().slice(-12).map((period) => ({
      period,
      newRoutes: weeklyNew[period] || 0,
      sends: weeklySends[period] || 0,
    }));
  } catch (error) {
    console.error('Error loading community creation trend:', error);
    return [];
  }
}

export async function getCommunityCreators(): Promise<CommunityCreator[]> {
  try {
    const snap = await getDocs(communityRoutesRef);
    const usersSnap = await getDocs(usersRef);
    const userNames: Record<string, string> = {};
    usersSnap.docs.forEach((d) => { userNames[d.id] = d.data().displayName || d.data().name || ''; });

    const creators: Record<string, { routes: number; likes: number; sends: number; views: number }> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const uid = data.createdBy;
      if (!uid) return;
      if (!creators[uid]) creators[uid] = { routes: 0, likes: 0, sends: 0, views: 0 };
      creators[uid].routes++;
      creators[uid].likes += data.likeCount || 0;
      creators[uid].sends += data.sentCount || 0;
      creators[uid].views += data.viewCount || 0;
    });

    return Object.entries(creators)
      .map(([userId, c]) => ({
        userId,
        displayName: userNames[userId] || 'Unknown',
        routeCount: c.routes,
        totalLikes: c.likes,
        totalSends: c.sends,
        totalViews: c.views,
      }))
      .sort((a, b) => b.routeCount - a.routeCount)
      .slice(0, 10);
  } catch (error) {
    console.error('Error loading community creators:', error);
    return [];
  }
}

export async function getPopularCommunityRoutes(): Promise<CommunityRouteCard[]> {
  try {
    const snap = await getDocs(communityRoutesRef);
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const usersSnap = await getDocs(usersRef);
    const userNames: Record<string, string> = {};
    usersSnap.docs.forEach((d) => { userNames[d.id] = d.data().displayName || d.data().name || ''; });

    const routes: CommunityRouteCard[] = snap.docs
      .map((d) => {
        const data = d.data();
        const created = toDate(data.createdAt);
        const expiresAt = created.getTime() + thirtyDaysMs;
        const daysUntilExpiry = Math.ceil((expiresAt - now.getTime()) / (24 * 60 * 60 * 1000));
        return {
          id: d.id,
          name: data.name || '',
          creator: data.createdBy || '',
          creatorName: userNames[data.createdBy] || '',
          grade: data.grade || '',
          likes: data.likeCount || 0,
          sends: data.sentCount || 0,
          views: data.viewCount || 0,
          createdAt: created,
          daysUntilExpiry,
        };
      })
      .filter((r) => r.daysUntilExpiry > 0)
      .sort((a, b) => (b.likes + b.sends) - (a.likes + a.sends))
      .slice(0, 10);

    return routes;
  } catch (error) {
    console.error('Error loading popular community routes:', error);
    return [];
  }
}

export async function getExpiringSoonRoutes(): Promise<CommunityRouteCard[]> {
  try {
    const snap = await getDocs(communityRoutesRef);
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const usersSnap = await getDocs(usersRef);
    const userNames: Record<string, string> = {};
    usersSnap.docs.forEach((d) => { userNames[d.id] = d.data().displayName || d.data().name || ''; });

    return snap.docs
      .map((d) => {
        const data = d.data();
        const created = toDate(data.createdAt);
        const expiresAt = created.getTime() + thirtyDaysMs;
        const daysUntilExpiry = Math.ceil((expiresAt - now.getTime()) / (24 * 60 * 60 * 1000));
        return {
          id: d.id,
          name: data.name || '',
          creator: data.createdBy || '',
          creatorName: userNames[data.createdBy] || '',
          grade: data.grade || '',
          likes: data.likeCount || 0,
          sends: data.sentCount || 0,
          views: data.viewCount || 0,
          createdAt: created,
          daysUntilExpiry,
        };
      })
      .filter((r) => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 7)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  } catch (error) {
    console.error('Error loading expiring routes:', error);
    return [];
  }
}
