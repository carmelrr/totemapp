/**
 * @fileoverview Active Competition Banner Component
 * @description Shows active competition info on the leaderboard screen
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useAuth } from '@/context/AuthContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import { Competition } from '@/features/competitions/types';
import { useCompetitionTimer } from '@/features/competitions/hooks/useCompetition';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { COMPETITION_FORMAT_INFO } from '@/features/competitions/constants';

interface ActiveCompetitionBannerProps {
  competition: Competition;
  onPress?: () => void;
  onEnterResults?: () => void;
}

export function ActiveCompetitionBanner({
  competition,
  onPress,
  onEnterResults,
}: ActiveCompetitionBannerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const rolesContext = useRolesContext();
  const timer = useCompetitionTimer(competition);
  const formatInfo = COMPETITION_FORMAT_INFO[competition.format];
  
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  
  const styles = createStyles(theme);
  
  // Check if user is registered - applies to Totemtition and National League formats
  const isTotemtition = competition.format === 'totemtition';
  const isNationalLeague = competition.format === 'national_league';
  const supportsRegistration = isTotemtition || isNationalLeague;
  
  // Check if user is a judge (global role) - can enter results for National League
  const isJudge = rolesContext.canEnterResults;
  
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user || !supportsRegistration) {
        setLoading(false);
        return;
      }

      try {
        const participant = await ParticipantService.getParticipantByUserId(
          competition.id,
          user.uid
        );
        setIsRegistered(!!participant);
        setIsApproved(participant?.status === 'approved');
      } catch (error) {
        console.error('Error checking registration:', error);
      } finally {
        setLoading(false);
      }
    };

    checkRegistration();
  }, [competition.id, user, isTotemtition]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.liveIndicator}>{t.competition.activeCompetition}</Text>
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>⏱️ {t.competition.remaining}</Text>
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
        
        {/* Show registration status for Totemtition and National League */}
        {supportsRegistration && !loading && isRegistered && (
          <View style={[styles.registeredBadge, isApproved && styles.approvedBadge]}>
            <Ionicons 
              name={isApproved ? "checkmark-circle" : "time"} 
              size={14} 
              color="#fff" 
            />
            <Text style={styles.registeredBadgeText}>
              {isApproved ? t.competitionExt.registeredParticipant : t.competitionExt.waitingForApproval}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {/* Show Enter Results button:
            - Totemtition: approved participants can self-report
            - National League: judges (global role) can enter results */}
        {onEnterResults && (
          (isTotemtition && isApproved) || 
          (isNationalLeague && isJudge)
        ) && (
          <TouchableOpacity 
            style={styles.enterResultsButton} 
            onPress={onEnterResults}
          >
            <Ionicons name="create" size={18} color="#fff" />
            <Text style={styles.enterResultsButtonText}>{t.competitionExt.enterResultsAction}</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.viewButton} onPress={onPress}>
          <Text style={styles.viewButtonText}>{t.competition.viewLeaderboard}</Text>
        </TouchableOpacity>
      </View>
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
    registeredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f39c12',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginTop: 8,
      gap: 4,
    },
    approvedBadge: {
      backgroundColor: '#27ae60',
    },
    registeredBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 8,
    },
    enterResultsButton: {
      backgroundColor: '#27ae60',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    enterResultsButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
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
