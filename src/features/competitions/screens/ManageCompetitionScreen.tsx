/**
 * @fileoverview Manage Competition Screen (Admin)
 * @description Detailed competition management with tabs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAdmin } from '@/context/AdminContext';
import {
  useCompetition,
  useParticipants,
  useJudges,
  useCompetitionLeaderboard,
} from '@/features/competitions/hooks/useCompetition';
import { CompetitionService } from '@/features/competitions/services/CompetitionService';
import { CompetitionStatus } from '@/features/competitions/types';
import {
  COMPETITION_STATUS_INFO,
  COMPETITION_FORMAT_INFO,
} from '@/features/competitions/constants';

type TabType = 'overview' | 'participants' | 'judges' | 'leaderboard';

export default function ManageCompetitionScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const { isAdmin } = useAdmin();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isUpdating, setIsUpdating] = useState(false);

  const { competition, loading } = useCompetition(competitionId);
  const { participants, loading: participantsLoading } = useParticipants(competitionId);
  const { judges, loading: judgesLoading } = useJudges(competitionId);
  const { entries: leaderboard, loading: leaderboardLoading } = useCompetitionLeaderboard(competitionId);

  const styles = createStyles(theme);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>טוען תחרות...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!competition) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>התחרות לא נמצאה</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = COMPETITION_STATUS_INFO[competition.status];
  const formatInfo = COMPETITION_FORMAT_INFO[competition.format];

  const handleStatusChange = async (newStatus: CompetitionStatus) => {
    const statusLabels: Record<CompetitionStatus, string> = {
      draft: 'טיוטה',
      upcoming: 'פתוחה להרשמה',
      active: 'פעילה',
      closed: 'סגורה',
      completed: 'הסתיימה',
      cancelled: 'בוטלה',
    };

    Alert.alert(
      'שינוי סטטוס',
      `לשנות את הסטטוס ל"${statusLabels[newStatus]}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await CompetitionService.updateCompetitionStatus(competitionId, newStatus);
              Alert.alert('הצלחה', 'הסטטוס עודכן בהצלחה');
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן לעדכן את הסטטוס');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>סטטוס תחרות</Text>
        
        <View style={styles.statusRow}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
            <Text style={styles.statusLabel}>{statusInfo.label}</Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.statusActions}>
            {competition.status === 'draft' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#27ae60' }]}
                onPress={() => handleStatusChange('upcoming')}
              >
                <Text style={styles.actionBtnText}>פתח להרשמה</Text>
              </TouchableOpacity>
            )}
            {competition.status === 'upcoming' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#3498db' }]}
                onPress={() => handleStatusChange('active')}
              >
                <Text style={styles.actionBtnText}>התחל תחרות</Text>
              </TouchableOpacity>
            )}
            {competition.status === 'active' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#9b59b6' }]}
                onPress={() => handleStatusChange('completed')}
              >
                <Text style={styles.actionBtnText}>סיים תחרות</Text>
              </TouchableOpacity>
            )}
            {competition.status !== 'cancelled' && competition.status !== 'completed' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#e74c3c' }]}
                onPress={() => handleStatusChange('cancelled')}
              >
                <Text style={styles.actionBtnText}>בטל תחרות</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>פרטי תחרות</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>פורמט:</Text>
          <Text style={styles.infoValue}>{formatInfo.icon} {formatInfo.label}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>תאריך התחלה:</Text>
          <Text style={styles.infoValue}>
            {competition.startDate.toLocaleDateString('he-IL')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>תאריך סיום:</Text>
          <Text style={styles.infoValue}>
            {competition.endDate.toLocaleDateString('he-IL')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>מסלולים:</Text>
          <Text style={styles.infoValue}>{competition.settings.maxRoutes}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>TOP לניקוד:</Text>
          <Text style={styles.infoValue}>TOP{competition.settings.topRoutesForScoring}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>קנס ניסיון:</Text>
          <Text style={styles.infoValue}>{competition.settings.attemptPenalty} נקודות</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{participants.length}</Text>
          <Text style={styles.statLabel}>משתתפים</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{judges.length}</Text>
          <Text style={styles.statLabel}>שופטים</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('ManageParticipants', { competitionId })}
        >
          <Ionicons name="people" size={28} color={theme.primary} />
          <Text style={styles.quickActionText}>ניהול משתתפים</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('ManageJudges', { competitionId })}
        >
          <Ionicons name="shield-checkmark" size={28} color={theme.primary} />
          <Text style={styles.quickActionText}>ניהול שופטים</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('ManageCompetitionRoutes', { competitionId })}
        >
          <Ionicons name="map" size={28} color={theme.primary} />
          <Text style={styles.quickActionText}>מסלולי תחרות</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('JudgeEntry', { competitionId })}
        >
          <Ionicons name="create" size={28} color={theme.primary} />
          <Text style={styles.quickActionText}>הזנת תוצאות</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderParticipantsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('ManageParticipants', { competitionId })}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>הוסף משתתפים</Text>
      </TouchableOpacity>

      {participantsLoading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : participants.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyText}>אין משתתפים עדיין</Text>
        </View>
      ) : (
        participants.slice(0, 10).map((p) => (
          <View key={p.id} style={styles.listItem}>
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{p.userName}</Text>
              <Text style={styles.listItemSubtitle}>
                {p.category ? `קטגוריה: ${p.category}` : 'ללא קטגוריה'}
              </Text>
            </View>
            <View style={[
              styles.statusDot,
              { backgroundColor: p.status === 'approved' ? '#27ae60' : '#f39c12' }
            ]} />
          </View>
        ))
      )}

      {participants.length > 10 && (
        <TouchableOpacity
          style={styles.viewAllBtn}
          onPress={() => navigation.navigate('ManageParticipants', { competitionId })}
        >
          <Text style={styles.viewAllText}>צפה בכל {participants.length} המשתתפים →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderJudgesTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('ManageJudges', { competitionId })}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>הוסף שופטים</Text>
      </TouchableOpacity>

      {judgesLoading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : judges.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyText}>אין שופטים עדיין</Text>
        </View>
      ) : (
        judges.map((j) => (
          <View key={j.id} style={styles.listItem}>
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{j.userName}</Text>
              <Text style={styles.listItemSubtitle}>
                {j.role === 'head_judge' ? '🏅 שופט ראשי' : '👨‍⚖️ שופט'}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderLeaderboardTab = () => (
    <View style={styles.tabContent}>
      {leaderboardLoading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyText}>אין תוצאות עדיין</Text>
        </View>
      ) : (
        leaderboard.slice(0, 10).map((entry, index) => (
          <View key={entry.participantId} style={styles.leaderboardItem}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.leaderboardContent}>
              <Text style={styles.leaderboardName}>{entry.userName}</Text>
              <Text style={styles.leaderboardDetails}>
                {entry.routesCompleted} מסלולים • סה"כ {entry.totalAttempts} ניסיונות
              </Text>
            </View>
            <Text style={styles.leaderboardPoints}>{entry.totalPoints}</Text>
          </View>
        ))
      )}
    </View>
  );

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'overview', label: 'סקירה', icon: 'home' },
    { key: 'participants', label: 'משתתפים', icon: 'people' },
    { key: 'judges', label: 'שופטים', icon: 'shield-checkmark' },
    { key: 'leaderboard', label: 'דירוג', icon: 'trophy' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {competition.name}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? theme.primary : theme.textSecondary}
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.scrollContent}>
        {isUpdating && (
          <View style={styles.updatingOverlay}>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.updatingText}>מעדכן...</Text>
          </View>
        )}
        
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'participants' && renderParticipantsTab()}
        {activeTab === 'judges' && renderJudgesTab()}
        {activeTab === 'leaderboard' && renderLeaderboardTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 18,
      color: theme.text,
      marginTop: 16,
    },
    backBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 24,
    },
    backBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      flex: 1,
      textAlign: 'center',
    },
    placeholder: {
      width: 32,
    },
    tabsContainer: {
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabsContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.background,
      gap: 6,
    },
    tabActive: {
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
    },
    tabText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    scrollContent: {
      flex: 1,
    },
    tabContent: {
      padding: 16,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'right',
      marginBottom: 16,
    },
    statusRow: {
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    statusBadgeLarge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 8,
    },
    statusIcon: {
      fontSize: 18,
    },
    statusLabel: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    statusActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    actionBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: 'bold',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    quickActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickAction: {
      width: '48%',
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    quickActionText: {
      fontSize: 13,
      color: theme.text,
      textAlign: 'center',
      marginTop: 8,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
      marginBottom: 16,
    },
    addButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 12,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    listItemContent: {
      flex: 1,
    },
    listItemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'right',
    },
    listItemSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 2,
    },
    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    viewAllBtn: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    viewAllText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    leaderboardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    rankBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
    rankText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    leaderboardContent: {
      flex: 1,
    },
    leaderboardName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'right',
    },
    leaderboardDetails: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 2,
    },
    leaderboardPoints: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.primary,
    },
    updatingOverlay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      margin: 16,
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    updatingText: {
      fontSize: 14,
      color: theme.text,
    },
  });
