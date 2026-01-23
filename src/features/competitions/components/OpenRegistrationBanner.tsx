/**
 * @fileoverview Open Registration Banner Component
 * @description Shows competitions that are open for registration
 * This allows regular users to see and register for competitions before they start
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
import { Competition } from '@/features/competitions/types';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { COMPETITION_FORMAT_INFO } from '@/features/competitions/constants';

interface OpenRegistrationBannerProps {
  competition: Competition;
  onRegisterPress?: () => void;
}

export function OpenRegistrationBanner({
  competition,
  onRegisterPress,
}: OpenRegistrationBannerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const formatInfo = COMPETITION_FORMAT_INFO[competition.format];
  
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = createStyles(theme);

  // Check if user is already registered
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const participant = await ParticipantService.getParticipantByUserId(
          competition.id,
          user.uid
        );
        setIsRegistered(!!participant);
        setRegistrationStatus(participant?.status || null);
      } catch (error) {
        console.error('Error checking registration:', error);
        setIsRegistered(false);
      } finally {
        setLoading(false);
      }
    };

    checkRegistration();
  }, [competition.id, user]);

  // Format the start date
  const startDate = competition.startDate.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const getStatusBadge = () => {
    if (!isRegistered) return null;

    const statusLabels: Record<string, { text: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
      pending_approval: { text: 'ממתין לאישור', color: '#f39c12', icon: 'time' },
      approved: { text: 'רשום ומאושר ✓', color: '#27ae60', icon: 'checkmark-circle' },
      rejected: { text: 'נדחה', color: '#e74c3c', icon: 'close-circle' },
    };

    const status = statusLabels[registrationStatus || ''] || statusLabels.pending_approval;

    return (
      <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
        <Ionicons name={status.icon} size={14} color="#fff" />
        <Text style={styles.statusBadgeText}>{status.text}</Text>
      </View>
    );
  };

  // If user is registered and approved, show a "registered successfully" banner
  const isApprovedParticipant = isRegistered && registrationStatus === 'approved';

  return (
    <TouchableOpacity
      style={[
        styles.container, 
        isApprovedParticipant && styles.containerRegistered
      ]}
      onPress={onRegisterPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[
          styles.registrationBadge,
          isApprovedParticipant && styles.registrationBadgeApproved
        ]}>
          <Ionicons 
            name={isApprovedParticipant ? "checkmark-circle" : "person-add"} 
            size={16} 
            color="#27ae60" 
          />
          <Text style={styles.registrationText}>
            {isApprovedParticipant ? 'נרשמת בהצלחה!' : 'הרשמה פתוחה!'}
          </Text>
        </View>
        <View style={styles.startDateContainer}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.startDateText}>
            מתחילה: {startDate}
          </Text>
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
        
        {competition.description && (
          <Text style={styles.description} numberOfLines={2}>
            {competition.description}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : isApprovedParticipant ? (
          <View style={styles.approvedContainer}>
            <View style={styles.approvedMessage}>
              <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
              <Text style={styles.approvedMessageText}>
                התחרות עדיין לא התחילה - נודיע לך כשתתחיל!
              </Text>
            </View>
          </View>
        ) : isRegistered ? (
          <View style={styles.registeredContainer}>
            {getStatusBadge()}
            <TouchableOpacity style={styles.viewDetailsButton} onPress={onRegisterPress}>
              <Text style={styles.viewDetailsButtonText}>צפה בפרטים</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.registerButton} onPress={onRegisterPress}>
            <Ionicons name="person-add" size={18} color="#fff" />
            <Text style={styles.registerButtonText}>הירשם עכשיו</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.isDark ? '#1a3d2a' : '#e8f5e9',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 15,
      marginVertical: 10,
      borderWidth: 2,
      borderColor: '#27ae60',
      shadowColor: '#27ae60',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    registrationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(39, 174, 96, 0.3)' : 'rgba(39, 174, 96, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    registrationText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#27ae60',
    },
    startDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    startDateText: {
      fontSize: 12,
      color: theme.textSecondary,
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
      marginBottom: 8,
    },
    formatIcon: {
      fontSize: 14,
      marginLeft: 4,
    },
    formatLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    description: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'right',
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      paddingTop: 12,
    },
    registeredContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    statusBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    viewDetailsButton: {
      backgroundColor: theme.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    viewDetailsButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    registerButton: {
      backgroundColor: '#27ae60',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    registerButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    containerRegistered: {
      // Slightly different background for registered users
      backgroundColor: theme.isDark ? '#1a3d2a' : '#e0f7e0',
    },
    registrationBadgeApproved: {
      backgroundColor: theme.isDark ? 'rgba(39, 174, 96, 0.5)' : 'rgba(39, 174, 96, 0.25)',
    },
    approvedContainer: {
      alignItems: 'center',
    },
    approvedMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
    },
    approvedMessageText: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });
