/**
 * @fileoverview Competition Registration Screen
 * @description Self-registration screen for Totemtition and National League format competitions
 * Allows users to register themselves and view their registration status
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/features/language';
import { useCompetition } from '@/features/competitions/hooks/useCompetition';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { Participant, Gender, SkillLevel } from '@/features/competitions/types';

export default function CompetitionRegistrationScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const { user } = useAuth();

  const { competition, loading: competitionLoading } = useCompetition(competitionId);
  
  const [registration, setRegistration] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form fields
  const [phone, setPhone] = useState('');
  const [selectedGender, setSelectedGender] = useState<Gender | ''>('');
  const [birthYear, setBirthYear] = useState('');
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<SkillLevel | ''>('');
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');

  const isNationalLeague = !!competition?.settings?.nationalLeague;

  // Category is auto-assigned from gender + birth year — no manual selection.
  const matchedCategory = useMemo(() => {
    if (!competition?.categories || competition.categories.length === 0) return null;
    if (!selectedGender && !birthYear) return null;
    const by = birthYear ? parseInt(birthYear, 10) : undefined;
    return ParticipantService.findMatchingCategory(competition.categories, {
      gender: selectedGender || undefined,
      birthYear: by && !isNaN(by) ? by : undefined,
    });
  }, [competition?.categories, selectedGender, birthYear]);

  const styles = createStyles(theme);

  // Check existing registration
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user) return;
      
      try {
        const existing = await ParticipantService.getParticipantByUserId(
          competitionId,
          user.uid
        );
        setRegistration(existing);
      } catch (error) {
        console.error('Error checking registration:', error);
      } finally {
        setLoading(false);
      }
    };

    checkRegistration();
  }, [competitionId, user]);

  const handleRegister = async () => {
    if (!user) {
      Alert.alert(t.common.error, t.competitionExt.mustLoginToRegister);
      return;
    }

    if (!competition) return;

    // Gender and birth year are always required for category assignment
    if (!selectedGender) {
      Alert.alert(t.common.error, t.competitionExt.mustSelectGender);
      return;
    }
    if (!birthYear) {
      Alert.alert(t.common.error, t.competitionExt.mustEnterBirthYear);
      return;
    }
    const birthYearNum = parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(birthYearNum) || birthYearNum < 1920 || birthYearNum > currentYear) {
      Alert.alert(t.common.error, t.competitionExt.invalidBirthYear);
      return;
    }
    if (isNationalLeague) {
      if (!fullName.trim()) {
        Alert.alert(t.common.error, t.competitionExt.mustEnterFullName);
        return;
      }
      if (idNumber.trim().length < 5) {
        Alert.alert(t.common.error, t.competitionExt.mustEnterIdNumber);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const birthYearNum = birthYear ? parseInt(birthYear, 10) : undefined;
      
      const participantId = await ParticipantService.selfRegister(
        competitionId,
        user.uid,
        {
          displayName: isNationalLeague
            ? fullName.trim()
            : (user.displayName || t.competitionExt.defaultParticipantName),
          email: user.email || undefined,
          phone: phone || undefined,
          photoURL: user.photoURL || undefined,
          gender: selectedGender || undefined,
          birthYear: birthYearNum,
          skillLevel: selectedSkillLevel || undefined,
          idNumber: isNationalLeague ? idNumber.trim() : undefined,
          category: matchedCategory?.id || undefined,
          categoryName: matchedCategory?.name,
        }
      );

      // Refresh registration status to show correct UI (approved vs pending)
      const updated = await ParticipantService.getParticipantByUserId(competitionId, user.uid);
      if (updated) {
        setRegistration(updated);
      }

      const isAutoApproved = competition.settings?.registrationMode === 'openRegistration';
      Alert.alert(
        t.competitionExt.registerSuccess,
        isAutoApproved
          ? (t.competitionExt.registerApprovedMessage || t.competitionExt.registerSuccessMessage)
          : t.competitionExt.registerSuccessMessage,
      );
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.competitionExt.cannotRegister);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!user || !registration) return;

    Alert.alert(
      t.competitionExt.cancelRegistration,
      t.competitionExt.cancelRegistrationConfirm,
      [
        { text: t.common.no, style: 'cancel' },
        {
          text: t.competitionExt.yesCancelRegistration,
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await ParticipantService.cancelOwnRegistration(
                competitionId,
                registration.id,
                user.uid
              );
              setRegistration(null);
              Alert.alert(t.competitionExt.registrationCancelled);
            } catch (error: any) {
              Alert.alert(t.common.error, error.message || t.competitionExt.cannotCancelRegistration);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading || competitionLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t.competitionExt.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!competition) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>{t.competitionExt.competitionNotFound}</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>{t.competitionExt.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isRegistrationOpen = competition.registrationStatus === 'open';

  // Render based on registration status
  const renderContent = () => {
    if (registration) {
      // User already registered - show status
      return (
        <View style={styles.statusContainer}>
          {registration.status === 'pending_approval' && (
            <>
              <View style={[styles.statusBadge, styles.statusPending]}>
                <Ionicons name="time" size={48} color="#f39c12" />
              </View>
              <Text style={styles.statusTitle}>{t.competitionExt.pendingApproval}</Text>
              <Text style={styles.statusSubtitle}>
                {t.competitionExt.pendingApprovalMessage}
              </Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancelRegistration}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#e74c3c" />
                ) : (
                  <Text style={styles.cancelBtnText}>{t.competitionExt.cancelRegistration}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {registration.status === 'approved' && (
            <>
              <View style={[styles.statusBadge, styles.statusApproved]}>
                <Ionicons name="checkmark-circle" size={48} color="#27ae60" />
              </View>
              <Text style={styles.statusTitle}>{t.competitionExt.registrationApproved}</Text>
              <Text style={styles.statusSubtitle}>
                {t.competitionExt.registrationApprovedMessage}
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('JudgeEntry', { competitionId })}
              >
                <Text style={styles.primaryBtnText}>{t.competitionExt.enterResults}</Text>
              </TouchableOpacity>
            </>
          )}

          {registration.status === 'rejected' && (
            <>
              <View style={[styles.statusBadge, styles.statusRejected]}>
                <Ionicons name="close-circle" size={48} color="#e74c3c" />
              </View>
              <Text style={styles.statusTitle}>{t.competitionExt.registrationRejected}</Text>
              <Text style={styles.statusSubtitle}>
                {t.competitionExt.registrationRejectedMessage}
              </Text>
            </>
          )}

          {registration.status === 'cancelled' && (
            <>
              <View style={[styles.statusBadge, styles.statusCancelled]}>
                <Ionicons name="ban" size={48} color="#95a5a6" />
              </View>
              <Text style={styles.statusTitle}>{t.competitionExt.registrationCancelledStatus}</Text>
              <Text style={styles.statusSubtitle}>
                {t.competitionExt.registrationCancelledMessage}
              </Text>
            </>
          )}
        </View>
      );
    }

    // Not registered yet
    if (!isRegistrationOpen) {
      return (
        <View style={styles.statusContainer}>
          <Ionicons name="lock-closed" size={64} color={theme.textSecondary} />
          <Text style={styles.statusTitle}>{t.competitionExt.registrationClosed}</Text>
          <Text style={styles.statusSubtitle}>
            {t.competitionExt.registrationClosedMessage}
          </Text>
        </View>
      );
    }

    // Registration form
    return (
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>{t.competitionExt.registrationForm}</Text>
        <Text style={styles.formSubtitle}>{competition.name}</Text>

        {/* User Info (read-only) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{t.competitionExt.name}</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{user?.displayName || t.competitionExt.notAvailable}</Text>
          </View>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{t.competitionExt.email}</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{user?.email || t.competitionExt.notAvailable}</Text>
          </View>
        </View>

        {/* Phone (optional) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{t.competitionExt.phone}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="050-1234567"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Gender Selection (required for category assignment) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{t.competitionExt.gender} *</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  selectedGender === 'male' && styles.genderOptionSelected,
                ]}
                onPress={() => setSelectedGender('male')}
              >
                <Ionicons 
                  name="male" 
                  size={24} 
                  color={selectedGender === 'male' ? '#fff' : theme.text} 
                />
                <Text style={[
                  styles.genderOptionText,
                  selectedGender === 'male' && styles.genderOptionTextSelected,
                ]}>
                  {t.competitionExt.male}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  selectedGender === 'female' && styles.genderOptionSelected,
                ]}
                onPress={() => setSelectedGender('female')}
              >
                <Ionicons 
                  name="female" 
                  size={24} 
                  color={selectedGender === 'female' ? '#fff' : theme.text} 
                />
                <Text style={[
                  styles.genderOptionText,
                  selectedGender === 'female' && styles.genderOptionTextSelected,
                ]}>
                  {t.competitionExt.female}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* Birth Year (required for category assignment) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{t.competitionExt.birthYear} *</Text>
            <TextInput
              style={styles.input}
              value={birthYear}
              onChangeText={setBirthYear}
              placeholder={t.competitionExt.birthYearPlaceholder}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

        {/* National league: full name + ID number (required) */}
        {isNationalLeague && (
          <>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>{t.competitionExt.fullNameLabel} *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t.competitionExt.fullNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
                textAlign="right"
              />
            </View>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>{t.competitionExt.idNumberLabel} *</Text>
              <TextInput
                style={styles.input}
                value={idNumber}
                onChangeText={(v) => setIdNumber(v.replace(/[^0-9]/g, ''))}
                placeholder={t.competitionExt.idNumberPlaceholder}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={9}
              />
            </View>
          </>
        )}

        {/* Skill Level Selection — only when a category actually uses skill levels */}
        {competition.categories?.some((c) => c.skillLevels && c.skillLevels.length > 0) && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{t.competitionExt.skillLevel}</Text>
            <View style={styles.skillLevelContainer}>
              {(['beginner', 'intermediate', 'advanced', 'pro'] as const).map((level) => {
                const labels: Record<SkillLevel, string> = {
                  beginner: t.competitionExt.beginner,
                  intermediate: t.competitionExt.intermediate,
                  advanced: t.competitionExt.advanced,
                  pro: t.competitionExt.pro,
                };
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.skillOption,
                      selectedSkillLevel === level && styles.skillOptionSelected,
                    ]}
                    onPress={() => setSelectedSkillLevel(selectedSkillLevel === level ? '' : level)}
                  >
                    <Text style={[
                      styles.skillOptionText,
                      selectedSkillLevel === level && styles.skillOptionTextSelected,
                    ]}>
                      {labels[level]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Category — auto-assigned by gender + age */}
        {competition.categories && competition.categories.length > 0 && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{t.competitionExt.category}</Text>
            <View style={styles.assignedCategoryBox}>
              <Ionicons
                name={matchedCategory ? 'checkmark-circle' : 'alert-circle-outline'}
                size={20}
                color={matchedCategory ? theme.primary : theme.textSecondary}
              />
              <Text style={styles.assignedCategoryText}>
                {matchedCategory ? matchedCategory.name : t.competitionExt.noMatchingCategory}
              </Text>
            </View>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={theme.primary} />
          <Text style={styles.infoText}>
            לאחר ההרשמה, הבקשה תישלח לאישור. תוכל להזין תוצאות רק לאחר תחילת התחרות.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleRegister}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>{t.competitionExt.register}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.competitionExt.registrationForm}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {renderContent()}
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
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
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
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    placeholder: {
      width: 40,
    },
    scrollContent: {
      flex: 1,
    },
    scrollContentContainer: {
      padding: 20,
    },
    // Status container (for existing registration)
    statusContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    statusBadge: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    statusPending: {
      backgroundColor: '#fef3cd',
    },
    statusApproved: {
      backgroundColor: '#d4edda',
    },
    statusRejected: {
      backgroundColor: '#f8d7da',
    },
    statusCancelled: {
      backgroundColor: '#e9ecef',
    },
    statusTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 8,
    },
    statusSubtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    // Form styles
    formContainer: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
    },
    formTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    formSubtitle: {
      fontSize: 16,
      color: theme.primary,
      textAlign: 'center',
      marginBottom: 24,
    },
    inputSection: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
    },
    readOnlyInput: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      opacity: 0.7,
    },
    readOnlyText: {
      fontSize: 16,
      color: theme.text,
    },
    assignedCategoryBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 14,
    },
    assignedCategoryText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    categoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryOption: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.card,
      marginBottom: 8,
    },
    categoryOptionSelected: {
      backgroundColor: theme.primary,
    },
    categoryOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    categoryOptionTextSelected: {
      color: '#fff',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.primary + '15',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    submitBtn: {
      backgroundColor: theme.buttonPrimary,
      paddingVertical: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    cancelBtn: {
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: '#e74c3c',
      borderRadius: 8,
    },
    cancelBtnText: {
      color: '#e74c3c',
      fontSize: 14,
      fontWeight: '600',
    },
    primaryBtn: {
      marginTop: 24,
      backgroundColor: theme.buttonPrimary,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 10,
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    backBtn: {
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: theme.buttonPrimary,
      borderRadius: 8,
    },
    backBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Gender selection styles
    genderContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    genderOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.card,
      gap: 8,
    },
    genderOptionSelected: {
      backgroundColor: theme.primary,
    },
    genderOptionText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    genderOptionTextSelected: {
      color: '#fff',
    },
    // Skill level styles
    skillLevelContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    skillOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.card,
    },
    skillOptionSelected: {
      backgroundColor: theme.primary,
    },
    skillOptionText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    skillOptionTextSelected: {
      color: '#fff',
    },
  });
