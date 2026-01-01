/**
 * @fileoverview Active Competition Banner Component
 * @description Shows active competition info on the leaderboard screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import { Competition } from '@/features/competitions/types';
import { useCompetitionTimer } from '@/features/competitions/hooks/useCompetition';
import { COMPETITION_FORMAT_INFO } from '@/features/competitions/constants';

interface ActiveCompetitionBannerProps {
  competition: Competition;
  onPress?: () => void;
}

export function ActiveCompetitionBanner({
  competition,
  onPress,
}: ActiveCompetitionBannerProps) {
  const { theme } = useTheme();
  const timer = useCompetitionTimer(competition);
  const formatInfo = COMPETITION_FORMAT_INFO[competition.format];
  
  const styles = createStyles(theme);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.liveIndicator}>🔥 תחרות פעילה!</Text>
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>⏱️ נותר:</Text>
          <Text style={styles.timerValue}>{timer.formatted}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.competitionName}>{competition.name}</Text>
        <View style={styles.formatBadge}>
          <Text style={styles.formatIcon}>{formatInfo?.icon || '🏆'}</Text>
          <Text style={styles.formatLabel}>
            {formatInfo?.label || competition.format}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.viewButton} onPress={onPress}>
        <Text style={styles.viewButtonText}>הצג לידרבורד →</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.isDark ? '#2d1f3d' : '#f0e6ff',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 15,
      marginVertical: 10,
      borderWidth: 2,
      borderColor: theme.secondary || '#9b59b6',
      shadowColor: theme.secondary || '#9b59b6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    liveIndicator: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e74c3c',
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    timerLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginRight: 4,
    },
    timerValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text,
      fontFamily: 'monospace',
    },
    content: {
      alignItems: 'flex-end',
      marginBottom: 12,
    },
    competitionName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'right',
      marginBottom: 8,
    },
    formatBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    formatIcon: {
      fontSize: 14,
      marginLeft: 4,
    },
    formatLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    viewButton: {
      backgroundColor: theme.secondary || '#9b59b6',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      alignItems: 'center',
    },
    viewButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
  });

export default ActiveCompetitionBanner;
