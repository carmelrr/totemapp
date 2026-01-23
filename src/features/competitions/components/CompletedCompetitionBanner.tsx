/**
 * @fileoverview Completed Competition Banner Component
 * @description Shows completed competitions with visible results on the leaderboard screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { Competition } from '@/features/competitions/types';
import { COMPETITION_FORMAT_INFO } from '@/features/competitions/constants';

interface CompletedCompetitionBannerProps {
  competition: Competition;
  onPress?: () => void;
}

export function CompletedCompetitionBanner({
  competition,
  onPress,
}: CompletedCompetitionBannerProps) {
  const { theme } = useTheme();
  const formatInfo = COMPETITION_FORMAT_INFO[competition.format];
  
  const styles = createStyles(theme);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.completedBadge}>
          <Ionicons name="trophy" size={14} color="#fff" />
          <Text style={styles.completedText}>תחרות הסתיימה</Text>
        </View>
        <View style={styles.resultsAvailableBadge}>
          <Ionicons name="eye" size={12} color="#fff" />
          <Text style={styles.resultsAvailableText}>תוצאות זמינות</Text>
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
        <Ionicons name="podium" size={18} color="#fff" />
        <Text style={styles.viewButtonText}>צפה בתוצאות</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.isDark ? '#1a3d2d' : '#e6fff0',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 15,
      marginVertical: 10,
      borderWidth: 2,
      borderColor: '#27ae60',
      shadowColor: '#27ae60',
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
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#27ae60',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    completedText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#fff',
    },
    resultsAvailableBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#3498db',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      gap: 4,
    },
    resultsAvailableText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fff',
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
      backgroundColor: '#27ae60',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 6,
    },
    viewButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
  });
