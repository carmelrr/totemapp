/**
 * @fileoverview Create Competition Screen (Admin)
 * @description Form for creating a new competition
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
// Note: DateTimePicker requires: npm install @react-native-community/datetimepicker
// For now, using simple date selection
import { useTheme } from '@/features/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { CompetitionService } from '@/features/competitions/services/CompetitionService';
import { CompetitionFormat } from '@/features/competitions/types';
import {
  NATIONAL_LEAGUE_SETTINGS,
  TOTEMTITION_SETTINGS,
  COMPETITION_FORMAT_INFO,
} from '@/features/competitions/constants';

export default function CreateCompetitionScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<CompetitionFormat>('national_league');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // +7 days
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Advanced settings
  const [maxRoutes, setMaxRoutes] = useState('30');
  const [topRoutes, setTopRoutes] = useState('7');
  const [attemptPenalty, setAttemptPenalty] = useState('10');
  const [maxAttempts, setMaxAttempts] = useState('10');
  const [enableCategories, setEnableCategories] = useState(true);

  const styles = createStyles(theme);

  const handleFormatChange = (newFormat: CompetitionFormat) => {
    setFormat(newFormat);
    
    // Set default settings based on format
    if (newFormat === 'national_league') {
      setMaxRoutes(String(NATIONAL_LEAGUE_SETTINGS.maxRoutes));
      setTopRoutes(String(NATIONAL_LEAGUE_SETTINGS.topRoutesForScoring));
      setAttemptPenalty(String(NATIONAL_LEAGUE_SETTINGS.attemptPenalty));
      setMaxAttempts(String(NATIONAL_LEAGUE_SETTINGS.maxAttempts));
    } else {
      setMaxRoutes(String(TOTEMTITION_SETTINGS.maxRoutes));
      setTopRoutes(String(TOTEMTITION_SETTINGS.topRoutesForScoring));
      setAttemptPenalty('0');
      setMaxAttempts(String(TOTEMTITION_SETTINGS.maxAttempts));
    }
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('שגיאה', 'יש להזין שם לתחרות');
      return false;
    }
    if (endDate <= startDate) {
      Alert.alert('שגיאה', 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
      return false;
    }
    if (parseInt(maxRoutes) < 1) {
      Alert.alert('שגיאה', 'מספר המסלולים חייב להיות לפחות 1');
      return false;
    }
    if (parseInt(topRoutes) > parseInt(maxRoutes)) {
      Alert.alert('שגיאה', 'מספר המסלולים לניקוד לא יכול להיות גדול ממספר המסלולים הכולל');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user) {
      Alert.alert('שגיאה', 'יש להתחבר כדי ליצור תחרות');
      return;
    }

    setIsSubmitting(true);

    try {
      const competitionId = await CompetitionService.createCompetition({
        name: name.trim(),
        description: description.trim(),
        format,
        startDate,
        endDate,
        settings: {
          maxRoutes: parseInt(maxRoutes),
          topRoutesForScoring: parseInt(topRoutes),
          attemptPenalty: parseInt(attemptPenalty),
          maxAttempts: parseInt(maxAttempts),
          enableCategories,
          enableRounds: false,
          allowSelfEntry: format !== 'national_league',
          judgesOnly: format === 'national_league',
        },
        createdBy: user.uid,
        categories: enableCategories ? [
          // Default categories
          { id: 'male_open', name: 'גברים', type: 'gender', value: 'male' },
          { id: 'female_open', name: 'נשים', type: 'gender', value: 'female' },
          { id: 'youth', name: 'נוער (עד 18)', type: 'age', minAge: 0, maxAge: 18 },
          { id: 'adults', name: 'בוגרים (18+)', type: 'age', minAge: 18, maxAge: 99 },
        ] : [],
      });

      Alert.alert(
        'הצלחה! 🎉',
        'התחרות נוצרה בהצלחה',
        [
          {
            text: 'נהל תחרות',
            onPress: () => {
              navigation.replace('ManageCompetition', { competitionId });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating competition:', error);
      Alert.alert('שגיאה', 'לא ניתן ליצור את התחרות. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-forward" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>יצירת תחרות חדשה</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Competition Name */}
          <View style={styles.section}>
            <Text style={styles.label}>שם התחרות *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="לדוגמה: ליגה ארצית 2025"
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>תיאור</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="תיאור קצר של התחרות..."
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Format Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>פורמט תחרות</Text>
            <View style={styles.formatOptions}>
              {(['national_league', 'totemtition'] as CompetitionFormat[]).map((f) => {
                const info = COMPETITION_FORMAT_INFO[f];
                const isSelected = format === f;
                
                return (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.formatOption,
                      isSelected && styles.formatOptionSelected,
                    ]}
                    onPress={() => handleFormatChange(f)}
                  >
                    <Text style={styles.formatIcon}>{info.icon}</Text>
                    <Text style={[
                      styles.formatLabel,
                      isSelected && styles.formatLabelSelected,
                    ]}>
                      {info.label}
                    </Text>
                    <Text style={styles.formatDescription}>
                      {info.description}
                    </Text>
                    {isSelected && (
                      <Ionicons 
                        name="checkmark-circle" 
                        size={24} 
                        color={theme.primary}
                        style={styles.checkIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Dates */}
          <View style={styles.section}>
            <Text style={styles.label}>תאריכים</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={styles.dateLabel}>התחלה</Text>
                <Text style={styles.dateValue}>
                  {startDate.toLocaleDateString('he-IL')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={styles.dateLabel}>סיום</Text>
                <Text style={styles.dateValue}>
                  {endDate.toLocaleDateString('he-IL')}
                </Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <View style={styles.datePickerModal}>
                <Text style={styles.datePickerTitle}>בחר תאריך התחלה</Text>
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => {
                      setStartDate(new Date());
                      setShowStartPicker(false);
                    }}
                  >
                    <Text style={styles.datePickerBtnText}>היום</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setStartDate(tomorrow);
                      setShowStartPicker(false);
                    }}
                  >
                    <Text style={styles.datePickerBtnText}>מחר</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => {
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      setStartDate(nextWeek);
                      setShowStartPicker(false);
                    }}
                  >
                    <Text style={styles.datePickerBtnText}>עוד שבוע</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={styles.datePickerCancel}
                  onPress={() => setShowStartPicker(false)}
                >
                  <Text style={styles.datePickerCancelText}>ביטול</Text>
                </TouchableOpacity>
              </View>
            )}
            {showEndPicker && (
              <View style={styles.datePickerModal}>
                <Text style={styles.datePickerTitle}>בחר תאריך סיום</Text>
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => {
                      const oneDay = new Date(startDate);
                      oneDay.setDate(oneDay.getDate() + 1);
                      setEndDate(oneDay);
                      setShowEndPicker(false);
                    }}
                  >
                    <Text style={styles.datePickerBtnText}>יום אחד</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => {
                      const oneWeek = new Date(startDate);
                      oneWeek.setDate(oneWeek.getDate() + 7);
                      setEndDate(oneWeek);
                      setShowEndPicker(false);
                    }}
                  >
                    <Text style={styles.datePickerBtnText}>שבוע</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.datePickerBtn}
                    onPress={() => {
                      const oneMonth = new Date(startDate);
                      oneMonth.setMonth(oneMonth.getMonth() + 1);
                      setEndDate(oneMonth);
                      setShowEndPicker(false);
                    }}
                  >
                    <Text style={styles.datePickerBtnText}>חודש</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={styles.datePickerCancel}
                  onPress={() => setShowEndPicker(false)}
                >
                  <Text style={styles.datePickerCancelText}>ביטול</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Advanced Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>הגדרות מתקדמות</Text>
            
            <View style={styles.settingsGrid}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>מספר מסלולים</Text>
                <TextInput
                  style={styles.settingInput}
                  value={maxRoutes}
                  onChangeText={setMaxRoutes}
                  keyboardType="number-pad"
                  textAlign="center"
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>TOP לניקוד</Text>
                <TextInput
                  style={styles.settingInput}
                  value={topRoutes}
                  onChangeText={setTopRoutes}
                  keyboardType="number-pad"
                  textAlign="center"
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>קנס ניסיון</Text>
                <TextInput
                  style={styles.settingInput}
                  value={attemptPenalty}
                  onChangeText={setAttemptPenalty}
                  keyboardType="number-pad"
                  textAlign="center"
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>מקס. ניסיונות</Text>
                <TextInput
                  style={styles.settingInput}
                  value={maxAttempts}
                  onChangeText={setMaxAttempts}
                  keyboardType="number-pad"
                  textAlign="center"
                />
              </View>
            </View>

            {/* Categories Toggle */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setEnableCategories(!enableCategories)}
            >
              <Ionicons
                name={enableCategories ? 'checkbox' : 'square-outline'}
                size={24}
                color={enableCategories ? theme.primary : theme.textSecondary}
              />
              <Text style={styles.toggleLabel}>אפשר קטגוריות (גיל, מגדר)</Text>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trophy" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>צור תחרות</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'right',
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'right',
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    formatOptions: {
      gap: 12,
    },
    formatOption: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: 'transparent',
      position: 'relative',
    },
    formatOptionSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
    },
    formatIcon: {
      fontSize: 24,
      textAlign: 'right',
      marginBottom: 8,
    },
    formatLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'right',
    },
    formatLabelSelected: {
      color: theme.primary,
    },
    formatDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
    checkIcon: {
      position: 'absolute',
      top: 12,
      left: 12,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 12,
    },
    dateButton: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    dateLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    dateValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginTop: 4,
    },
    settingsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    settingItem: {
      width: '48%',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    settingLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    settingInput: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 8,
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
      paddingVertical: 8,
    },
    toggleLabel: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
      textAlign: 'right',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
      marginTop: 16,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    datePickerModal: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    datePickerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    datePickerButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      gap: 8,
    },
    datePickerBtn: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    datePickerBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    datePickerCancel: {
      marginTop: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    datePickerCancelText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
  });
