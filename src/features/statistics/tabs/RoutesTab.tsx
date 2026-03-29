import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Section from '../components/Section';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import Heatmap from '../components/Heatmap';
import SectionLoader from '../components/SectionLoader';
import {
  getRoutesKPIs,
  getGradeDistribution,
  getGradeConsensus,
  getTopRoutes,
  getActivityHeatmap,
  getGradeByHour,
  getRatingDistribution,
  getLowRatedRoutes,
} from '../services/StatisticsService';
import { GRADE_COLORS, RATING_COLORS, GRADE_GROUP_COLORS } from '../constants';
import type {
  DateRange,
  RoutesKPIs,
  GradeDistributionEntry,
  GradeFilter,
  GradeConsensusEntry,
  TopRouteEntry,
  ActivityHeatmapData,
  GradeHourData,
  RatingDistribution,
  LowRatedRoute,
  RouteSortField,
} from '../types';

interface Props {
  range: DateRange;
  theme: any;
  t: any;
  language: 'he' | 'en';
  isRTL: boolean;
}

export default function RoutesTab({ range, theme, t, language, isRTL }: Props) {
  const [kpis, setKPIs] = useState<RoutesKPIs | null>(null);
  const [grades, setGrades] = useState<GradeDistributionEntry[]>([]);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('active');
  const [consensus, setConsensus] = useState<GradeConsensusEntry[]>([]);
  const [topRoutes, setTopRoutes] = useState<TopRouteEntry[]>([]);
  const [sortField, setSortField] = useState<RouteSortField>('sends');
  const [heatmap, setHeatmap] = useState<ActivityHeatmapData | null>(null);
  const [gradeHour, setGradeHour] = useState<GradeHourData[]>([]);
  const [ratings, setRatings] = useState<RatingDistribution | null>(null);
  const [lowRated, setLowRated] = useState<LowRatedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [k, g, c, tr, h, gh, r, lr] = await Promise.all([
        getRoutesKPIs(range),
        getGradeDistribution(gradeFilter),
        getGradeConsensus(),
        getTopRoutes(range, sortField),
        getActivityHeatmap(range),
        getGradeByHour(range),
        getRatingDistribution(range),
        getLowRatedRoutes(),
      ]);
      setKPIs(k);
      setGrades(g);
      setConsensus(c);
      setTopRoutes(tr);
      setHeatmap(h);
      setGradeHour(gh);
      setRatings(r);
      setLowRated(lr);
    } catch (e) {
      console.error('Routes tab load error:', e);
    }
  }, [range, gradeFilter, sortField]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const s = createStyles(theme, isRTL);
  const st = t.statistics;

  if (loading && !kpis) return <SectionLoader theme={theme} />;

  const getRouteName = (route: { name: string; nameHe?: string; nameEn?: string }) =>
    language === 'he' ? route.nameHe || route.name : route.nameEn || route.name;

  return (
    <ScrollView
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* 2.1 KPIs */}
      {kpis && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiRow}>
          <StatCard label={st.activeRoutes} value={kpis.activeRoutes} color="#2196F3" theme={theme} />
          <StatCard label={st.avgRating} value={kpis.avgRating.toFixed(1)} color="#FFC107" theme={theme} suffix="⭐" />
          <StatCard label={st.sends} value={kpis.totalSends} color="#4CAF50" theme={theme} />
          <StatCard label={st.flashRate} value={`${kpis.flashRate.toFixed(0)}%`} color="#E91E63" theme={theme} />
        </ScrollView>
      )}

      {/* 2.2 Grade Distribution */}
      <Section title={st.gradeDistribution} theme={theme} isRTL={isRTL} rightElement={
        <View style={s.chipRow}>
          {(['all', 'active', 'archived'] as GradeFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setGradeFilter(f)}
              style={[s.filterChip, gradeFilter === f && { backgroundColor: theme.primary }]}
            >
              <Text style={[s.filterChipText, { color: gradeFilter === f ? '#fff' : theme.textSecondary }]}>
                {f === 'all' ? (language === 'he' ? 'הכל' : 'All')
                  : f === 'active' ? (language === 'he' ? 'פעילים' : 'Active')
                  : (language === 'he' ? 'ארכיון' : 'Archive')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      }>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={grades.map((g) => ({ label: g.grade, value: g.count, color: GRADE_COLORS[g.grade] }))}
            height={220}
            theme={theme}
          />
        </ScrollView>
      </Section>

      {/* 2.3 Grade Consensus */}
      {consensus.length > 0 && (
        <Section title={language === 'he' ? 'דרגה רשמית vs. מוצעת' : 'Official vs. Suggested Grade'} theme={theme} isRTL={isRTL}>
          <View style={s.table}>
            <View style={[s.tableHeader, { backgroundColor: theme.background }]}>
              <Text style={[s.th, { flex: 2, color: theme.textSecondary }]}>{language === 'he' ? 'מסלול' : 'Route'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'רשמי' : 'Official'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'מוצע' : 'Suggested'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'סטייה' : 'Gap'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'הצבעות' : 'Votes'}</Text>
            </View>
            {consensus.slice(0, 10).map((c, i) => (
              <View key={c.routeId} style={[s.tableRow, i % 2 === 1 && { backgroundColor: theme.background + '60' }]}>
                <Text style={[s.td, { flex: 2, color: theme.text }]} numberOfLines={1}>
                  {getRouteName({ name: c.routeName, nameHe: c.routeNameHe, nameEn: c.routeNameEn })}
                </Text>
                <Text style={[s.td, { color: theme.text, fontWeight: '600' }]}>{c.officialGrade}</Text>
                <Text style={[s.td, { color: theme.text }]}>
                  {c.suggestedGradeAvg >= 0 ? GRADE_ORDER[Math.round(c.suggestedGradeAvg)] || '?' : '?'}
                </Text>
                <Text
                  style={[
                    s.td,
                    {
                      color: c.deviation > 0.5 ? '#F44336' : c.deviation < -0.5 ? '#2196F3' : '#4CAF50',
                      fontWeight: '700',
                    },
                  ]}
                >
                  {c.deviation > 0 ? '+' : ''}{c.deviation.toFixed(1)}
                </Text>
                <Text style={[s.td, { color: theme.textSecondary }]}>{c.voteCount}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* 2.4 Top Routes */}
      <Section
        title={st.popularRoutes}
        theme={theme}
        isRTL={isRTL}
        rightElement={
          <View style={s.chipRow}>
            {(['sends', 'flashes', 'rating', 'feedbacks'] as RouteSortField[]).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setSortField(f)}
                style={[s.filterChip, sortField === f && { backgroundColor: theme.primary }]}
              >
                <Text style={[s.filterChipText, { color: sortField === f ? '#fff' : theme.textSecondary }]}>
                  {f === 'sends' ? 'Sends' : f === 'flashes' ? 'Flash' : f === 'rating' ? '⭐' : 'FB'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      >
        <View style={s.table}>
          <View style={[s.tableHeader, { backgroundColor: theme.background }]}>
            <Text style={[s.th, { width: 26, color: theme.textSecondary }]}>#</Text>
            <Text style={[s.th, { flex: 2, color: theme.textSecondary }]}>{language === 'he' ? 'מסלול' : 'Route'}</Text>
            <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'דרגה' : 'Grade'}</Text>
            <Text style={[s.th, { color: theme.textSecondary }]}>Sends</Text>
            <Text style={[s.th, { color: theme.textSecondary }]}>Flash</Text>
            <Text style={[s.th, { color: theme.textSecondary }]}>⭐</Text>
          </View>
          {topRoutes.slice(0, 20).map((r, i) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => setExpandedRoute(expandedRoute === r.id ? null : r.id)}
              style={[s.tableRow, i % 2 === 1 && { backgroundColor: theme.background + '60' }]}
            >
              <Text style={[s.td, { width: 26, color: theme.textSecondary }]}>{i + 1}</Text>
              <View style={[s.tdFlex, { flex: 2 }]}>
                <View style={[s.colorDot, { backgroundColor: r.color }]} />
                <Text style={[s.td, { color: theme.text }]} numberOfLines={1}>{getRouteName(r)}</Text>
              </View>
              <Text style={[s.td, { color: GRADE_COLORS[r.grade] || theme.text, fontWeight: '600' }]}>{r.grade}</Text>
              <Text style={[s.td, { color: theme.text }]}>{r.sends}</Text>
              <Text style={[s.td, { color: theme.text }]}>{r.flashes}</Text>
              <Text style={[s.td, { color: theme.text }]}>{r.rating.toFixed(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* 2.5 Rating Distribution */}
      {ratings && (
        <Section title={st.ratingDistribution} theme={theme} isRTL={isRTL}>
          <BarChart
            data={ratings.stars.map((s) => ({
              label: `${s.rating}⭐`,
              value: s.count,
              color: RATING_COLORS[s.rating],
            }))}
            horizontal
            theme={theme}
            showValues
          />
        </Section>
      )}

      {/* 2.6 Activity Heatmap */}
      {heatmap && (
        <Section title={st.activityPatterns} theme={theme} isRTL={isRTL}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Heatmap data={heatmap} theme={theme} language={language} />
          </ScrollView>
        </Section>
      )}

      {/* 2.7 Grade by Hour */}
      {gradeHour.length > 0 && (
        <Section
          title={language === 'he' ? 'דפוסי טיפוס לפי דרגה ושעה' : 'Climbing Patterns by Grade & Hour'}
          theme={theme}
          isRTL={isRTL}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Stacked visualization */}
              {gradeHour.map((h) => {
                const total = h.easy + h.medium + h.hard + h.elite;
                const maxTotal = Math.max(...gradeHour.map((x) => x.easy + x.medium + x.hard + x.elite), 1);
                const width = 200;
                return (
                  <View key={h.hour} style={s.stackedRow}>
                    <Text style={[s.stackedLabel, { color: theme.textSecondary }]}>{`${h.hour}:00`}</Text>
                    <View style={s.stackedBar}>
                      {h.easy > 0 && (
                        <View style={{ width: (h.easy / maxTotal) * width, height: 18, backgroundColor: GRADE_GROUP_COLORS.easy, borderRadius: 3 }} />
                      )}
                      {h.medium > 0 && (
                        <View style={{ width: (h.medium / maxTotal) * width, height: 18, backgroundColor: GRADE_GROUP_COLORS.medium, borderRadius: 3 }} />
                      )}
                      {h.hard > 0 && (
                        <View style={{ width: (h.hard / maxTotal) * width, height: 18, backgroundColor: GRADE_GROUP_COLORS.hard, borderRadius: 3 }} />
                      )}
                      {h.elite > 0 && (
                        <View style={{ width: (h.elite / maxTotal) * width, height: 18, backgroundColor: GRADE_GROUP_COLORS.elite, borderRadius: 3 }} />
                      )}
                    </View>
                    <Text style={[s.stackedCount, { color: theme.textSecondary }]}>{total}</Text>
                  </View>
                );
              })}
              {/* Legend */}
              <View style={s.gradeGroupLegend}>
                {[
                  { key: 'easy', label: language === 'he' ? 'קל (V0-2)' : 'Easy (V0-2)', color: GRADE_GROUP_COLORS.easy },
                  { key: 'medium', label: language === 'he' ? 'קל+ (V3-4)' : 'Easy+ (V3-4)', color: GRADE_GROUP_COLORS.medium },
                  { key: 'hard', label: language === 'he' ? 'קל++ (V5-6)' : 'Easy++ (V5-6)', color: GRADE_GROUP_COLORS.hard },
                  { key: 'elite', label: language === 'he' ? 'קל+++ (V7+)' : 'Easy+++ (V7+)', color: GRADE_GROUP_COLORS.elite },
                ].map((g) => (
                  <View key={g.key} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: g.color }]} />
                    <Text style={[s.legendText, { color: theme.textSecondary }]}>{g.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </Section>
      )}

      {/* 2.8 Low Rated Routes */}
      {lowRated.length > 0 && (
        <Section title={st.lowestRated} theme={theme} isRTL={isRTL}>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>{st.minFeedbacks}</Text>
          {lowRated.map((r) => (
            <View key={r.id} style={[s.warningCard, { backgroundColor: theme.background, borderLeftColor: '#F44336' }]}>
              <View style={s.warningRow}>
                <View style={[s.colorDot, { backgroundColor: r.color }]} />
                <Text style={[s.warningName, { color: theme.text }]} numberOfLines={1}>{getRouteName(r)}</Text>
                <Text style={[s.warningGrade, { color: GRADE_COLORS[r.grade] || theme.text }]}>{r.grade}</Text>
              </View>
              <View style={s.warningStats}>
                <Text style={{ color: '#F44336', fontWeight: '700', fontSize: 16 }}>⭐ {r.avgRating.toFixed(1)}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {r.feedbackCount} {st.feedbacks}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 10 }}>
                  {r.createdAt.toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

const GRADE_ORDER = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

const createStyles = (theme: any, isRTL: boolean) =>
  StyleSheet.create({
    container: {
      paddingBottom: 24,
      paddingTop: 8,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 4,
    },
    filterChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterChipText: {
      fontSize: 10,
      fontWeight: '600',
    },
    table: {
      borderRadius: 8,
      overflow: 'hidden',
    },
    tableHeader: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    tableRow: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    th: {
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
      flex: 1,
    },
    td: {
      fontSize: 12,
      textAlign: 'center',
      flex: 1,
    },
    tdFlex: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    subtitle: {
      fontSize: 11,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    warningCard: {
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 4,
    },
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    warningName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
    },
    warningGrade: {
      fontSize: 12,
      fontWeight: '700',
    },
    warningStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    stackedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 3,
    },
    stackedLabel: {
      width: 40,
      fontSize: 10,
      textAlign: 'right',
      marginRight: 8,
    },
    stackedBar: {
      flexDirection: 'row',
      gap: 1,
    },
    stackedCount: {
      fontSize: 10,
      marginLeft: 6,
    },
    gradeGroupLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 10,
    },
  });
