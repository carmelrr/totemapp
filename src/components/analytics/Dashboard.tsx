import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useUserRouteStatus } from '@/hooks/useUserRouteStatus';
import { useFirebaseRoutes } from '@/features/routes-map/hooks/useFirebaseRoutes';
import { getGradeDifficulty } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * דשבורד סטטיסטיקות בסגנון TopLogger
 * מציג התפלגות דרגות, סטטוס מסלולים וסטטיסטיקות אישיות
 */
export default function Dashboard() {
  const { getStatistics, getRouteStatus } = useUserRouteStatus();
  const { routes } = useFirebaseRoutes();
  
  const stats = getStatistics();

  // ניתוח התפלגות דרגות
  const gradeDistribution = useMemo(() => {
    const distribution: Record<string, { total: number; sent: number }> = {};
    
    routes.forEach(route => {
      const grade = route.grade || 'לא ידוע';
      const status = getRouteStatus(route.id);
      
      if (!distribution[grade]) {
        distribution[grade] = { total: 0, sent: 0 };
      }
      
      distribution[grade].total++;
      if (status === 'sent' || status === 'flashed') {
        distribution[grade].sent++;
      }
    });

    return Object.entries(distribution)
      .sort(([a], [b]) => getGradeDifficulty(a) - getGradeDifficulty(b))
      .map(([grade, data]) => ({
        grade,
        ...data,
        percentage: (data.sent / data.total) * 100,
      }));
  }, [routes, getRouteStatus]);

  // חישוב נתונים נוספים
  const totalRoutes = routes.length;
  const myProgress = useMemo(() => {
    const statusCounts = routes.reduce((acc, route) => {
      const status = getRouteStatus(route.id);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      unsent: statusCounts.unsent || 0,
      project: statusCounts.project || 0, 
      sent: statusCounts.sent || 0,
      flashed: statusCounts.flashed || 0,
    };
  }, [routes, getRouteStatus]);

  const StatCard = ({ title, value, subtitle, color = '#3b82f6' }: {
    title: string;
    value: string | number;
    subtitle?: string;
    color?: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const ProgressBar = ({ 
    label, 
    value, 
    max, 
    color 
  }: {
    label: string;
    value: number;
    max: number;
    color: string;
  }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={styles.progressValue}>{value}/{max}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${percentage}%`, 
                backgroundColor: color 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressPercentage}>
          {percentage.toFixed(1)}%
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* כרטיסי סטטיסטיקה עיקריים */}
      <View style={styles.statsGrid}>
        <StatCard
          title="סה״כ מסלולים"
          value={totalRoutes}
          color="#6b7280"
        />
        <StatCard
          title="שלחת"
          value={myProgress.sent}
          subtitle={`${((myProgress.sent / totalRoutes) * 100).toFixed(1)}%`}
          color="#10b981"
        />
        <StatCard
          title="פלאש"
          value={myProgress.flashed}
          subtitle={`${((myProgress.flashed / totalRoutes) * 100).toFixed(1)}%`}
          color="#8b5cf6"
        />
        <StatCard
          title="פרויקטים"
          value={myProgress.project}
          color="#f59e0b"
        />
      </View>

      {/* התפלגות דרגות */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>התקדמות לפי דרגות</Text>
        {gradeDistribution.map(({ grade, total, sent, percentage }) => (
          <ProgressBar
            key={grade}
            label={grade}
            value={sent}
            max={total}
            color={percentage === 100 ? '#10b981' : percentage > 50 ? '#f59e0b' : '#ef4444'}
          />
        ))}
      </View>

      {/* סטטיסטיקות מתקדמות */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>סטטיסטיקות</Text>
        <View style={styles.advancedStats}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>אחוז הצלחה כללי:</Text>
            <Text style={[styles.statNumber, { color: '#10b981' }]}>
              {stats.successRate.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>סה״כ ניסיונות:</Text>
            <Text style={styles.statNumber}>{stats.totalAttempts}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>ממוצע ניסיונות למסלול:</Text>
            <Text style={styles.statNumber}>
              {stats.sentRoutes > 0 ? (stats.totalAttempts / stats.sentRoutes).toFixed(1) : '0'}
            </Text>
          </View>
        </View>
      </View>

      {/* סטטוס נוכחי */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>מצב נוכחי</Text>
        <View style={styles.currentStatus}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.statusText}>לא שלח: {myProgress.unsent}</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.statusText}>פרויקט: {myProgress.project}</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statusText}>שלח: {myProgress.sent}</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.statusText}>פלאש: {myProgress.flashed}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    flex: 1,
    minWidth: (SCREEN_WIDTH - 48) / 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
  },
  advancedStats: {
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#374151',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  currentStatus: {
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
  },
});
