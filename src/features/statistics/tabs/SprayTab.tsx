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
import LineChart from '../components/LineChart';
import SectionLoader from '../components/SectionLoader';
import {
  getSprayKPIs,
  getTopSprayRoutes,
  getSprayCreators,
  getSprayGradeDistribution,
  getSprayTrend,
} from '../services/StatisticsService';
import { GRADE_COLORS } from '../constants';
import type {
  DateRange,
  SprayKPIs,
  SprayRouteEntry,
  SprayCreator,
  GradeDistributionEntry,
  SprayTrendPoint,
  SpraySortMode,
} from '../types';

interface Props {
  range: DateRange;
  theme: any;
  t: any;
  language: 'he' | 'en';
  isRTL: boolean;
}

export default function SprayTab({ range, theme, t, language, isRTL }: Props) {
  const [kpis, setKPIs] = useState<SprayKPIs | null>(null);
  const [sprayRoutes, setSprayRoutes] = useState<SprayRouteEntry[]>([]);
  const [sortMode, setSortMode] = useState<SpraySortMode>('popularity');
  const [creators, setCreators] = useState<SprayCreator[]>([]);
  const [grades, setGrades] = useState<GradeDistributionEntry[]>([]);
  const [trend, setTrend] = useState<SprayTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [k, sr, cr, gr, tr] = await Promise.all([
        getSprayKPIs(range),
        getTopSprayRoutes(sortMode),
        getSprayCreators(),
        getSprayGradeDistribution(),
        getSprayTrend(),
      ]);
      setKPIs(k);
      setSprayRoutes(sr);
      setCreators(cr);
      setGrades(gr);
      setTrend(tr);
    } catch (e) {
      console.error('Spray tab load error:', e);
    }
  }, [range, sortMode]);

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

  return (
    <ScrollView
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* 4.1 KPIs */}
      {kpis && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiRow}>
          <StatCard label={st.sprayRoutes} value={kpis.totalSprayRoutes} color="#FF5722" theme={theme} />
          <StatCard label={st.avgRating} value={kpis.avgRating.toFixed(1)} color="#FFC107" theme={theme} suffix="⭐" />
          <StatCard label={st.tops} value={kpis.totalTops} color="#4CAF50" theme={theme} />
          <StatCard
            label={language === 'he' ? 'יוצרים ייחודיים' : 'Unique Creators'}
            value={kpis.uniqueCreators}
            color="#9C27B0"
            theme={theme}
          />
        </ScrollView>
      )}

      {/* 4.2 Top Spray Routes */}
      <Section
        title={st.topSprayRoutes}
        theme={theme}
        isRTL={isRTL}
        rightElement={
          <View style={s.chipRow}>
            {([
              { key: 'popularity' as SpraySortMode, label: '🔥', fullLabel: language === 'he' ? 'פופולריות' : 'Popular' },
              { key: 'rating' as SpraySortMode, label: '⭐', fullLabel: language === 'he' ? 'דירוג' : 'Rating' },
              { key: 'trending' as SpraySortMode, label: '📈', fullLabel: 'Trend' },
            ]).map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setSortMode(item.key)}
                style={[s.filterChip, sortMode === item.key && { backgroundColor: theme.primary }]}
              >
                <Text style={[s.filterChipText, { color: sortMode === item.key ? '#fff' : theme.textSecondary }]}>
                  {item.label}
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
            <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'יוצר' : 'Creator'}</Text>
            <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'דרגה' : 'Grade'}</Text>
            <Text style={[s.th, { color: theme.textSecondary }]}>Tops</Text>
            <Text style={[s.th, { color: theme.textSecondary }]}>⭐</Text>
          </View>
          {sprayRoutes.slice(0, 15).map((r, i) => (
            <View key={r.id} style={[s.tableRow, i % 2 === 1 && { backgroundColor: theme.background + '60' }]}>
              <Text style={[s.td, { width: 26, color: theme.textSecondary }]}>{i + 1}</Text>
              <Text style={[s.td, { flex: 2, color: theme.text }]} numberOfLines={1}>{r.name}</Text>
              <Text style={[s.td, { color: theme.textSecondary }]} numberOfLines={1}>{r.creatorName || '—'}</Text>
              <Text style={[s.td, { color: GRADE_COLORS[r.grade] || theme.text, fontWeight: '600' }]}>{r.grade}</Text>
              <Text style={[s.td, { color: theme.text }]}>{r.topsCount}</Text>
              <Text style={[s.td, { color: theme.text }]}>{r.avgRating.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* 4.3 Top Creators */}
      {creators.length > 0 && (
        <Section title={language === 'he' ? 'טופ יוצרי מסלולים' : 'Top Route Creators'} theme={theme} isRTL={isRTL}>
          <View style={s.table}>
            <View style={[s.tableHeader, { backgroundColor: theme.background }]}>
              <Text style={[s.th, { width: 26, color: theme.textSecondary }]}>#</Text>
              <Text style={[s.th, { flex: 2, color: theme.textSecondary }]}>{language === 'he' ? 'יוצר' : 'Creator'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'מסלולים' : 'Routes'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>⭐</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>Tops</Text>
            </View>
            {creators.map((c, i) => (
              <View key={c.userId} style={[s.tableRow, i % 2 === 1 && { backgroundColor: theme.background + '60' }]}>
                <Text style={[s.td, { width: 26, color: theme.textSecondary }]}>{i + 1}</Text>
                <Text style={[s.td, { flex: 2, color: theme.text }]} numberOfLines={1}>{c.displayName}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.routesCreated}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.avgRating.toFixed(1)}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.totalTops}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* 4.4 Spray Grade Distribution */}
      {grades.length > 0 && (
        <Section title={st.gradeDistribution} theme={theme} isRTL={isRTL}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={grades.map((g) => ({ label: g.grade, value: g.count, color: GRADE_COLORS[g.grade] }))}
              height={200}
              theme={theme}
            />
          </ScrollView>
        </Section>
      )}

      {/* 4.5 Spray Trend */}
      {trend.length > 0 && (
        <Section title={language === 'he' ? 'טרנד פעילות ספריי' : 'Spray Activity Trend'} theme={theme} isRTL={isRTL}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              datasets={[
                {
                  label: language === 'he' ? 'מסלולים חדשים' : 'New Routes',
                  data: trend.map((t) => t.newRoutes),
                  color: '#2196F3',
                },
                {
                  label: 'Tops',
                  data: trend.map((t) => t.tops),
                  color: '#4CAF50',
                },
              ]}
              labels={trend.map((t) => t.period.slice(5))}
              height={180}
              theme={theme}
            />
          </ScrollView>
        </Section>
      )}
    </ScrollView>
  );
}

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
      fontSize: 11,
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
  });
