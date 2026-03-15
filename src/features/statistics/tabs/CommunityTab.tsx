import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Section from '../components/Section';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import SectionLoader from '../components/SectionLoader';
import {
  getCommunityKPIs,
  getCommunityCreationTrend,
  getCommunityCreators,
  getPopularCommunityRoutes,
  getExpiringSoonRoutes,
} from '../services/StatisticsService';
import { GRADE_COLORS } from '../constants';
import type {
  DateRange,
  CommunityKPIs,
  CommunityCreator,
  CommunityRouteCard,
} from '../types';

interface Props {
  range: DateRange;
  theme: any;
  t: any;
  language: 'he' | 'en';
  isRTL: boolean;
}

export default function CommunityTab({ range, theme, t, language, isRTL }: Props) {
  const [kpis, setKPIs] = useState<CommunityKPIs | null>(null);
  const [trend, setTrend] = useState<{ period: string; newRoutes: number; sends: number }[]>([]);
  const [creators, setCreators] = useState<CommunityCreator[]>([]);
  const [popular, setPopular] = useState<CommunityRouteCard[]>([]);
  const [expiring, setExpiring] = useState<CommunityRouteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [k, tr, cr, pop, exp] = await Promise.all([
        getCommunityKPIs(range),
        getCommunityCreationTrend(),
        getCommunityCreators(),
        getPopularCommunityRoutes(),
        getExpiringSoonRoutes(),
      ]);
      setKPIs(k);
      setTrend(tr);
      setCreators(cr);
      setPopular(pop);
      setExpiring(exp);
    } catch (e) {
      console.error('Community tab load error:', e);
    }
  }, [range]);

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
      {/* 5.1 KPIs */}
      {kpis && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiRow}>
          <StatCard
            label={language === 'he' ? 'מסלולים חיים' : 'Live Routes'}
            value={kpis.liveRoutes}
            color="#4CAF50"
            theme={theme}
          />
          <StatCard
            label={language === 'he' ? 'חדשים השבוע' : 'New This Week'}
            value={kpis.newThisWeek}
            color="#2196F3"
            theme={theme}
          />
          <StatCard label={st.communitySends} value={kpis.totalSends} color="#FF5722" theme={theme} />
          <StatCard
            label={language === 'he' ? 'יוצרים ייחודיים' : 'Unique Creators'}
            value={kpis.uniqueCreators}
            color="#9C27B0"
            theme={theme}
          />
        </ScrollView>
      )}

      {/* 5.2 Creation Trend */}
      {trend.length > 0 && (
        <Section title={language === 'he' ? 'טרנד יצירת מסלולים' : 'Route Creation Trend'} theme={theme} isRTL={isRTL}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={trend.map((t) => ({
                label: t.period.slice(5),
                value: t.newRoutes,
                color: '#2196F3',
              }))}
              height={180}
              theme={theme}
            />
          </ScrollView>
        </Section>
      )}

      {/* 5.3 Top Creators */}
      {creators.length > 0 && (
        <Section title={language === 'he' ? 'טופ יוצרים בקהילה' : 'Top Community Creators'} theme={theme} isRTL={isRTL}>
          <View style={s.table}>
            <View style={[s.tableHeader, { backgroundColor: theme.background }]}>
              <Text style={[s.th, { width: 26, color: theme.textSecondary }]}>#</Text>
              <Text style={[s.th, { flex: 2, color: theme.textSecondary }]}>{language === 'he' ? 'יוצר' : 'Creator'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>{language === 'he' ? 'מסלולים' : 'Routes'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>❤️</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>🧗</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>👁️</Text>
            </View>
            {creators.map((c, i) => (
              <View key={c.userId} style={[s.tableRow, i % 2 === 1 && { backgroundColor: theme.background + '60' }]}>
                <Text style={[s.td, { width: 26, color: theme.textSecondary }]}>{i + 1}</Text>
                <Text style={[s.td, { flex: 2, color: theme.text, textAlign: 'left' }]} numberOfLines={1}>
                  {c.displayName}
                </Text>
                <Text style={[s.td, { color: theme.text }]}>{c.routeCount}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.totalLikes}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.totalSends}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.totalViews}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* 5.4 Popular Routes Now */}
      {popular.length > 0 && (
        <Section title={language === 'he' ? 'מסלולים פופולריים עכשיו' : 'Popular Routes Now'} theme={theme} isRTL={isRTL}>
          {popular.map((r) => (
            <View key={r.id} style={[s.routeCard, { backgroundColor: theme.background }]}>
              <View style={s.routeCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeCardName, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[s.routeCardCreator, { color: theme.textSecondary }]}>
                    {r.creatorName || r.creator}
                  </Text>
                </View>
                <Text style={[s.routeCardGrade, { color: GRADE_COLORS[r.grade] || theme.text }]}>{r.grade}</Text>
              </View>
              <View style={s.routeCardStats}>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>❤️ {r.likes}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>🧗 {r.sends}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>👁️ {r.views}</Text>
              </View>
              {/* Expiry progress bar */}
              <View style={s.expiryRow}>
                <View style={[s.progressBar, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${Math.max(0, Math.min(100, (r.daysUntilExpiry / 30) * 100))}%`,
                        backgroundColor: r.daysUntilExpiry <= 7 ? '#F44336' : r.daysUntilExpiry <= 14 ? '#FF9800' : '#4CAF50',
                      },
                    ]}
                  />
                </View>
                <Text style={[s.expiryText, { color: r.daysUntilExpiry <= 7 ? '#F44336' : theme.textSecondary }]}>
                  {r.daysUntilExpiry}{language === 'he' ? ' ימים' : 'd'}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      )}

      {/* 5.5 Expiring Soon */}
      {expiring.length > 0 && (
        <Section title={language === 'he' ? 'עומדים לפוג בקרוב' : 'Expiring Soon'} theme={theme} isRTL={isRTL}>
          {expiring.map((r) => (
            <View
              key={r.id}
              style={[s.expiringCard, { backgroundColor: theme.background, borderLeftColor: '#F44336' }]}
            >
              <View style={s.expiringHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeCardName, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[s.routeCardCreator, { color: theme.textSecondary }]}>
                    {r.creatorName || r.creator} • {r.grade}
                  </Text>
                </View>
                <View style={s.expiryBadge}>
                  <Text style={s.expiryBadgeText}>
                    {r.daysUntilExpiry}{language === 'he' ? ' ימים' : 'd'}
                  </Text>
                </View>
              </View>
              <View style={s.routeCardStats}>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>❤️ {r.likes}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>🧗 {r.sends}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>👁️ {r.views}</Text>
              </View>
            </View>
          ))}
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
    routeCard: {
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    routeCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    routeCardName: {
      fontSize: 14,
      fontWeight: '600',
    },
    routeCardCreator: {
      fontSize: 11,
      marginTop: 1,
    },
    routeCardGrade: {
      fontSize: 14,
      fontWeight: '800',
      marginLeft: 8,
    },
    routeCardStats: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 8,
    },
    expiryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressBar: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    expiryText: {
      fontSize: 11,
      fontWeight: '600',
    },
    expiringCard: {
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 4,
    },
    expiringHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    expiryBadge: {
      backgroundColor: '#F44336',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    expiryBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
  });
