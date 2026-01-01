/**
 * @fileoverview Manage Competition Routes Screen
 * @description Add and manage routes for a competition
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  useCompetition,
  useCompetitionRoutes,
} from '@/features/competitions/hooks/useCompetition';
import { CompetitionRoutesService } from '@/features/competitions/services/CompetitionRoutesService';
import { CompetitionRoute } from '@/features/competitions/types';
import { NATIONAL_LEAGUE_GRADE_POINTS } from '@/features/competitions/constants';

const AVAILABLE_GRADES = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
  '4', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '6c+',
  '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b',
];

export default function ManageCompetitionRoutesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const { user } = useAuth();

  const { competition, loading: compLoading } = useCompetition(competitionId);
  const { routes, loading: routesLoading, refresh } = useCompetitionRoutes(competitionId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newRouteNumber, setNewRouteNumber] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('V3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = createStyles(theme);

  const loading = compLoading || routesLoading;

  const handleAddRoute = async () => {
    if (!newRouteNumber.trim() || !user) {
      Alert.alert('שגיאה', 'יש להזין מספר מסלול');
      return;
    }

    const routeNum = parseInt(newRouteNumber);
    if (isNaN(routeNum) || routeNum < 1) {
      Alert.alert('שגיאה', 'מספר מסלול לא תקין');
      return;
    }

    // Check if route number already exists
    if (routes.some(r => r.routeNumber === routeNum)) {
      Alert.alert('שגיאה', 'מסלול עם מספר זה כבר קיים');
      return;
    }

    setIsSubmitting(true);
    try {
      await CompetitionRoutesService.addRoute(
        competitionId, 
        {
          number: routeNum,
          grade: selectedGrade,
          xNorm: 0,
          yNorm: 0,
        },
        user.uid
      );

      setShowAddModal(false);
      setNewRouteNumber('');
      refresh();
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן להוסיף את המסלול');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMultipleRoutes = async () => {
    if (!competition || !user) return;

    Alert.alert(
      'הוספת מסלולים',
      `להוסיף ${competition.settings.maxRoutes} מסלולים (V0-V8)?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const grades = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'];
              
              for (let i = 1; i <= competition.settings.maxRoutes; i++) {
                // Assign grades in a balanced way
                const gradeIndex = Math.min(Math.floor((i - 1) / (competition.settings.maxRoutes / grades.length)), grades.length - 1);
                const grade = grades[gradeIndex];
                
                if (!routes.some(r => r.routeNumber === i)) {
                  await CompetitionRoutesService.addRoute(
                    competitionId, 
                    {
                      number: i,
                      grade,
                      xNorm: 0,
                      yNorm: 0,
                    },
                    user.uid
                  );
                }
              }
              
              refresh();
              Alert.alert('הצלחה', 'המסלולים נוספו בהצלחה');
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן להוסיף את המסלולים');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteRoute = (routeToDelete: CompetitionRoute) => {
    Alert.alert(
      'מחיקת מסלול',
      `האם למחוק את מסלול ${routeToDelete.routeNumber}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await CompetitionRoutesService.deleteRoute(competitionId, routeToDelete.id);
              refresh();
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן למחוק את המסלול');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllRoutes = () => {
    Alert.alert(
      'מחיקת כל המסלולים',
      'האם אתה בטוח? פעולה זו לא ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק הכל',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              for (const r of routes) {
                await CompetitionRoutesService.deleteRoute(competitionId, r.id);
              }
              refresh();
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן למחוק את המסלולים');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderRouteItem = ({ item }: { item: CompetitionRoute }) => {
    const points = NATIONAL_LEAGUE_GRADE_POINTS[item.grade] || 100;
    
    return (
      <View style={styles.routeItem}>
        <View style={styles.routeNumber}>
          <Text style={styles.routeNumberText}>{item.routeNumber}</Text>
        </View>
        <View style={styles.routeInfo}>
          <Text style={styles.routeGrade}>{item.grade}</Text>
          <Text style={styles.routePoints}>{points} נקודות</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteRoute(item)}
        >
          <Ionicons name="trash-outline" size={20} color={theme.error || '#e74c3c'} />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
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
        <Text style={styles.headerTitle}>🗺️ מסלולי תחרות</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{routes.length}</Text>
          <Text style={styles.statLabel}>מסלולים</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {competition?.settings.maxRoutes || 30}
          </Text>
          <Text style={styles.statLabel}>מקסימום</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>הוסף מסלול</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bulkBtn}
          onPress={handleAddMultipleRoutes}
        >
          <Ionicons name="copy" size={18} color={theme.primary} />
          <Text style={styles.bulkBtnText}>הוסף מרובים</Text>
        </TouchableOpacity>

        {routes.length > 0 && (
          <TouchableOpacity
            style={styles.deleteAllBtn}
            onPress={handleDeleteAllRoutes}
          >
            <Ionicons name="trash" size={18} color="#e74c3c" />
          </TouchableOpacity>
        )}
      </View>

      {/* Routes List */}
      <FlatList
        data={routes.sort((a, b) => a.routeNumber - b.routeNumber)}
        keyExtractor={(item) => item.id}
        renderItem={renderRouteItem}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyText}>אין מסלולים עדיין</Text>
            <Text style={styles.emptySubtext}>
              הוסף מסלולים לתחרות
            </Text>
          </View>
        }
      />

      {/* Loading overlay */}
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>מעבד...</Text>
        </View>
      )}

      {/* Add Route Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>הוספת מסלול</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>מספר מסלול</Text>
              <TextInput
                style={styles.input}
                value={newRouteNumber}
                onChangeText={setNewRouteNumber}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={theme.textSecondary}
                textAlign="center"
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>דרגת קושי</Text>
              <View style={styles.gradesGrid}>
                {['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'].map((grade) => (
                  <TouchableOpacity
                    key={grade}
                    style={[
                      styles.gradeOption,
                      selectedGrade === grade && styles.gradeOptionSelected,
                    ]}
                    onPress={() => setSelectedGrade(grade)}
                  >
                    <Text style={[
                      styles.gradeOptionText,
                      selectedGrade === grade && styles.gradeOptionTextSelected,
                    ]}>
                      {grade}
                    </Text>
                    <Text style={styles.gradePoints}>
                      {NATIONAL_LEAGUE_GRADE_POINTS[grade]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddRoute}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>הוסף מסלול</Text>
              )}
            </TouchableOpacity>
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
    statsBar: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      padding: 12,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      padding: 16,
      gap: 8,
    },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 6,
    },
    addBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    bulkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    bulkBtnText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    deleteAllBtn: {
      backgroundColor: '#e74c3c20',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#e74c3c',
    },
    listContent: {
      padding: 8,
      paddingBottom: 100,
    },
    routeItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      margin: 4,
    },
    routeNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    routeNumberText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    routeInfo: {
      flex: 1,
      marginLeft: 12,
    },
    routeGrade: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    routePoints: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    deleteBtn: {
      padding: 8,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
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
      textAlign: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: '#fff',
      marginTop: 12,
      fontSize: 14,
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
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
    inputSection: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'right',
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
    },
    gradesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    gradeOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    gradeOptionSelected: {
      backgroundColor: theme.primary,
    },
    gradeOptionText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    gradeOptionTextSelected: {
      color: '#fff',
    },
    gradePoints: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 2,
    },
    submitBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
