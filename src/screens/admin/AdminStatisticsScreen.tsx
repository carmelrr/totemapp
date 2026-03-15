import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { getPeriodDates } from '@/features/statistics/constants';
import PeriodFilter from '@/features/statistics/components/PeriodFilter';
import DashboardTab from '@/features/statistics/tabs/DashboardTab';
import RoutesTab from '@/features/statistics/tabs/RoutesTab';
import UsersTab from '@/features/statistics/tabs/UsersTab';
import SprayTab from '@/features/statistics/tabs/SprayTab';
import CommunityTab from '@/features/statistics/tabs/CommunityTab';
import type { DatePeriod, DateRange } from '@/features/statistics/types';

const TAB_KEYS = ['dashboard', 'routes', 'users', 'spray', 'community'] as const;

const TAB_LABELS: Record<string, { he: string; en: string }> = {
  dashboard: { he: 'דשבורד', en: 'Dashboard' },
  routes: { he: 'מסלולים', en: 'Routes' },
  users: { he: 'משתמשים', en: 'Users' },
  spray: { he: 'ספריי וול', en: 'Spray Wall' },
  community: { he: 'קהילה', en: 'Community' },
};

export default function AdminStatisticsScreen() {
  const { theme } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const navigation = useNavigation();

  const [tabIndex, setTabIndex] = useState(0);
  const [period, setPeriod] = useState<DatePeriod>('30d');
  // Track which tabs have been visited for lazy loading
  const visitedTabs = useRef(new Set([0]));

  const range: DateRange = useMemo(() => getPeriodDates(period), [period]);

  const periodLabels = useMemo(
    () =>
      language === 'he'
        ? { '7d': '7 ימים', '30d': '30 יום', '90d': '90 יום', '1y': 'שנה', all: 'הכל' }
        : { '7d': '7d', '30d': '30d', '90d': '90d', '1y': '1y', all: 'All' },
    [language],
  );

  const handleNavigateToTab = useCallback((index: number) => {
    visitedTabs.current.add(index);
    setTabIndex(index);
  }, []);

  const handleTabPress = useCallback((index: number) => {
    visitedTabs.current.add(index);
    setTabIndex(index);
  }, []);

  const commonProps = useMemo(
    () => ({ range, theme, t, language: language as 'he' | 'en', isRTL }),
    [range, theme, t, language, isRTL],
  );

  const renderActiveTab = () => {
    switch (tabIndex) {
      case 0:
        return <DashboardTab {...commonProps} onNavigateToTab={handleNavigateToTab} />;
      case 1:
        return visitedTabs.current.has(1) ? <RoutesTab {...commonProps} /> : null;
      case 2:
        return visitedTabs.current.has(2) ? <UsersTab {...commonProps} /> : null;
      case 3:
        return visitedTabs.current.has(3) ? <SprayTab {...commonProps} /> : null;
      case 4:
        return visitedTabs.current.has(4) ? <CommunityTab {...commonProps} /> : null;
      default:
        return null;
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.statistics?.title ?? 'Statistics'}</Text>
        <View style={styles.backButton} />
      </View>

      {/* Period Filter */}
      <PeriodFilter
        selected={period}
        onSelect={setPeriod}
        theme={theme}
        isRTL={isRTL}
        labels={periodLabels}
      />

      {/* Tab Bar */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TAB_KEYS.map((key, index) => {
            const active = index === tabIndex;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => handleTabPress(index)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, active && { color: theme.primary, fontWeight: '700' }]}>
                  {TAB_LABELS[key][language] || TAB_LABELS[key].en}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Active Tab Content */}
      <View style={styles.tabContent}>
        {renderActiveTab()}
      </View>
    </SafeAreaView>
  );
}

// --- Styles ---

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      fontSize: 24,
      color: theme.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    tabBarContainer: {
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 8,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: theme.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    tabContent: {
      flex: 1,
    },
  });
}
