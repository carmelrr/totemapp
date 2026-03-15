import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import StatCard from '../components/StatCard';
import Sparkline from '../components/Sparkline';
import SectionLoader from '../components/SectionLoader';
import { getDashboard } from '../services/StatisticsService';
import type { DateRange, DashboardData } from '../types';

interface Props {
  range: DateRange;
  theme: any;
  t: any;
  language: 'he' | 'en';
  isRTL: boolean;
  onNavigateToTab: (index: number) => void;
}

export default function DashboardTab({ range, theme, t, language, isRTL, onNavigateToTab }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getDashboard(range);
      setData(result);
    } catch (e) {
      console.error('Dashboard load error:', e);
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

  const s = styles(theme);
  const st = t.statistics;

  if (loading) return <SectionLoader theme={theme} />;
  if (!data) return null;

  const cards = [
    {
      icon: '🧗',
      label: st.activeRoutes,
      value: data.activeRoutes,
      trend: data.activeRoutesChange,
      subtitle: `⭐ ${data.avgRating.toFixed(1)}`,
      color: '#2196F3',
      tabIndex: 1,
    },
    {
      icon: '👥',
      label: st.activeUsers,
      value: data.activeUsers,
      color: '#9C27B0',
      tabIndex: 2,
      sparkline: data.dailyActivity,
    },
    {
      icon: '🎯',
      label: st.sprayRoutes,
      value: data.sprayRoutesCount,
      subtitle: data.topSprayRoute ? `🔥 ${data.topSprayRoute.name}` : undefined,
      color: '#FF5722',
      tabIndex: 3,
    },
    {
      icon: '🌍',
      label: language === 'he' ? 'מסלולים חדשים השבוע' : 'New Routes This Week',
      value: data.newCommunityRoutes,
      trend: data.communityChange,
      color: '#4CAF50',
      tabIndex: 4,
    },
    {
      icon: '⭐',
      label: st.totalFeedbacks,
      value: data.totalFeedbacks,
      subtitle: `Flash ${data.flashRate.toFixed(0)}%`,
      color: '#FFC107',
      tabIndex: 1,
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={s.grid}>
        {cards.slice(0, 4).map((card, i) => (
          <TouchableOpacity
            key={i}
            style={s.cardWrapper}
            onPress={() => onNavigateToTab(card.tabIndex)}
            activeOpacity={0.7}
          >
            <View style={[s.dashCard, { borderTopColor: card.color, backgroundColor: theme.surface }]}>
              <Text style={s.cardIcon}>{card.icon}</Text>
              <Text style={[s.cardValue, { color: theme.text }]}>{card.value}</Text>
              {card.trend !== undefined && card.trend !== 0 && (
                <Text style={[s.cardTrend, { color: card.trend > 0 ? '#4CAF50' : '#F44336' }]}>
                  {card.trend > 0 ? '↑' : '↓'}{Math.abs(card.trend).toFixed(0)}%
                </Text>
              )}
              {card.sparkline && (
                <Sparkline data={card.sparkline} color={card.color} width={70} height={20} />
              )}
              <Text style={[s.cardLabel, { color: theme.textSecondary }]}>{card.label}</Text>
              {card.subtitle && (
                <Text style={[s.cardSubtitle, { color: theme.textSecondary }]}>{card.subtitle}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fifth card — full width */}
      <TouchableOpacity
        style={s.fullCardWrapper}
        onPress={() => onNavigateToTab(cards[4].tabIndex)}
        activeOpacity={0.7}
      >
        <View style={[s.dashCard, s.fullCard, { borderTopColor: cards[4].color, backgroundColor: theme.surface }]}>
          <Text style={s.cardIcon}>{cards[4].icon}</Text>
          <View style={s.fullCardRow}>
            <Text style={[s.cardValue, { color: theme.text }]}>{cards[4].value}</Text>
            <Text style={[s.cardLabel, { color: theme.textSecondary, marginLeft: 8, flex: 1 }]}>
              {cards[4].label}
            </Text>
          </View>
          {cards[4].subtitle && (
            <Text style={[s.cardSubtitle, { color: theme.textSecondary }]}>{cards[4].subtitle}</Text>
          )}
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: 16,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    cardWrapper: {
      width: '47%',
    },
    dashCard: {
      borderRadius: 16,
      padding: 16,
      borderTopWidth: 3,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    fullCardWrapper: {
      marginTop: 12,
    },
    fullCard: {
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    fullCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    cardIcon: {
      fontSize: 24,
      marginBottom: 6,
    },
    cardValue: {
      fontSize: 28,
      fontWeight: '800',
    },
    cardTrend: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    cardLabel: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 4,
      textAlign: 'center',
    },
    cardSubtitle: {
      fontSize: 10,
      marginTop: 2,
      opacity: 0.7,
    },
  });
