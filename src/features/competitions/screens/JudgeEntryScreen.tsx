/**
 * @fileoverview Judge Entry Screen
 * @description Screen for judges to enter competition results
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import { useLanguage } from '@/features/language';
import {
  useCompetition,
  useParticipants,
  useCompetitionRoutes,
  useCompetitionLeaderboard,
} from '@/features/competitions/hooks/useCompetition';
import { ResultsService } from '@/features/competitions/services/ResultsService';
import { getColorDisplayHex } from '@/features/routes-map/services/ColorSettingsService';
import { getContrastTextColor } from '@/constants/colors';
import {
  Participant,
  CompetitionRoute,
  ParticipantResult,
  RouteResult,
  Category,
} from '@/features/competitions/types';
import { NATIONAL_LEAGUE_GRADE_POINTS } from '@/features/competitions/constants';
import { isZoneTopFormat, formatIFSCResult } from '@/features/competitions/constants';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { CachedAvatar } from '@/components/ui/CachedAvatar';

export default function JudgeEntryScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId, selectedRouteNumber } = route.params;
  const { user } = useAuth();
  const rolesContext = useRolesContext();

  const { competition, loading: compLoading } = useCompetition(competitionId);
  const { participants, loading: partsLoading } = useParticipants(competitionId);
  const { routes, loading: routesLoading } = useCompetitionRoutes(competitionId);
  // Leaderboard entries — used to show each participant's live total (esp. Totemtition,
  // whose points are dynamic) so the entry screen matches the leaderboard exactly.
  const { entries: leaderboardEntries } = useCompetitionLeaderboard(
    competitionId,
    undefined,
    competition?.format,
    competition?.settings
  );

  // Use global roles for judge permissions (admin, judge, head_judge)
  const isJudge = rolesContext.canEnterResults;
  const isHeadJudge = rolesContext.isHeadJudge;

  // States for Totemtition self-reporting
  const [isSelfReporter, setIsSelfReporter] = useState(false);
  const [selfParticipant, setSelfParticipant] = useState<Participant | null>(null);
  const [checkingSelfReporter, setCheckingSelfReporter] = useState(true);

  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [participantResults, setParticipantResults] = useState<ParticipantResult | null>(null);
  const routesListRef = useRef<FlatList<CompetitionRoute>>(null);
  const handledInitialRouteRef = useRef(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<CompetitionRoute | null>(null);
  const [attempts, setAttempts] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Category-based route completion counts: category -> routeId -> count
  const [routeCompletionCountsByCategory, setRouteCompletionCountsByCategory] = useState<Record<string, Record<string, number>>>({});

  // Zone/Top state
  const [zoneAchieved, setZoneAchieved] = useState(false);
  const [zoneAttempt, setZoneAttempt] = useState('1');
  const [topAchieved, setTopAchieved] = useState(false);
  const [topAttempt, setTopAttempt] = useState('1');

  // Categories for route prefix display and participant grouping
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const styles = createStyles(theme);

  // Check if this is a Totemtition competition with self-reporting
  const isTotemtition = competition?.format === 'totemtition';
  const isZoneTop = competition?.format ? isZoneTopFormat(competition.format) : false;
  const hasZone = isZoneTop && (competition?.settings?.enableZone !== false);

  const hasCategories = competition?.settings?.enableCategories === true;

  // Load categories for route prefix display and participant grouping
  useEffect(() => {
    if (!competitionId || (!isZoneTop && !hasCategories)) return;
    const loadCategories = async () => {
      try {
        const cats = await ParticipantService.getCategories(competitionId);
        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, [isZoneTop, hasCategories, competitionId]);

  // Get route label with prefix based on current participant's category
  const getRouteLabel = useCallback((routeNumber: number): string => {
    const currentParticipant = selectedParticipant || selfParticipant;
    if (!currentParticipant?.category || categories.length === 0) {
      return String(routeNumber);
    }
    const cat = categories.find(c => c.id === currentParticipant.category);
    if (cat?.routePrefix) {
      return `${cat.routePrefix}${routeNumber}`;
    }
    return String(routeNumber);
  }, [categories, selectedParticipant, selfParticipant]);

  // Subscribe to route completion counts by category for Totemtition
  useEffect(() => {
    if (!isTotemtition || !competitionId) return;

    const unsubscribe = ResultsService.subscribeToRouteCompletionCountsByCategory(
      competitionId,
      (countsByCategory) => {
        setRouteCompletionCountsByCategory(countsByCategory);
      }
    );

    return () => unsubscribe();
  }, [isTotemtition, competitionId]);

  // Check if user is an approved participant for self-reporting
  // (Totemtition or Zone/Top formats with selfEntry)
  const allowsSelfEntry = isTotemtition || (isZoneTop && competition?.settings?.resultsEntryMode === 'selfEntry');
  useEffect(() => {
    const checkSelfReporter = async () => {
      if (!user || !allowsSelfEntry) {
        setCheckingSelfReporter(false);
        return;
      }

      try {
        const participant = await ParticipantService.getParticipantByUserId(competitionId, user.uid);
        if (participant && participant.status === 'approved') {
          setIsSelfReporter(true);
          setSelfParticipant(participant);
          // Auto-select self as participant in self-entry mode ONLY if not a judge
          // Judges (including head judges) should see all participants and choose manually
          if (!isJudge) {
            setSelectedParticipant(participant);
          }
        }
      } catch (error) {
        console.error('Error checking self-reporter status:', error);
      } finally {
        setCheckingSelfReporter(false);
      }
    };

    checkSelfReporter();
  }, [user, allowsSelfEntry, competitionId, isJudge]);

  // Determine if user can access this screen
  // In Totemtition: judges OR approved self-reporters
  // In Zone/Top formats with selfEntry: judges OR approved self-reporters
  // In other formats: judges only
  const isZoneTopSelfReporter = isZoneTop && competition?.settings?.resultsEntryMode === 'selfEntry' && isSelfReporter;
  const canAccessScreen = isJudge || (isTotemtition && isSelfReporter) || isZoneTopSelfReporter;

  const loading = compLoading || partsLoading || routesLoading || checkingSelfReporter;

  // Filter approved participants
  const approvedParticipants = participants.filter(p => p.status === 'approved');

  // Filter by selected category first, then by search query
  const categoryFilteredParticipants = selectedCategoryId
    ? approvedParticipants.filter(p => p.category === selectedCategoryId)
    : approvedParticipants;

  // Search filter
  const filteredParticipants = searchQuery
    ? categoryFilteredParticipants.filter(p => 
        p.userName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categoryFilteredParticipants;

  // Load participant results when selected
  useEffect(() => {
    if (!selectedParticipant) {
      setParticipantResults(null);
      return;
    }

    const resultsRef = doc(
      db, 
      'competitions', 
      competitionId, 
      'results', 
      selectedParticipant.userId
    );

    const unsubscribe = onSnapshot(resultsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setParticipantResults({
          participantId: selectedParticipant.userId,
          competitionId,
          routes: data.routes || {},
          totalPoints: data.totalPoints || 0,
          totalAttempts: data.totalAttempts || 0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          updatedBy: data.updatedBy,
        });
      } else {
        setParticipantResults({
          participantId: selectedParticipant.userId,
          competitionId,
          routes: {},
          totalPoints: 0,
          totalAttempts: 0,
          lastUpdated: new Date(),
        });
      }
    });

    return () => unsubscribe();
  }, [selectedParticipant, competitionId]);

  const handleRoutePress = (route: CompetitionRoute) => {
    setSelectedRoute(route);
    
    // Check if this route was already completed
    const routes = participantResults?.routes;
    let existingResult: RouteResult | undefined;
    
    if (routes) {
      if (Array.isArray(routes)) {
        existingResult = routes.find(r => r.routeId === route.id);
      } else {
        // It's a Record<number, RouteResult>
        existingResult = Object.values(routes).find(r => r.routeId === route.id);
      }
    }
    
    if (existingResult) {
      setAttempts(String(existingResult.attempts));
      // Restore zone/top state if applicable
      if (isZoneTop) {
        setZoneAchieved(existingResult.zoneAchieved ?? false);
        setZoneAttempt(String(existingResult.zoneAttempt ?? 1));
        setTopAchieved(existingResult.topAchieved ?? existingResult.completed);
        setTopAttempt(String(existingResult.topAttempt ?? existingResult.attempts));
      }
    } else {
      setAttempts('1');
      if (isZoneTop) {
        setZoneAchieved(false);
        setZoneAttempt('1');
        setTopAchieved(false);
        setTopAttempt('1');
      }
    }
    
    setShowResultModal(true);
  };

  // Arriving from a map tap: jump to that route — scroll the list to it and open its entry.
  useEffect(() => {
    if (handledInitialRouteRef.current) return;
    if (!selectedRouteNumber || routes.length === 0 || !selectedParticipant) return;
    const target = routes.find((r) => r.routeNumber === selectedRouteNumber);
    if (!target) return;
    handledInitialRouteRef.current = true;
    const index = routes.findIndex((r) => r.id === target.id);
    if (index >= 0) {
      setTimeout(() => {
        try {
          routesListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
        } catch {}
      }, 250);
    }
    handleRoutePress(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouteNumber, routes, selectedParticipant]);

  const handleSubmitResult = async (completed: boolean) => {
    if (!selectedParticipant || !selectedRoute || !user || !competition) return;

    const attemptsNum = parseInt(attempts) || 1;
    if (attemptsNum < 1 || attemptsNum > (competition.settings.maxAttempts || 10)) {
      Alert.alert(t.common.error, t.competitionExt.attemptsError);
      return;
    }

    setIsSubmitting(true);

    // Determine if this is a self-report (Totemtition participant entering their own result)
    const isSelfReportMode = isTotemtition && isSelfReporter && !isJudge && 
                              selectedParticipant.userId === user.uid;
    // Also allow self-entry for Zone/Top formats if settings allow
    const isZoneTopSelfEntry = isZoneTop && !isJudge &&
                                competition.settings.resultsEntryMode === 'selfEntry' &&
                                selectedParticipant.userId === user.uid;

    try {
      // Build result data
      const resultData: any = {
        routeId: selectedRoute.id,
        grade: selectedRoute.grade,
        completed: isZoneTop ? (topAchieved || zoneAchieved) : completed,
        attempts: isZoneTop ? (parseInt(topAttempt) || parseInt(zoneAttempt) || attemptsNum) : (completed ? attemptsNum : 0),
      };

      // Add Zone/Top fields for applicable formats
      if (isZoneTop) {
        const topAtt = parseInt(topAttempt) || 1;
        let zoneAtt = parseInt(zoneAttempt) || 1;
        // Zone can't be after top — if topped on attempt X, zone must be ≤ X
        if (topAchieved && zoneAchieved && zoneAtt > topAtt) {
          zoneAtt = topAtt;
        }
        resultData.topAchieved = topAchieved;
        resultData.topAttempt = topAchieved ? topAtt : undefined;
        resultData.zoneAchieved = zoneAchieved;
        resultData.zoneAttempt = zoneAchieved ? zoneAtt : undefined;
        // Per-route scoring overrides (zone_top)
        if (selectedRoute.pointsTop !== undefined) {
          resultData.pointsTop = selectedRoute.pointsTop;
        }
        if (selectedRoute.pointsZone !== undefined) {
          resultData.pointsZone = selectedRoute.pointsZone;
        }
        // If top achieved but no zone recorded, auto-set zone = topAttempt
        if (topAchieved && !zoneAchieved) {
          resultData.zoneAchieved = true;
          resultData.zoneAttempt = resultData.topAttempt;
        }
        resultData.completed = topAchieved;
        resultData.attempts = topAchieved 
          ? (parseInt(topAttempt) || 1) 
          : (zoneAchieved ? (parseInt(zoneAttempt) || 1) : 0);
      }

      await ResultsService.enterRouteResult(
        competitionId,
        selectedParticipant.userId,
        selectedRoute.routeNumber,
        resultData,
        user.uid,
        isSelfReportMode || isZoneTopSelfEntry,
        competition
      );

      setShowResultModal(false);
      
      // Show feedback
      if (isZoneTop) {
        if (topAchieved) {
          Alert.alert(
            t.competitionExt.completedStatus,
            t.competitionExt.routeCompleted(getRouteLabel(selectedRoute.routeNumber))
          );
        }
      } else if (completed) {
        Alert.alert(
          t.competitionExt.completedStatus,
          t.competitionExt.routeCompleted(getRouteLabel(selectedRoute.routeNumber))
        );
      }
    } catch (error) {
      console.error('Error submitting result:', error);
      Alert.alert(t.common.error, t.competitionExt.cannotSaveScore);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveResult = async () => {
    if (!selectedParticipant || !selectedRoute) return;

    Alert.alert(
      'מחיקת תוצאה',
      'האם למחוק את התוצאה הזו?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await ResultsService.removeRouteResult(
                competitionId,
                selectedParticipant.userId,
                selectedRoute.id
              );
              setShowResultModal(false);
            } catch (error) {
              Alert.alert(t.common.error, t.alerts.resultDeleteFailed);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const findRouteResult = (routeId: string): RouteResult | undefined => {
    if (!participantResults?.routes) return undefined;
    const routes = participantResults.routes;
    if (Array.isArray(routes)) {
      return routes.find(r => r.routeId === routeId);
    } else {
      return Object.values(routes).find(r => r.routeId === routeId);
    }
  };

  const getRouteStatus = (route: CompetitionRoute) => {
    const result = findRouteResult(route.id);
    if (!result) return 'not_attempted';
    // For zone_top, zone-only also counts as attempted
    if (result.completed || result.topAchieved || result.zoneAchieved) return 'completed';
    return 'not_attempted';
  };

  const getRoutePoints = (route: CompetitionRoute) => {
    const result = findRouteResult(route.id);
    return result?.points ?? null;
  };

  const getRouteAttempts = (route: CompetitionRoute) => {
    const result = findRouteResult(route.id);
    return result?.attempts ?? null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t.competitionExt.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!canAccessScreen) {
    // Show different messages based on context
    const errorMessage = isTotemtition 
      ? 'יש להירשם ולקבל אישור כדי להזין תוצאות'
      : 'רק שופטים רשומים יכולים להזין תוצאות';
    
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>
            {t.competitionExt.noPermission}
          </Text>
          <Text style={styles.errorSubtext}>
            {t.competitionExt.onlyJudgesCanAccess}
          </Text>
          
          {/* Show registration button for Totemtition/National League if not registered */}
          {/* Show registration button if not registered */}
          {!isSelfReporter && (
            <TouchableOpacity
              style={[styles.backBtn, { marginTop: 16 }]}
              onPress={() => navigation.navigate('CompetitionRegistration', { competitionId })}
            >
              <Text style={styles.backBtnText}>{t.competitionExt.register}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.textSecondary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>{t.competitionExt.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Check if competition is active before allowing result entry
  // Only self-reporters (non-judges) are blocked before competition starts
  // Judges can still prepare/enter results before competition starts
  if (!isJudge && competition?.status !== 'active') {
    const statusMessages: Record<string, { title: string; message: string; icon: string }> = {
      draft: { 
        title: 'התחרות עדיין לא התחילה', 
        message: 'הרשמתך נקלטה! נודיע לך כשהתחרות תתחיל ותוכל להזין תוצאות.',
        icon: 'time-outline'
      },
      closed: { 
        title: 'התחרות סגורה', 
        message: 'התחרות סגורה להזנת תוצאות חדשות.',
        icon: 'lock-closed'
      },
      completed: { 
        title: 'התחרות הסתיימה', 
        message: 'התחרות הסתיימה. ניתן לצפות בתוצאות.',
        icon: 'trophy'
      },
    };
    
    const statusInfo = statusMessages[competition?.status || 'draft'] || statusMessages.draft;
    
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name={statusInfo.icon as any} size={64} color={theme.primary} />
          <Text style={styles.errorText}>{statusInfo.title}</Text>
          <Text style={styles.errorSubtext}>{statusInfo.message}</Text>
          
          {/* Show view results button for completed competitions */}
          {competition?.status === 'completed' && (
            <TouchableOpacity
              style={[styles.backBtn, { marginTop: 16 }]}
              onPress={() => navigation.navigate('ManageCompetition', { competitionId })}
            >
              <Text style={styles.backBtnText}>צפה בתוצאות</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.textSecondary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderParticipantItem = ({ item }: { item: Participant }) => {
    const isSelected = selectedParticipant?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.participantItem,
          isSelected && styles.participantItemSelected,
        ]}
        onPress={() => setSelectedParticipant(item)}
      >
        <CachedAvatar
          photoURL={item.photoURL}
          displayName={item.userName}
          size={32}
          showBorder={true}
        />
        <Text style={[
          styles.participantName,
          isSelected && styles.participantNameSelected,
        ]}>
          {item.userName}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderRouteItem = ({ item }: { item: CompetitionRoute }) => {
    const status = getRouteStatus(item);
    const result = findRouteResult(item.id);
    const points = getRoutePoints(item);
    const attempts = getRouteAttempts(item);
    const isTotemRoute = item.grade === 'TOTEM';
    const basePoints = isTotemRoute ? 1000 : (NATIONAL_LEAGUE_GRADE_POINTS[item.grade] || 100);
    const displayGrade = isTotemRoute ? '🎯' : item.grade;
    
    // Get the current participant's category for category-based completion counts
    const currentParticipant = selectedParticipant || selfParticipant;
    const participantCategory = currentParticipant?.category || '__no_category__';
    
    // For Totemtition routes, show actual completion count and calculated points (per category)
    let pointsLabel: string;
    let currentRoutePoints = 0;
    if (isTotemRoute) {
      // Get completion count for this route within the participant's category
      const categoryRouteCounts = routeCompletionCountsByCategory[participantCategory] || {};
      const completionCount = categoryRouteCounts[item.id] || 0;
      if (completionCount > 0) {
        currentRoutePoints = Math.floor(1000 / completionCount);
        pointsLabel = `1000÷${completionCount}`;
      } else {
        pointsLabel = '1000÷N';
      }
    } else if (isZoneTop) {
      // For zone_top, don't show base points as they're not meaningful to the user
      pointsLabel = '';
    } else {
      pointsLabel = `${basePoints} נק'`;
    }

    // Build zone/top result display for completed routes
    let resultDisplay: string | null = null;
    if (status === 'completed' && isZoneTop && result) {
      const t = result.topAchieved ? '1T' : '0T';
      const z = result.zoneAchieved ? '1z' : '0z';
      const ta = result.topAchieved ? (result.topAttempt || 1) : 0;
      const za = result.zoneAchieved ? (result.zoneAttempt || 1) : 0;
      resultDisplay = `${t}${z} ${ta} ${za}`;
    }

    const routeColor =
      (item.color ? getColorDisplayHex(item.color) : null) || '#3b82f6';

    return (
      <TouchableOpacity
        style={[
          styles.routeItem,
          status === 'completed' && styles.routeItemCompleted,
        ]}
        onPress={() => handleRoutePress(item)}
      >
        <View style={[styles.routeNumber, { backgroundColor: routeColor }]}>
          <Text style={[styles.routeNumberText, { color: getContrastTextColor(routeColor) }]}>
            {getRouteLabel(item.routeNumber)}
          </Text>
        </View>
        
        <View style={styles.routeInfo}>
          <Text style={styles.routeGrade}>{displayGrade}</Text>
          {pointsLabel !== '' && (
            <Text style={styles.routeBasePoints}>{pointsLabel}</Text>
          )}
          {isTotemRoute && currentRoutePoints > 0 && (
            <Text style={[styles.routeBasePoints, { color: theme.primary, fontWeight: 'bold' }]}>
              {currentRoutePoints}
            </Text>
          )}
        </View>

        {status === 'completed' ? (
          <View style={styles.routeResult}>
            {isZoneTop && resultDisplay ? (
              <Text style={styles.routePoints}>{resultDisplay}</Text>
            ) : (
              <>
                <Text style={styles.routePoints}>{isTotemRoute ? currentRoutePoints : points}</Text>
                <Text style={styles.routeAttempts}>{attempts} ניסיונות</Text>
              </>
            )}
          </View>
        ) : (
          <View style={styles.routeAction}>
            <Ionicons name="add-circle" size={28} color={theme.primary} />
          </View>
        )}
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>{t.competitionExt.resultsEntry}</Text>
        <View style={styles.placeholder}>
          {isHeadJudge && (
            <View style={styles.headBadge}>
              <Text style={styles.headBadgeText}>🏅</Text>
            </View>
          )}
        </View>
      </View>

      {/* Competition Info */}
      {competition && (
        <View style={styles.compInfo}>
          <Text style={styles.compName}>{competition.name}</Text>
          <Text style={styles.compStats}>
            {approvedParticipants.length} משתתפים • {routes.length} מסלולים
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Participants Panel - Hidden for self-reporters in Totemtition */}
        {(!isTotemtition || isJudge) && (
          <View style={styles.participantsPanel}>
            {/* Show categories list when categories exist and none selected */}
            {hasCategories && categories.length > 0 && !selectedCategoryId ? (
              <>
                <Text style={styles.panelTitle}>בחר קטגוריה</Text>
                <FlatList
                  data={categories}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const count = approvedParticipants.filter(p => p.category === item.id).length;
                    return (
                      <TouchableOpacity
                        style={styles.categoryItem}
                        onPress={() => {
                          setSelectedCategoryId(item.id);
                          setSelectedParticipant(null);
                          setSearchQuery('');
                        }}
                      >
                        <View style={styles.categoryItemContent}>
                          <Ionicons name="people" size={22} color={theme.primary} />
                          <Text style={styles.categoryItemName}>{item.name}</Text>
                        </View>
                        <View style={styles.categoryItemRight}>
                          <Text style={styles.categoryItemCount}>{count}</Text>
                          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>אין קטגוריות</Text>
                  }
                />
              </>
            ) : (
              <>
                {/* Show back to categories button if a category is selected */}
                {hasCategories && categories.length > 0 && selectedCategoryId && (
                  <TouchableOpacity
                    style={styles.backToCategoriesBtn}
                    onPress={() => {
                      setSelectedCategoryId(null);
                      setSelectedParticipant(null);
                      setSearchQuery('');
                    }}
                  >
                    <Ionicons name="arrow-forward" size={18} color={theme.primary} />
                    <Text style={styles.backToCategoriesText}>
                      {categories.find(c => c.id === selectedCategoryId)?.name || 'חזרה לקטגוריות'}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.panelTitle}>{t.competitionExt.selectParticipant}</Text>
                
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color={theme.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t.competitionExt.searchParticipant}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <FlatList
                  data={filteredParticipants}
                  keyExtractor={(item) => item.id}
                  renderItem={renderParticipantItem}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>{t.competitionExt.noParticipants}</Text>
                  }
                />
              </>
            )}
          </View>
        )}

        {/* Self-reporter info for Totemtition */}
        {isTotemtition && isSelfReporter && !isJudge && selfParticipant && (
          <View style={styles.selfReporterInfo}>
            <Text style={styles.selfReporterTitle}>{t.competitionExt.selfScoring}</Text>
            <Text style={styles.selfReporterName}>{selfParticipant.userName}</Text>
          </View>
        )}

        {/* Routes Panel */}
        <View style={styles.routesPanel}>
          {selectedParticipant ? (
            <>
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedName}>
                  {selectedParticipant.userName}
                </Text>
                {participantResults && (
                  <Text style={styles.selectedScore}>
                    {isZoneTop
                      ? (() => {
                          const allRoutes = participantResults.routes
                            ? (Array.isArray(participantResults.routes) ? participantResults.routes : Object.values(participantResults.routes))
                            : [];
                          let tops = 0, zones = 0, topAtt = 0, zoneAtt = 0;
                          allRoutes.forEach((r: RouteResult) => {
                            if (r.topAchieved) { tops++; topAtt += r.topAttempt || 1; }
                            if (r.zoneAchieved) { zones++; zoneAtt += r.zoneAttempt || 1; }
                          });
                          return formatIFSCResult(tops, zones, topAtt, zoneAtt);
                        })()
                      : isTotemtition
                      ? (() => {
                          // Totemtition points are dynamic; read the participant's total
                          // straight from the leaderboard so it always matches it exactly.
                          const entry = leaderboardEntries.find(
                            (e) =>
                              e.participantId === selectedParticipant.userId ||
                              e.userId === selectedParticipant.userId
                          );
                          const pts = entry?.points ?? entry?.totalPoints ?? 0;
                          return `סה"כ: ${pts} נק'`;
                        })()
                      : `סה"כ: ${participantResults.totalPoints} נק'`
                    }
                  </Text>
                )}
              </View>

              <FlatList
                ref={routesListRef}
                data={routes}
                keyExtractor={(item) => item.id}
                renderItem={renderRouteItem}
                showsVerticalScrollIndicator={false}
                numColumns={2}
                contentContainerStyle={styles.routesGrid}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    try {
                      routesListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.3 });
                    } catch {}
                  }, 300);
                }}
              />
            </>
          ) : (
            <View style={styles.noSelection}>
              <Ionicons name="hand-left" size={48} color={theme.textSecondary} />
              <Text style={styles.noSelectionText}>
                בחר משתתף מהרשימה
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Result Entry Modal */}
      <Modal
        visible={showResultModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedRoute ? getRouteLabel(selectedRoute.routeNumber) : t.competitionExt.routeLabel(0)}
              </Text>
              <TouchableOpacity onPress={() => setShowResultModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedRoute && (
              <>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalGrade}>
                    {selectedRoute.grade === 'TOTEM' ? 'TOTEM' : selectedRoute.grade}
                  </Text>
                  <Text style={styles.modalPoints}>
                    {selectedRoute.grade === 'TOTEM' 
                      ? t.competitionExt.totemBasePoints
                      : isZoneTop
                        ? `Zone / Top`
                        : t.competitionExt.basePointsInfo(NATIONAL_LEAGUE_GRADE_POINTS[selectedRoute.grade] || 100)
                    }
                  </Text>
                </View>

                {/* Zone/Top Entry Mode */}
                {isZoneTop ? (
                  <View style={styles.zoneTopSection}>
                    {/* Zone row */}
                    {hasZone && (
                      <View style={styles.zoneTopRow}>
                        <TouchableOpacity
                          style={[styles.zoneTopToggle, zoneAchieved && styles.zoneTopToggleActive]}
                          onPress={() => {
                            setZoneAchieved(!zoneAchieved);
                            if (!zoneAchieved && !topAchieved) setTopAchieved(false);
                          }}
                        >
                          <Ionicons 
                            name={zoneAchieved ? 'checkbox' : 'square-outline'} 
                            size={22} 
                            color={zoneAchieved ? '#10b981' : theme.textSecondary} 
                          />
                          <Text style={[styles.zoneTopToggleText, zoneAchieved && { color: '#10b981', fontWeight: 'bold' }]}>
                            Zone
                          </Text>
                        </TouchableOpacity>
                        {zoneAchieved && (
                          <View style={styles.zoneTopAttemptInput}>
                            <Text style={styles.zoneTopAttemptLabel}>{t.competitionExt.attemptNumberShort}</Text>
                            <View style={styles.attemptsControl}>
                              <TouchableOpacity
                                style={styles.attemptsBtn}
                                onPress={() => setZoneAttempt(String(Math.max(1, parseInt(zoneAttempt) - 1)))}
                              >
                                <Ionicons name="remove" size={20} color={theme.text} />
                              </TouchableOpacity>
                              <TextInput
                                style={styles.attemptsInput}
                                value={zoneAttempt}
                                onChangeText={setZoneAttempt}
                                keyboardType="number-pad"
                                textAlign="center"
                              />
                              <TouchableOpacity
                                style={styles.attemptsBtn}
                                onPress={() => {
                                const newVal = parseInt(zoneAttempt) + 1;
                                // Zone attempt can't exceed top attempt
                                if (topAchieved && newVal > (parseInt(topAttempt) || 1)) return;
                                setZoneAttempt(String(newVal));
                              }}
                              >
                                <Ionicons name="add" size={20} color={theme.text} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Top row */}
                    <View style={styles.zoneTopRow}>
                      <TouchableOpacity
                        style={[styles.zoneTopToggle, topAchieved && styles.zoneTopToggleActive]}
                        onPress={() => {
                          const newVal = !topAchieved;
                          setTopAchieved(newVal);
                          // If top achieved, auto-enable zone too
                          if (newVal && hasZone && !zoneAchieved) {
                            setZoneAchieved(true);
                          }
                          // Cap zone attempt to top attempt
                          if (newVal && hasZone) {
                            const tAtt = parseInt(topAttempt) || 1;
                            const zAtt = parseInt(zoneAttempt) || 1;
                            if (zAtt > tAtt) setZoneAttempt(String(tAtt));
                          }
                        }}
                      >
                        <Ionicons 
                          name={topAchieved ? 'checkbox' : 'square-outline'} 
                          size={22} 
                          color={topAchieved ? theme.primary : theme.textSecondary} 
                        />
                        <Text style={[styles.zoneTopToggleText, topAchieved && { color: theme.primary, fontWeight: 'bold' }]}>
                          Top
                        </Text>
                      </TouchableOpacity>
                      {topAchieved && (
                        <View style={styles.zoneTopAttemptInput}>
                          <Text style={styles.zoneTopAttemptLabel}>{t.competitionExt.attemptNumberShort}</Text>
                          <View style={styles.attemptsControl}>
                            <TouchableOpacity
                              style={styles.attemptsBtn}
                              onPress={() => {
                                const newVal = Math.max(1, parseInt(topAttempt) - 1);
                                setTopAttempt(String(newVal));
                                // Cap zone attempt if it exceeds new top attempt
                                if (zoneAchieved && parseInt(zoneAttempt) > newVal) {
                                  setZoneAttempt(String(newVal));
                                }
                              }}
                            >
                              <Ionicons name="remove" size={20} color={theme.text} />
                            </TouchableOpacity>
                            <TextInput
                              style={styles.attemptsInput}
                              value={topAttempt}
                              onChangeText={setTopAttempt}
                              keyboardType="number-pad"
                              textAlign="center"
                            />
                            <TouchableOpacity
                              style={styles.attemptsBtn}
                              onPress={() => setTopAttempt(String(parseInt(topAttempt) + 1))}
                            >
                              <Ionicons name="add" size={20} color={theme.text} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Save button for Zone/Top */}
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.successBtn]}
                        onPress={() => handleSubmitResult(true)}
                        disabled={isSubmitting || (!topAchieved && !zoneAchieved)}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="save" size={24} color="#fff" />
                            <Text style={styles.modalBtnText}>{t.competitionExt.saveResult}</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {getRouteStatus(selectedRoute) === 'completed' && (isHeadJudge || selectedParticipant?.userId === user?.uid) && (
                        <TouchableOpacity
                          style={[styles.modalBtn, styles.dangerBtn]}
                          onPress={handleRemoveResult}
                          disabled={isSubmitting}
                        >
                          <Ionicons name="trash" size={20} color="#fff" />
                          <Text style={styles.modalBtnText}>{t.competitionExt.deleteResult}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  /* Standard entry mode (national_league, totemtition, custom) */
                  <>
                    <View style={styles.attemptsSection}>
                      <Text style={styles.attemptsLabel}>{t.competitionExt.attemptsLabel}</Text>
                      <View style={styles.attemptsControl}>
                        <TouchableOpacity
                          style={styles.attemptsBtn}
                          onPress={() => setAttempts(String(Math.max(1, parseInt(attempts) - 1)))}
                        >
                          <Ionicons name="remove" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.attemptsInput}
                          value={attempts}
                          onChangeText={setAttempts}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <TouchableOpacity
                          style={styles.attemptsBtn}
                          onPress={() => setAttempts(String(parseInt(attempts) + 1))}
                        >
                          <Ionicons name="add" size={24} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.successBtn]}
                        onPress={() => handleSubmitResult(true)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={24} color="#fff" />
                            <Text style={styles.modalBtnText}>{t.competitionExt.completed}</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {getRouteStatus(selectedRoute) === 'completed' && (isHeadJudge || selectedParticipant?.userId === user?.uid) && (
                        <TouchableOpacity
                          style={[styles.modalBtn, styles.dangerBtn]}
                          onPress={handleRemoveResult}
                          disabled={isSubmitting}
                        >
                          <Ionicons name="trash" size={20} color="#fff" />
                          <Text style={styles.modalBtnText}>{t.competitionExt.deleteResult}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
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
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
    },
    errorSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    backBtn: {
      backgroundColor: theme.buttonPrimary,
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
    },
    placeholder: {
      width: 32,
      alignItems: 'center',
    },
    headBadge: {
      backgroundColor: '#f39c1230',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    headBadgeText: {
      fontSize: 14,
    },
    compInfo: {
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    compName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    compStats: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 2,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
    },
    participantsPanel: {
      width: '35%',
      backgroundColor: theme.surface,
      borderEndWidth: 1,
      borderEndColor: theme.border,
      padding: 8,
    },
    panelTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    // Category selection styles
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 6,
    },
    categoryItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    categoryItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    categoryItemRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    categoryItemCount: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    backToCategoriesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginBottom: 4,
    },
    backToCategoriesText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '600',
    },
    // Self-reporter info for Totemtition
    selfReporterInfo: {
      backgroundColor: theme.primary + '15',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    selfReporterTitle: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
      marginBottom: 4,
    },
    selfReporterName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 8,
      paddingHorizontal: 8,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 12,
      color: theme.text,
    },
    participantItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 8,
      marginBottom: 4,
      gap: 8,
    },
    participantItemSelected: {
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    participantAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    participantAvatarText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    participantName: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
    },
    participantNameSelected: {
      fontWeight: 'bold',
      color: theme.primary,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: 12,
      paddingTop: 20,
    },
    routesPanel: {
      flex: 1,
      padding: 8,
    },
    selectedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    selectedName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    selectedScore: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.primary,
    },
    noSelection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noSelectionText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 12,
    },
    routesGrid: {
      paddingBottom: 100,
    },
    routeItem: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      margin: 4,
      alignItems: 'center',
    },
    routeItemCompleted: {
      backgroundColor: theme.isDark ? 'rgba(39, 174, 96, 0.2)' : 'rgba(39, 174, 96, 0.1)',
      borderWidth: 1,
      borderColor: '#27ae60',
    },
    routeNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    routeNumberText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    routeInfo: {
      alignItems: 'center',
    },
    routeGrade: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text,
    },
    routeBasePoints: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    routeResult: {
      alignItems: 'center',
      marginTop: 8,
    },
    routePoints: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#27ae60',
    },
    routeAttempts: {
      fontSize: 10,
      color: theme.textSecondary,
    },
    routeAction: {
      marginTop: 8,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
    modalInfo: {
      alignItems: 'center',
      marginBottom: 24,
    },
    modalGrade: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.primary,
    },
    modalPoints: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    attemptsSection: {
      marginBottom: 24,
    },
    attemptsLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    attemptsControl: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    attemptsBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    attemptsInput: {
      width: 80,
      height: 56,
      backgroundColor: theme.card,
      borderRadius: 12,
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.text,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    successBtn: {
      backgroundColor: '#27ae60',
    },
    dangerBtn: {
      backgroundColor: '#e74c3c',
      flex: 0.4,
    },
    modalBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Zone/Top styles
    zoneTopSection: {
      gap: 16,
      marginBottom: 16,
    },
    zoneTopRow: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    zoneTopToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    zoneTopToggleActive: {
      // styling handled inline
    },
    zoneTopToggleText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    zoneTopAttemptInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingStart: 30,
    },
    zoneTopAttemptLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
  });
