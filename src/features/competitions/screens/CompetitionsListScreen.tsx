/**
 * @fileoverview Competitions List Screen (Admin)
 * @description Shows all competitions with admin controls
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAdmin } from '@/context/AdminContext';
import { useAllCompetitions } from '@/features/competitions/hooks/useCompetition';
import { Competition } from '@/features/competitions/types';
import { CompetitionService } from '@/features/competitions/services/CompetitionService';
import {
  COMPETITION_STATUS_INFO,
  COMPETITION_FORMAT_INFO,
} from '@/features/competitions/constants';

export default function CompetitionsListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { isAdmin } = useAdmin();
  const { competitions, loading, refresh } = useAllCompetitions();
  const [refreshing, setRefreshing] = useState(false);

  const styles = createStyles(theme);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleCreateCompetition = () => {
    navigation.navigate('CreateCompetition');
  };

  const handleCompetitionPress = (competition: Competition) => {
    navigation.navigate('ManageCompetition', { competitionId: competition.id });
  };

  const handleDeleteCompetition = (competition: Competition) => {
    Alert.alert(
      'מחיקת תחרות',
      `האם אתה בטוח שברצונך למחוק את "${competition.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await CompetitionService.deleteCompetition(competition.id);
              refresh();
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן למחוק את התחרות');
            }
          },
        },
      ]
    );
  };

  const renderCompetitionCard = ({ item }: { item: Competition }) => {
    const statusInfo = COMPETITION_STATUS_INFO[item.status];
    const formatInfo = COMPETITION_FORMAT_INFO[item.format];

    const startDate = item.startDate.toLocaleDateString('he-IL');
    const endDate = item.endDate.toLocaleDateString('he-IL');

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleCompetitionPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
              <Text style={styles.statusText}>
                {statusInfo.icon} {statusInfo.label}
              </Text>
            </View>
          </View>
          
          {isAdmin && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteCompetition(item)}
            >
              <Ionicons name="trash-outline" size={20} color={theme.error || '#e74c3c'} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.formatBadge}>
            <Text style={styles.formatText}>
              {formatInfo.icon} {formatInfo.label}
            </Text>
          </View>

          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.dateText}>
              {startDate} - {endDate}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.settings.maxRoutes}</Text>
              <Text style={styles.statLabel}>מסלולים</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>TOP{item.settings.topRoutesForScoring}</Text>
              <Text style={styles.statLabel}>ניקוד</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCompetitionPress(item)}
          >
            <Text style={styles.actionButtonText}>ניהול →</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && competitions.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>טוען תחרויות...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>🏆 ניהול תחרויות</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Create Button */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateCompetition}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.createButtonText}>יצירת תחרות חדשה</Text>
        </TouchableOpacity>
      )}

      {/* Competitions List */}
      <FlatList
        data={competitions}
        keyExtractor={(item) => item.id}
        renderItem={renderCompetitionCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyText}>אין תחרויות עדיין</Text>
            <Text style={styles.emptySubtext}>
              לחץ על "יצירת תחרות חדשה" להתחיל
            </Text>
          </View>
        }
      />
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
    },
    placeholder: {
      width: 32,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    createButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      marginBottom: 16,
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    titleContainer: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'right',
      marginBottom: 8,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    deleteButton: {
      padding: 8,
    },
    cardContent: {
      padding: 16,
    },
    formatBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginBottom: 12,
    },
    formatText: {
      fontSize: 13,
      color: theme.text,
    },
    dateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
    },
    dateText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: 24,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    cardFooter: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 12,
      alignItems: 'flex-end',
    },
    actionButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
    },
  });
