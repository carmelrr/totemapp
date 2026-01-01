/**
 * @fileoverview Judge Entry Screen
 * @description Screen for judges to enter competition results
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  useCompetition,
  useParticipants,
  useIsJudge,
  useCompetitionRoutes,
} from '@/features/competitions/hooks/useCompetition';
import { ResultsService } from '@/features/competitions/services/ResultsService';
import {
  Participant,
  CompetitionRoute,
  ParticipantResult,
  RouteResult,
} from '@/features/competitions/types';
import { NATIONAL_LEAGUE_GRADE_POINTS } from '@/features/competitions/constants';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/features/data/firebase';

export default function JudgeEntryScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const { user } = useAuth();

  const { competition, loading: compLoading } = useCompetition(competitionId);
  const { participants, loading: partsLoading } = useParticipants(competitionId);
  const { routes, loading: routesLoading } = useCompetitionRoutes(competitionId);
  const { isJudge, isHeadJudge, loading: judgeLoading } = useIsJudge(competitionId, user?.uid);

  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [participantResults, setParticipantResults] = useState<ParticipantResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<CompetitionRoute | null>(null);
  const [attempts, setAttempts] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme);

  const loading = compLoading || partsLoading || routesLoading || judgeLoading;

  // Filter approved participants
  const approvedParticipants = participants.filter(p => p.status === 'approved');

  // Search filter
  const filteredParticipants = searchQuery
    ? approvedParticipants.filter(p => 
        p.userName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : approvedParticipants;

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
          routes: data.routes || [],
          totalPoints: data.totalPoints || 0,
          totalAttempts: data.totalAttempts || 0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          updatedBy: data.updatedBy,
        });
      } else {
        setParticipantResults({
          participantId: selectedParticipant.userId,
          competitionId,
          routes: [],
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
    } else {
      setAttempts('1');
    }
    
    setShowResultModal(true);
  };

  const handleSubmitResult = async (completed: boolean) => {
    if (!selectedParticipant || !selectedRoute || !user || !competition) return;

    const attemptsNum = parseInt(attempts) || 1;
    if (attemptsNum < 1 || attemptsNum > (competition.settings.maxAttempts || 10)) {
      Alert.alert('שגיאה', `מספר ניסיונות חייב להיות בין 1 ל-${competition.settings.maxAttempts || 10}`);
      return;
    }

    setIsSubmitting(true);

    try {
      await ResultsService.enterRouteResult(
        competitionId,
        selectedParticipant.userId,
        selectedRoute.routeNumber,
        {
          routeId: selectedRoute.id,
          grade: selectedRoute.grade,
          completed,
          attempts: completed ? attemptsNum : 0,
        },
        user.uid
      );

      setShowResultModal(false);
      
      // Show feedback
      if (completed) {
        Alert.alert(
          '✅ נרשם!',
          `${selectedParticipant.userName} השלים את מסלול ${selectedRoute.routeNumber} ב-${attemptsNum} ניסיונות`
        );
      }
    } catch (error) {
      console.error('Error submitting result:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את התוצאה');
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
              Alert.alert('שגיאה', 'לא ניתן למחוק את התוצאה');
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
    return result.completed ? 'completed' : 'not_attempted';
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>טוען...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isJudge) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>אין לך הרשאות שופט</Text>
          <Text style={styles.errorSubtext}>
            רק שופטים רשומים יכולים להזין תוצאות
          </Text>
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
        <View style={styles.participantAvatar}>
          <Text style={styles.participantAvatarText}>
            {item.userName.charAt(0).toUpperCase()}
          </Text>
        </View>
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
    const points = getRoutePoints(item);
    const attempts = getRouteAttempts(item);
    const basePoints = NATIONAL_LEAGUE_GRADE_POINTS[item.grade] || 100;

    return (
      <TouchableOpacity
        style={[
          styles.routeItem,
          status === 'completed' && styles.routeItemCompleted,
        ]}
        onPress={() => handleRoutePress(item)}
      >
        <View style={styles.routeNumber}>
          <Text style={styles.routeNumberText}>{item.routeNumber}</Text>
        </View>
        
        <View style={styles.routeInfo}>
          <Text style={styles.routeGrade}>{item.grade}</Text>
          <Text style={styles.routeBasePoints}>{basePoints} נק'</Text>
        </View>

        {status === 'completed' ? (
          <View style={styles.routeResult}>
            <Text style={styles.routePoints}>{points}</Text>
            <Text style={styles.routeAttempts}>{attempts} ניסיונות</Text>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📝 הזנת תוצאות</Text>
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
        {/* Participants Panel */}
        <View style={styles.participantsPanel}>
          <Text style={styles.panelTitle}>בחר משתתף</Text>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="חפש..."
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />
          </View>

          <FlatList
            data={filteredParticipants}
            keyExtractor={(item) => item.id}
            renderItem={renderParticipantItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>אין משתתפים</Text>
            }
          />
        </View>

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
                    סה"כ: {participantResults.totalPoints} נק'
                  </Text>
                )}
              </View>

              <FlatList
                data={routes}
                keyExtractor={(item) => item.id}
                renderItem={renderRouteItem}
                showsVerticalScrollIndicator={false}
                numColumns={2}
                contentContainerStyle={styles.routesGrid}
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
                מסלול {selectedRoute?.routeNumber}
              </Text>
              <TouchableOpacity onPress={() => setShowResultModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedRoute && (
              <>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalGrade}>{selectedRoute.grade}</Text>
                  <Text style={styles.modalPoints}>
                    {NATIONAL_LEAGUE_GRADE_POINTS[selectedRoute.grade] || 100} נקודות בסיס
                  </Text>
                </View>

                <View style={styles.attemptsSection}>
                  <Text style={styles.attemptsLabel}>מספר ניסיונות</Text>
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
                        <Text style={styles.modalBtnText}>✓ השלים</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {getRouteStatus(selectedRoute) === 'completed' && isHeadJudge && (
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.dangerBtn]}
                      onPress={handleRemoveResult}
                      disabled={isSubmitting}
                    >
                      <Ionicons name="trash" size={20} color="#fff" />
                      <Text style={styles.modalBtnText}>מחק</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
      borderRightWidth: 1,
      borderRightColor: theme.border,
      padding: 8,
    },
    panelTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
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
  });
