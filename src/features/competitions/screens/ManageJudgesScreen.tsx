/**
 * @fileoverview Manage Judges Screen (Admin)
 * @description Add and manage competition judges
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import {
  useJudges,
  useCompetition,
} from '@/features/competitions/hooks/useCompetition';
import { JudgeService } from '@/features/competitions/services/JudgeService';
import { Judge } from '@/features/competitions/types';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/features/data/firebase';

interface UserSearchResult {
  id: string;
  displayName: string;
  email?: string;
  photoURL?: string;
}

export default function ManageJudgesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;

  const { competition } = useCompetition(competitionId);
  const { judges, loading, refresh } = useJudges(competitionId);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const styles = createStyles(theme);

  // Search users
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('displayName', '>=', text),
        where('displayName', '<=', text + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      
      const results: UserSearchResult[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Exclude users already judges
        if (!judges.some(j => j.userId === doc.id)) {
          results.push({
            id: doc.id,
            displayName: data.displayName || data.email || 'משתמש',
            email: data.email,
            photoURL: data.photoURL,
          });
        }
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddJudge = async (user: UserSearchResult, role: 'judge' | 'head_judge' = 'judge') => {
    try {
      await JudgeService.addJudge(
        competitionId,
        user.id,
        user.displayName,
        'admin', // addedBy - TODO: get current user
        user.email
      );
      
      // Update role if head_judge
      if (role === 'head_judge') {
        await JudgeService.updateJudgeRole(competitionId, user.id, 'head_judge');
      }
      
      setSearchQuery('');
      setSearchResults([]);
      refresh();
      
      Alert.alert('הצלחה', `${user.displayName} נוסף כשופט`);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן להוסיף את השופט');
    }
  };

  const handleRemoveJudge = (judge: Judge) => {
    Alert.alert(
      'הסרת שופט',
      `האם להסיר את ${judge.userName} מרשימת השופטים?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: async () => {
            try {
              await JudgeService.removeJudge(competitionId, judge.id);
              refresh();
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן להסיר את השופט');
            }
          },
        },
      ]
    );
  };

  const handlePromoteToHead = async (judge: Judge) => {
    try {
      await JudgeService.updateJudgeRole(competitionId, judge.id, 'head_judge');
      refresh();
      Alert.alert('הצלחה', `${judge.userName} קודם לשופט ראשי`);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן את התפקיד');
    }
  };

  const handleDemoteFromHead = async (judge: Judge) => {
    try {
      await JudgeService.updateJudgeRole(competitionId, judge.id, 'judge');
      refresh();
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן את התפקיד');
    }
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <View style={styles.searchResultItem}>
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {item.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.userName}>{item.displayName}</Text>
          {item.email && (
            <Text style={styles.userEmail}>{item.email}</Text>
          )}
        </View>
      </View>
      <View style={styles.addButtons}>
        <TouchableOpacity
          style={[styles.addBtn, styles.addBtnPrimary]}
          onPress={() => handleAddJudge(item, 'judge')}
        >
          <Text style={styles.addBtnText}>שופט</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addBtn, styles.addBtnSecondary]}
          onPress={() => handleAddJudge(item, 'head_judge')}
        >
          <Text style={styles.addBtnTextSecondary}>ראשי</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderJudge = ({ item }: { item: Judge }) => (
    <View style={styles.judgeItem}>
      <View style={styles.judgeInfo}>
        <View style={[
          styles.judgeAvatar,
          item.role === 'head_judge' && styles.headJudgeAvatar,
        ]}>
          <Ionicons 
            name={item.role === 'head_judge' ? 'shield' : 'person'} 
            size={20} 
            color="#fff" 
          />
        </View>
        <View style={styles.judgeDetails}>
          <View style={styles.judgeHeader}>
            <Text style={styles.judgeName}>{item.userName}</Text>
            {item.role === 'head_judge' && (
              <View style={styles.headBadge}>
                <Text style={styles.headBadgeText}>🏅 ראשי</Text>
              </View>
            )}
          </View>
          <Text style={styles.judgeDate}>
            הוסף: {item.addedAt.toLocaleDateString('he-IL')}
          </Text>
        </View>
      </View>

      <View style={styles.judgeActions}>
        {item.role !== 'head_judge' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.promoteBtn]}
            onPress={() => handlePromoteToHead(item)}
          >
            <Ionicons name="arrow-up" size={16} color="#27ae60" />
          </TouchableOpacity>
        )}
        {item.role === 'head_judge' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.demoteBtn]}
            onPress={() => handleDemoteFromHead(item)}
          >
            <Ionicons name="arrow-down" size={16} color="#f39c12" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, styles.removeBtn]}
          onPress={() => handleRemoveJudge(item)}
        >
          <Ionicons name="trash" size={16} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>ניהול שופטים</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={theme.primary} />
        <Text style={styles.infoText}>
          שופטים יכולים להזין תוצאות לתחרות. שופט ראשי יכול גם לערוך ולמחוק תוצאות.
        </Text>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="חפש משתמשים להוספה כשופטים..."
            placeholderTextColor={theme.textSecondary}
            textAlign="right"
          />
          {isSearching && <ActivityIndicator size="small" color={theme.primary} />}
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            <Text style={styles.searchResultsTitle}>
              תוצאות חיפוש ({searchResults.length})
            </Text>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{judges.length}</Text>
          <Text style={styles.statLabel}>סה"כ שופטים</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {judges.filter(j => j.role === 'head_judge').length}
          </Text>
          <Text style={styles.statLabel}>שופטים ראשיים</Text>
        </View>
      </View>

      {/* Judges List */}
      <FlatList
        data={judges}
        keyExtractor={(item) => item.id}
        renderItem={renderJudge}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={64} color={theme.textSecondary} />
              <Text style={styles.emptyText}>אין שופטים עדיין</Text>
              <Text style={styles.emptySubtext}>
                חפש משתמשים בשורת החיפוש להוספה
              </Text>
            </View>
          )
        }
      />
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
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
      margin: 16,
      padding: 12,
      borderRadius: 12,
      gap: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      textAlign: 'right',
      lineHeight: 18,
    },
    searchSection: {
      backgroundColor: theme.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 14,
      color: theme.text,
    },
    searchResults: {
      marginTop: 16,
    },
    searchResultsTitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 8,
      textAlign: 'right',
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    userAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userAvatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    userName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    userEmail: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    addButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    addBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    addBtnPrimary: {
      backgroundColor: theme.primary,
    },
    addBtnSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    addBtnText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    addBtnTextSecondary: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: 'bold',
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
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    judgeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    judgeInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    judgeAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headJudgeAvatar: {
      backgroundColor: '#f39c12',
    },
    judgeDetails: {
      flex: 1,
    },
    judgeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    judgeName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    headBadge: {
      backgroundColor: '#f39c1220',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    headBadgeText: {
      fontSize: 11,
      color: '#f39c12',
      fontWeight: 'bold',
    },
    judgeDate: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    judgeActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    promoteBtn: {
      borderWidth: 1,
      borderColor: '#27ae60',
    },
    demoteBtn: {
      borderWidth: 1,
      borderColor: '#f39c12',
    },
    removeBtn: {
      borderWidth: 1,
      borderColor: '#e74c3c',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
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
  });
