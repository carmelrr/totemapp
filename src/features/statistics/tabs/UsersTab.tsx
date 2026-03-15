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
import LineChart from '../components/LineChart';
import Heatmap from '../components/Heatmap';
import SectionLoader from '../components/SectionLoader';
import {
  getUsersKPIs,
  getDAUData,
  getUniqueUsersHeatmap,
  getTopClimbers,
  getRetention,
} from '../services/StatisticsService';
import type {
  DateRange,
  UsersKPIs,
  DAUDataPoint,
  ActivityHeatmapData,
  TopClimber,
  RetentionData,
} from '../types';

interface Props {
  range: DateRange;
  theme: any;
  t: any;
  language: 'he' | 'en';
  isRTL: boolean;
}

export default function UsersTab({ range, theme, t, language, isRTL }: Props) {
  const [kpis, setKPIs] = useState<UsersKPIs | null>(null);
  const [dauData, setDauData] = useState<DAUDataPoint[]>([]);
  const [heatmap, setHeatmap] = useState<ActivityHeatmapData | null>(null);
  const [climbers, setClimbers] = useState<TopClimber[]>([]);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dauVisibility, setDauVisibility] = useState({ dau: true, wau: true, mau: true });

  const load = useCallback(async () => {
    try {
      const [k, dau, hm, cl, ret] = await Promise.all([
        getUsersKPIs(range),
        getDAUData(range),
        getUniqueUsersHeatmap(range),
        getTopClimbers(range),
        getRetention(range),
      ]);
      setKPIs(k);
      setDauData(dau);
      setHeatmap(hm);
      setClimbers(cl);
      setRetention(ret);
    } catch (e) {
      console.error('Users tab load error:', e);
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
      {/* 3.1 KPIs */}
      {kpis && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiRow}>
          <StatCard label={st.activeUsers} value={kpis.activeUsersInPeriod} color="#9C27B0" theme={theme} />
          <StatCard label={st.totalUsers} value={kpis.totalRegistered} color="#607D8B" theme={theme} />
          <StatCard
            label={language === 'he' ? 'ממוצע sends/יום' : 'Avg Sends/Day'}
            value={kpis.avgSendsPerDay.toFixed(1)}
            color="#4CAF50"
            theme={theme}
          />
          <StatCard
            label={language === 'he' ? 'שיא יומי' : 'Peak Day'}
            value={kpis.peakDay.count}
            color="#FF5722"
            theme={theme}
            subtitle={kpis.peakDay.date}
          />
        </ScrollView>
      )}

      {/* 3.2 DAU/WAU/MAU */}
      {dauData.length > 0 && (
        <Section title={language === 'he' ? 'משתמשים פעילים לאורך זמן' : 'Active Users Over Time'} theme={theme} isRTL={isRTL}>
          {/* Toggle buttons */}
          <View style={s.toggleRow}>
            {[
              { key: 'dau' as const, label: 'DAU', color: '#2196F3' },
              { key: 'wau' as const, label: 'WAU', color: '#4CAF50' },
              { key: 'mau' as const, label: 'MAU', color: '#FF9800' },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setDauVisibility((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                style={[
                  s.toggleChip,
                  {
                    backgroundColor: dauVisibility[item.key] ? item.color : theme.background,
                    borderColor: item.color,
                  },
                ]}
              >
                <Text style={{ color: dauVisibility[item.key] ? '#fff' : item.color, fontSize: 11, fontWeight: '700' }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              datasets={[
                { label: 'DAU', data: dauData.map((d) => d.dau), color: '#2196F3', visible: dauVisibility.dau },
                { label: 'WAU', data: dauData.map((d) => d.wau), color: '#4CAF50', visible: dauVisibility.wau },
                { label: 'MAU', data: dauData.map((d) => d.mau), color: '#FF9800', visible: dauVisibility.mau },
              ]}
              labels={dauData.map((d) => d.date.slice(5))}
              height={200}
              theme={theme}
            />
          </ScrollView>
        </Section>
      )}

      {/* 3.3 Unique Users Heatmap */}
      {heatmap && (
        <Section
          title={language === 'he' ? 'מתי הכי הרבה אנשים בקיר' : 'When Are Most People at the Wall'}
          theme={theme}
          isRTL={isRTL}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Heatmap data={heatmap} theme={theme} language={language} isUniqueUsers />
          </ScrollView>
        </Section>
      )}

      {/* 3.4 Leaderboard */}
      {climbers.length > 0 && (
        <Section title={language === 'he' ? 'טופ מטפסים פעילים' : 'Top Active Climbers'} theme={theme} isRTL={isRTL}>
          <View style={s.table}>
            <View style={[s.tableHeader, { backgroundColor: theme.background }]}>
              <Text style={[s.th, { width: 26, color: theme.textSecondary }]}>#</Text>
              <Text style={[s.th, { flex: 2, color: theme.textSecondary }]}>{language === 'he' ? 'שם' : 'Name'}</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>Sends</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>Flash</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>%</Text>
              <Text style={[s.th, { color: theme.textSecondary }]}>⭐</Text>
            </View>
            {climbers.map((c, i) => (
              <View key={c.userId} style={[s.tableRow, i % 2 === 1 && { backgroundColor: theme.background + '60' }]}>
                <Text style={[s.td, { width: 26, color: theme.textSecondary, fontWeight: '700' }]}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </Text>
                <Text style={[s.td, { flex: 2, color: theme.text, textAlign: 'left' }]} numberOfLines={1}>
                  {c.displayName}
                </Text>
                <Text style={[s.td, { color: theme.text }]}>{c.sends}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.flashes}</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.flashRate.toFixed(0)}%</Text>
                <Text style={[s.td, { color: theme.text }]}>{c.avgRating.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* 3.5 Retention */}
      {retention && (
        <Section title={language === 'he' ? 'ריטנשן' : 'Retention'} theme={theme} isRTL={isRTL}>
          <View style={s.retentionCards}>
            <View style={[s.retentionCard, { backgroundColor: theme.background }]}>
              <Text style={[s.retentionValue, { color: retention.weeklyRetention >= 50 ? '#4CAF50' : '#FF9800' }]}>
                {retention.weeklyRetention.toFixed(0)}%
              </Text>
              <Text style={[s.retentionLabel, { color: theme.textSecondary }]}>
                {language === 'he' ? 'ריטנשן שבועי' : 'Weekly Retention'}
              </Text>
            </View>
            <View style={[s.retentionCard, { backgroundColor: theme.background }]}>
              <Text style={[s.retentionValue, { color: retention.monthlyRetention >= 50 ? '#4CAF50' : '#FF9800' }]}>
                {retention.monthlyRetention.toFixed(0)}%
              </Text>
              <Text style={[s.retentionLabel, { color: theme.textSecondary }]}>
                {language === 'he' ? 'ריטנשן חודשי' : 'Monthly Retention'}
              </Text>
            </View>
          </View>
          {retention.weeklyTrend.length > 2 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              <LineChart
                datasets={[
                  { label: language === 'he' ? 'שבועי' : 'Weekly', data: retention.weeklyTrend.map((t) => t.rate), color: '#2196F3' },
                  { label: language === 'he' ? 'חודשי' : 'Monthly', data: retention.monthlyTrend.map((t) => t.rate), color: '#FF9800' },
                ]}
                labels={retention.weeklyTrend.map((t) => t.period.slice(5))}
                height={160}
                theme={theme}
                showDots={false}
              />
            </ScrollView>
          )}
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
    toggleRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    toggleChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1.5,
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
    retentionCards: {
      flexDirection: 'row',
      gap: 12,
    },
    retentionCard: {
      flex: 1,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    retentionValue: {
      fontSize: 36,
      fontWeight: '800',
    },
    retentionLabel: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 4,
    },
  });
