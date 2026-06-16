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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { CompetitionService } from '@/features/competitions/services/CompetitionService';
import { CompetitionFormat } from '@/features/competitions/types';
import {
  NATIONAL_LEAGUE_SETTINGS,
  TOTEMTITION_SETTINGS,
  ZONE_TOP_SETTINGS,
  COMPETITION_FORMAT_INFO,
  getDefaultSettingsForFormat,
} from '@/features/competitions/constants';
import { useLanguage } from '@/features/language';

export default function CreateCompetitionScreen() {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
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
  const [nationalLeague, setNationalLeague] = useState(false);

  // Zone/Top settings
  const [enableZone, setEnableZone] = useState(true);
  const [defaultPointsTop, setDefaultPointsTop] = useState('25');
  const [defaultPointsZone, setDefaultPointsZone] = useState('10');
  const [attemptPenaltyZone, setAttemptPenaltyZone] = useState('0.1');
  const [attemptPenaltyTop, setAttemptPenaltyTop] = useState('0.01');
  const [freeFirstAttempt, setFreeFirstAttempt] = useState(true);
  const [separateTopZonePenalty, setSeparateTopZonePenalty] = useState(true);

  // Totemtition settings
  const [totemDivisionScope, setTotemDivisionScope] = useState<'per_category' | 'global'>('per_category');

  // Categories — created with the competition, still editable later in ManageCategories
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; gender?: 'male' | 'female'; minAge?: number; maxAge?: number }>
  >(() => [
    { id: 'male_open', name: t.competitionExt.categoryMaleOpen, gender: 'male' },
    { id: 'female_open', name: t.competitionExt.categoryFemaleOpen, gender: 'female' },
    { id: 'youth', name: t.competitionExt.categoryYouth, minAge: 0, maxAge: 18 },
    { id: 'adults', name: t.competitionExt.categoryAdults, minAge: 18, maxAge: 99 },
  ]);

  // Entry/Registration modes
  const [resultsEntryMode, setResultsEntryMode] = useState<'selfEntry' | 'judgesOnly'>('judgesOnly');
  const [registrationMode, setRegistrationMode] = useState<'openRegistration' | 'adminsOrJudgesOnly'>('openRegistration');

  const styles = createStyles(theme);

  const isZoneTopFormat = format === 'zone_top';
  const isTotemtition = format === 'totemtition';
  const isNationalLeague = format === 'national_league';
  const isPointsCompetition = format === 'points_competition';

  // Which settings are relevant per format
  const showTopRoutes = isNationalLeague;          // only NL uses TOP-N
  const showAttemptPenalty = isNationalLeague;      // ZT uses zone/top penalties, Totem has none
  const showMaxAttempts = !isTotemtition && !isPointsCompetition; // Totem and Points are unlimited
  const showCategories = !isPointsCompetition;  // Points has no categories; Totem now supports them
  const showAdvancedSettings = !isPointsCompetition; // Points Competition uses wall routes, no custom settings

  const handleFormatChange = (newFormat: CompetitionFormat) => {
    setFormat(newFormat);
    
    const defaults = getDefaultSettingsForFormat(newFormat);
    setMaxRoutes(String(defaults.maxRoutes));
    setTopRoutes(String(defaults.topRoutesForScoring));
    setAttemptPenalty(String(defaults.attemptPenalty));
    setMaxAttempts(String(defaults.maxAttempts));
    setEnableCategories(defaults.enableCategories);
    setNationalLeague(newFormat === 'national_league');

    // Update entry/registration modes
    setResultsEntryMode(defaults.resultsEntryMode ?? (defaults.judgesOnly ? 'judgesOnly' : 'selfEntry'));
    setRegistrationMode(defaults.registrationMode ?? 'openRegistration');

    // Zone/Top settings
    if (newFormat === 'zone_top') {
      setEnableZone(defaults.enableZone ?? true);
      setDefaultPointsTop(String(defaults.defaultPointsTop ?? 25));
      setDefaultPointsZone(String(defaults.defaultPointsZone ?? 10));
      setAttemptPenaltyZone(String(defaults.attemptPenaltyZone ?? 0.1));
      setAttemptPenaltyTop(String(defaults.attemptPenaltyTop ?? 0.01));
      setFreeFirstAttempt(defaults.freeFirstAttempt ?? true);
      setSeparateTopZonePenalty(defaults.separateTopZonePenalty ?? false);
    }

    // Totemtition settings
    if (newFormat === 'totemtition') {
      setTotemDivisionScope(defaults.totemDivisionScope ?? 'per_category');
    }
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert(t.common.error, t.competitionExt.mustEnterName);
      return false;
    }
    if (endDate <= startDate) {
      Alert.alert(t.common.error, t.competitionExt.endAfterStart);
      return false;
    }
    if (parseInt(maxRoutes) < 1) {
      Alert.alert(t.common.error, t.competitionExt.minOneRoute);
      return false;
    }
    if (showTopRoutes && parseInt(topRoutes) > parseInt(maxRoutes)) {
      Alert.alert(t.common.error, t.competitionExt.topRoutesLimit);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user) {
      Alert.alert(t.common.error, t.competitionExt.mustLoginToCreate);
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
          topRoutesForScoring: showTopRoutes ? parseInt(topRoutes) : 999,
          attemptPenalty: showAttemptPenalty ? parseInt(attemptPenalty) : 0,
          maxAttempts: showMaxAttempts ? parseInt(maxAttempts) : 999,
          enableCategories: showCategories ? enableCategories : false,
          enableRounds: false,
          nationalLeague,
          allowSelfEntry: resultsEntryMode === 'selfEntry',
          judgesOnly: resultsEntryMode === 'judgesOnly',
          resultsEntryMode,
          registrationMode,
          // Zone/Top settings (only for applicable formats)
          ...(isZoneTopFormat ? {
            enableZone,
            defaultPointsTop: parseFloat(defaultPointsTop),
            defaultPointsZone: parseFloat(defaultPointsZone),
            attemptPenaltyZone: parseFloat(attemptPenaltyZone),
            attemptPenaltyTop: parseFloat(attemptPenaltyTop),
            freeFirstAttempt,
            separateTopZonePenalty,
          } : {}),
          // Totemtition settings (division scope; pool defaults to 1000 via format defaults)
          ...(isTotemtition ? {
            totemDivisionScope,
          } : {}),
        },
        createdBy: user.uid,
        categories: enableCategories
          ? categories.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim() }))
          : [],
      });

      Alert.alert(
        t.alerts.success,
        t.common.success,
        [
          {
            text: t.admin.adminPanel,
            onPress: () => {
              navigation.replace('ManageCompetition', { competitionId });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating competition:', error);
      Alert.alert(t.common.error, t.competitionExt.cannotCreateCompetition);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
          <Text style={styles.headerTitle}>{t.competitionExt.createCompetition}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Competition Name */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.competitionExt.competitionName}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t.competitionExt.competitionNamePlaceholder}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.competitionExt.description}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t.competitionExt.descriptionPlaceholder}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Format Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.competitionExt.competitionFormat}</Text>
            <View style={styles.formatOptions}>
              {(['national_league', 'totemtition', 'zone_top', 'points_competition'] as CompetitionFormat[]).map((f) => {
                const info = COMPETITION_FORMAT_INFO[f];
                const isSelected = format === f;
                const label = language === 'he' ? info.label : info.labelEn;
                const desc = language === 'he' ? info.description : (info.descriptionEn ?? info.description);
                
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
                      {label}
                    </Text>
                    <Text style={styles.formatDescription}>
                      {desc}
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
            <Text style={styles.label}>{t.competition.dates}</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={styles.dateLabel}>{t.competitionExt.dateStart}</Text>
                <Text style={styles.dateValue}>
                  {startDate.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={styles.dateLabel}>{t.competitionExt.dateEnd}</Text>
                <Text style={styles.dateValue}>
                  {endDate.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Start Date Picker */}
            {showStartPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="calendar"
                onChange={(event, selectedDate) => {
                  setShowStartPicker(false);
                  if (event.type === 'set' && selectedDate) {
                    setStartDate(selectedDate);
                    // If end date is before start date, adjust it
                    if (endDate <= selectedDate) {
                      const newEndDate = new Date(selectedDate);
                      newEndDate.setDate(newEndDate.getDate() + 7);
                      setEndDate(newEndDate);
                    }
                  }
                }}
                minimumDate={new Date()}
              />
            )}

            {/* iOS Start Date Picker Modal */}
            {showStartPicker && Platform.OS === 'ios' && (
              <Modal
                animationType="slide"
                transparent={true}
                visible={showStartPicker}
                onRequestClose={() => setShowStartPicker(false)}
              >
                <View style={styles.datePickerModalOverlay}>
                  <View style={styles.datePickerModalContent}>
                    <View style={styles.datePickerModalHeader}>
                      <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                        <Text style={styles.datePickerCancelText}>{t.common.cancel}</Text>
                      </TouchableOpacity>
                      <Text style={styles.datePickerTitle}>{t.competitionExt.selectStartDate}</Text>
                      <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                        <Text style={[styles.datePickerCancelText, { color: theme.primary }]}>{t.common.confirm}</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setStartDate(selectedDate);
                          if (endDate <= selectedDate) {
                            const newEndDate = new Date(selectedDate);
                            newEndDate.setDate(newEndDate.getDate() + 7);
                            setEndDate(newEndDate);
                          }
                        }
                      }}
                      minimumDate={new Date()}
                      locale={language === 'he' ? 'he-IL' : 'en-US'}
                      style={{ height: 200 }}
                    />
                  </View>
                </View>
              </Modal>
            )}

            {/* End Date Picker */}
            {showEndPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="calendar"
                onChange={(event, selectedDate) => {
                  setShowEndPicker(false);
                  if (event.type === 'set' && selectedDate) {
                    setEndDate(selectedDate);
                  }
                }}
                minimumDate={new Date(startDate.getTime() + 24 * 60 * 60 * 1000)}
              />
            )}

            {/* iOS End Date Picker Modal */}
            {showEndPicker && Platform.OS === 'ios' && (
              <Modal
                animationType="slide"
                transparent={true}
                visible={showEndPicker}
                onRequestClose={() => setShowEndPicker(false)}
              >
                <View style={styles.datePickerModalOverlay}>
                  <View style={styles.datePickerModalContent}>
                    <View style={styles.datePickerModalHeader}>
                      <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                        <Text style={styles.datePickerCancelText}>{t.common.cancel}</Text>
                      </TouchableOpacity>
                      <Text style={styles.datePickerTitle}>{t.competitionExt.selectEndDate}</Text>
                      <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                        <Text style={[styles.datePickerCancelText, { color: theme.primary }]}>{t.common.confirm}</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setEndDate(selectedDate);
                        }
                      }}
                      minimumDate={new Date(startDate.getTime() + 24 * 60 * 60 * 1000)}
                      locale={language === 'he' ? 'he-IL' : 'en-US'}
                      style={{ height: 200 }}
                    />
                  </View>
                </View>
              </Modal>
            )}
          </View>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.competitionExt.advancedSettings}</Text>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setNationalLeague(!nationalLeague)}
            >
              <Ionicons
                name={nationalLeague ? 'checkbox' : 'square-outline'}
                size={24}
                color={nationalLeague ? theme.primary : theme.textSecondary}
              />
              <Text style={styles.toggleLabel}>{t.competitionExt.nationalLeagueToggle}</Text>
            </TouchableOpacity>
            {nationalLeague && (
              <View style={[styles.toggleRow, { backgroundColor: theme.card, padding: 12, borderRadius: 8, marginTop: 4 }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.toggleLabel, { fontSize: 12, color: theme.textSecondary }]}>
                  {t.competitionExt.nationalLeagueHint}
                </Text>
              </View>
            )}
            
            <View style={styles.settingsGrid}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>{t.competitionExt.numberOfRoutes}</Text>
                <TextInput
                  style={styles.settingInput}
                  value={maxRoutes}
                  onChangeText={setMaxRoutes}
                  keyboardType="number-pad"
                  textAlign="center"
                />
              </View>

              {showTopRoutes && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{t.competitionExt.topForScoring}</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={topRoutes}
                    onChangeText={setTopRoutes}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                </View>
              )}

              {showAttemptPenalty && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{t.competitionExt.attemptPenaltyLabel}</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={attemptPenalty}
                    onChangeText={setAttemptPenalty}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                </View>
              )}

              {showMaxAttempts && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{t.competitionExt.maxAttemptsLabel}</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={maxAttempts}
                    onChangeText={setMaxAttempts}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                </View>
              )}
            </View>

            {/* Categories Toggle */}
            {showCategories && (
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setEnableCategories(!enableCategories)}
              >
                <Ionicons
                  name={enableCategories ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={enableCategories ? theme.primary : theme.textSecondary}
                />
                <Text style={styles.toggleLabel}>{t.competitionExt.enableCategoriesToggle}</Text>
              </TouchableOpacity>
            )}

            {showCategories && enableCategories && (
              <View style={styles.categoriesEditor}>
                {categories.map((cat, idx) => (
                  <View key={cat.id} style={styles.categoryCard}>
                    <View style={styles.categoryRow}>
                      <TextInput
                        style={styles.categoryInput}
                        value={cat.name}
                        onChangeText={(text) =>
                          setCategories((prev) => prev.map((c, i) => (i === idx ? { ...c, name: text } : c)))
                        }
                        placeholder={t.competitionExt.categoryNamePlaceholder}
                        placeholderTextColor={theme.textSecondary}
                        textAlign="right"
                      />
                      <TouchableOpacity
                        onPress={() => setCategories((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.error || '#e74c3c'} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.categoryAgeRow}>
                      <Text style={styles.categoryAgeLabel}>{t.competitionExt.ageRange}:</Text>
                      <TextInput
                        style={styles.categoryAgeInput}
                        value={cat.minAge != null ? String(cat.minAge) : ''}
                        onChangeText={(v) =>
                          setCategories((prev) =>
                            prev.map((c, i) => {
                              if (i !== idx) return c;
                              const n = parseInt(v, 10);
                              return { ...c, minAge: v.trim() === '' || isNaN(n) ? undefined : n };
                            }),
                          )
                        }
                        keyboardType="number-pad"
                        placeholder={t.competitionExt.minAge}
                        placeholderTextColor={theme.textSecondary}
                        textAlign="center"
                      />
                      <Text style={styles.categoryAgeDash}>–</Text>
                      <TextInput
                        style={styles.categoryAgeInput}
                        value={cat.maxAge != null ? String(cat.maxAge) : ''}
                        onChangeText={(v) =>
                          setCategories((prev) =>
                            prev.map((c, i) => {
                              if (i !== idx) return c;
                              const n = parseInt(v, 10);
                              return { ...c, maxAge: v.trim() === '' || isNaN(n) ? undefined : n };
                            }),
                          )
                        }
                        keyboardType="number-pad"
                        placeholder={t.competitionExt.maxAge}
                        placeholderTextColor={theme.textSecondary}
                        textAlign="center"
                      />
                    </View>
                    <View style={styles.categoryGenderRow}>
                      {(
                        [
                          { val: undefined, label: t.competitionExt.genderBoth },
                          { val: 'male', label: t.competitionExt.male },
                          { val: 'female', label: t.competitionExt.female },
                        ] as { val: 'male' | 'female' | undefined; label: string }[]
                      ).map((opt) => (
                        <TouchableOpacity
                          key={opt.label}
                          style={[
                            styles.categoryGenderOption,
                            cat.gender === opt.val && styles.categoryGenderOptionSelected,
                          ]}
                          onPress={() =>
                            setCategories((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, gender: opt.val } : c)),
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.categoryGenderText,
                              cat.gender === opt.val && styles.categoryGenderTextSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addCategoryBtn}
                  onPress={() =>
                    setCategories((prev) => [...prev, { id: 'cat_' + Date.now(), name: '' }])
                  }
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                  <Text style={[styles.toggleLabel, { color: theme.primary, flex: 0 }]}>
                    {t.competitionExt.addCategory}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          )}

          {/* Entry & Registration Mode */}
          {showAdvancedSettings && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.competitionExt.entryAndRegistration}</Text>

            {/* Results Entry Mode */}
            <Text style={styles.settingLabel}>{t.competitionExt.resultsEntryModeLabel}</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[styles.toggleGroupOption, resultsEntryMode === 'judgesOnly' && styles.toggleGroupOptionSelected]}
                onPress={() => setResultsEntryMode('judgesOnly')}
              >
                <Text style={[styles.toggleGroupText, resultsEntryMode === 'judgesOnly' && styles.toggleGroupTextSelected]}>
                  {t.competitionExt.judgesOnlyEntry}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleGroupOption, resultsEntryMode === 'selfEntry' && styles.toggleGroupOptionSelected]}
                onPress={() => setResultsEntryMode('selfEntry')}
              >
                <Text style={[styles.toggleGroupText, resultsEntryMode === 'selfEntry' && styles.toggleGroupTextSelected]}>
                  {t.competitionExt.selfEntryAllowed}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Registration Mode */}
            <Text style={[styles.settingLabel, { marginTop: 16 }]}>{t.competitionExt.registrationModeLabel}</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[styles.toggleGroupOption, registrationMode === 'openRegistration' && styles.toggleGroupOptionSelected]}
                onPress={() => setRegistrationMode('openRegistration')}
              >
                <Text style={[styles.toggleGroupText, registrationMode === 'openRegistration' && styles.toggleGroupTextSelected]}>
                  {t.competitionExt.openRegistrationMode}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleGroupOption, registrationMode === 'adminsOrJudgesOnly' && styles.toggleGroupOptionSelected]}
                onPress={() => setRegistrationMode('adminsOrJudgesOnly')}
              >
                <Text style={[styles.toggleGroupText, registrationMode === 'adminsOrJudgesOnly' && styles.toggleGroupTextSelected]}>
                  {t.competitionExt.adminsOnlyRegistration}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          )}

          {/* Zone/Top Scoring Settings */}
          {isZoneTopFormat && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.competitionExt.scoringSettings}</Text>

              {/* Enable Zone Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setEnableZone(!enableZone)}
              >
                <Ionicons
                  name={enableZone ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={enableZone ? theme.primary : theme.textSecondary}
                />
                <Text style={styles.toggleLabel}>{t.competitionExt.enableZoneToggle}</Text>
              </TouchableOpacity>

              <View style={[styles.settingsGrid, { marginTop: 12 }]}>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{t.competitionExt.pointsTopLabel}</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={defaultPointsTop}
                    onChangeText={setDefaultPointsTop}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                </View>

                {enableZone && (
                  <View style={styles.settingItem}>
                    <Text style={styles.settingLabel}>{t.competitionExt.pointsZoneLabel}</Text>
                    <TextInput
                      style={styles.settingInput}
                      value={defaultPointsZone}
                      onChangeText={setDefaultPointsZone}
                      keyboardType="numeric"
                      textAlign="center"
                    />
                  </View>
                )}

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{t.competitionExt.penaltyZoneLabel}</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={attemptPenaltyZone}
                    onChangeText={setAttemptPenaltyZone}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                </View>

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{t.competitionExt.penaltyTopLabel}</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={attemptPenaltyTop}
                    onChangeText={setAttemptPenaltyTop}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                </View>
              </View>

              {/* Free First Attempt */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setFreeFirstAttempt(!freeFirstAttempt)}
              >
                <Ionicons
                  name={freeFirstAttempt ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={freeFirstAttempt ? theme.primary : theme.textSecondary}
                />
                <Text style={styles.toggleLabel}>{t.competitionExt.freeFirstAttemptToggle}</Text>
              </TouchableOpacity>

              {/* Separate Zone/Top Penalty */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setSeparateTopZonePenalty(!separateTopZonePenalty)}
              >
                <Ionicons
                  name={separateTopZonePenalty ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={separateTopZonePenalty ? theme.primary : theme.textSecondary}
                />
                <Text style={styles.toggleLabel}>{t.competitionExt.separatePenaltyToggle}</Text>
              </TouchableOpacity>

              {/* Scoring explanation */}
              <View style={[styles.toggleRow, { backgroundColor: theme.card, padding: 12, borderRadius: 8, marginTop: 8 }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.toggleLabel, { fontSize: 12, color: theme.textSecondary }]}>
                  {separateTopZonePenalty
                    ? t.competitionExt.separatePenaltyExplanation
                    : t.competitionExt.standardPenaltyExplanation}
                </Text>
              </View>
            </View>
          )}

          {/* Totemtition Division Scope */}
          {isTotemtition && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.competitionExt.scoringSettings}</Text>
              <Text style={styles.settingLabel}>{t.competitionExt.totemDivisionLabel}</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[styles.toggleGroupOption, totemDivisionScope === 'per_category' && styles.toggleGroupOptionSelected]}
                  onPress={() => setTotemDivisionScope('per_category')}
                >
                  <Text style={[styles.toggleGroupText, totemDivisionScope === 'per_category' && styles.toggleGroupTextSelected]}>
                    {t.competitionExt.totemDivisionPerCategory}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleGroupOption, totemDivisionScope === 'global' && styles.toggleGroupOptionSelected]}
                  onPress={() => setTotemDivisionScope('global')}
                >
                  <Text style={[styles.toggleGroupText, totemDivisionScope === 'global' && styles.toggleGroupTextSelected]}>
                    {t.competitionExt.totemDivisionGlobal}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.toggleRow, { backgroundColor: theme.card, padding: 12, borderRadius: 8, marginTop: 8 }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.toggleLabel, { fontSize: 12, color: theme.textSecondary }]}>
                  {totemDivisionScope === 'global'
                    ? t.competitionExt.totemDivisionGlobalDesc
                    : t.competitionExt.totemDivisionPerCategoryDesc}
                </Text>
              </View>
              {showCategories && !enableCategories && (
                <View style={[styles.toggleRow, { backgroundColor: theme.card, padding: 12, borderRadius: 8, marginTop: 8 }]}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.toggleLabel, { fontSize: 12, color: theme.textSecondary }]}>
                    {t.competitionExt.totemDivisionNoCategoriesNote}
                  </Text>
                </View>
              )}
            </View>
          )}

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
                <Text style={styles.submitButtonText}>{t.competitionExt.createCompetitionButton}</Text>
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
      marginBottom: 16,
    },
    label: {
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
      marginBottom: 8,
    },
    formatLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    formatLabelSelected: {
      color: theme.primary,
    },
    formatDescription: {
      fontSize: 13,
      color: theme.textSecondary,
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
    },
    categoriesEditor: {
      marginTop: 12,
      gap: 10,
    },
    categoryCard: {
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 10,
      gap: 8,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryInput: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
    },
    categoryAgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryAgeLabel: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    categoryAgeInput: {
      width: 64,
      backgroundColor: theme.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.text,
    },
    categoryAgeDash: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    categoryGenderRow: {
      flexDirection: 'row',
      gap: 8,
    },
    categoryGenderOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    categoryGenderOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryGenderText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    categoryGenderTextSelected: {
      color: '#fff',
    },
    addCategoryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    toggleGroup: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    toggleGroupOption: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    toggleGroupOptionSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
    },
    toggleGroupText: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    toggleGroupTextSelected: {
      color: theme.primary,
      fontWeight: '600',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.buttonPrimary,
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
      backgroundColor: theme.buttonPrimary,
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
    datePickerModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    datePickerModalContent: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
    },
    datePickerModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
  });
