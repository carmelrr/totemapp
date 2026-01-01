/**
 * @fileoverview Manage Participants Screen (Admin)
 * @description Add and manage competition participants
 */

import React, { useState, useEffect } from 'react';
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
  useParticipants,
  useCompetition,
} from '@/features/competitions/hooks/useCompetition';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { Participant } from '@/features/competitions/types';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/features/data/firebase';

interface UserSearchResult {
  id: string;
  displayName: string;
  email?: string;
  photoURL?: string;
}

export default function ManageParticipantsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;

  const { competition } = useCompetition(competitionId);
  const { participants, loading, refresh } = useParticipants(competitionId);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const styles = createStyles(theme);

  const categories = competition?.categories || [];

  // Search users
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search by displayName
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
        // Exclude users already in participants
        if (!participants.some(p => p.userId === doc.id)) {
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

  const handleAddParticipant = async (user: UserSearchResult) => {
    try {
      await ParticipantService.addParticipant(competitionId, {
        userId: user.id,
        userName: user.displayName,
        category: selectedCategory,
      });
      
      setSearchQuery('');
      setSearchResults([]);
      refresh();
      
      Alert.alert('הצלחה', `${user.displayName} נוסף לתחרות`);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן להוסיף את המשתתף');
    }
  };

  const handleRemoveParticipant = (participant: Participant) => {
    Alert.alert(
      'הסרת משתתף',
      `האם להסיר את ${participant.userName} מהתחרות?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: async () => {
            try {
              await ParticipantService.removeParticipant(competitionId, participant.id);
              refresh();
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן להסיר את המשתתף');
            }
          },
        },
      ]
    );
  };

  const handleUpdateStatus = async (participant: Participant, status: 'approved' | 'pending' | 'rejected') => {
    try {
      await ParticipantService.updateParticipantStatus(competitionId, participant.id, status);
      refresh();
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן את הסטטוס');
    }
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleAddParticipant(item)}
    >
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
      <Ionicons name="add-circle" size={28} color={theme.primary} />
    </TouchableOpacity>
  );

  const renderParticipant = ({ item }: { item: Participant }) => (
    <View style={styles.participantItem}>
      <View style={styles.participantInfo}>
        <View style={styles.participantHeader}>
          <Text style={styles.participantName}>{item.userName}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'approved' ? '#27ae60' : 
              item.status === 'rejected' ? '#e74c3c' : '#f39c12' }
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'approved' ? 'מאושר' : 
               item.status === 'rejected' ? 'נדחה' : 'ממתין'}
            </Text>
          </View>
        </View>
        
        {item.category && (
          <Text style={styles.participantCategory}>
            קטגוריה: {categories.find(c => c.id === item.category)?.name || item.category}
          </Text>
        )}
        
        <Text style={styles.participantDate}>
          נרשם: {item.registeredAt.toLocaleDateString('he-IL')}
        </Text>
      </View>

      <View style={styles.participantActions}>
        {item.status !== 'approved' && (
          <TouchableOpacity
            style={[styles.actionIcon, { backgroundColor: '#27ae60' }]}
            onPress={() => handleUpdateStatus(item, 'approved')}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {item.status !== 'rejected' && (
          <TouchableOpacity
            style={[styles.actionIcon, { backgroundColor: '#e74c3c' }]}
            onPress={() => handleRemoveParticipant(item)}
          >
            <Ionicons name="trash" size={18} color="#fff" />
          </TouchableOpacity>
        )}
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
        <Text style={styles.headerTitle}>ניהול משתתפים</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="חפש משתמשים להוספה..."
            placeholderTextColor={theme.textSecondary}
            textAlign="right"
          />
          {isSearching && <ActivityIndicator size="small" color={theme.primary} />}
        </View>

        {/* Category Filter */}
        {categories.length > 0 && (
          <View style={styles.categoryFilter}>
            <Text style={styles.filterLabel}>קטגוריה להרשמה:</Text>
            <View style={styles.categoryTags}>
              <TouchableOpacity
                style={[
                  styles.categoryTag,
                  !selectedCategory && styles.categoryTagActive,
                ]}
                onPress={() => setSelectedCategory(undefined)}
              >
                <Text style={[
                  styles.categoryTagText,
                  !selectedCategory && styles.categoryTagTextActive,
                ]}>
                  ללא
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryTag,
                    selectedCategory === cat.id && styles.categoryTagActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={[
                    styles.categoryTagText,
                    selectedCategory === cat.id && styles.categoryTagTextActive,
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{participants.length}</Text>
          <Text style={styles.statLabel}>סה"כ</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {participants.filter(p => p.status === 'approved').length}
          </Text>
          <Text style={styles.statLabel}>מאושרים</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {participants.filter(p => p.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>ממתינים</Text>
        </View>
      </View>

      {/* Participants List */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipant}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
              <Text style={styles.emptyText}>אין משתתפים עדיין</Text>
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
    categoryFilter: {
      marginTop: 12,
    },
    filterLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 8,
      textAlign: 'right',
    },
    categoryTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryTag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryTagActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryTagText: {
      fontSize: 12,
      color: theme.text,
    },
    categoryTagTextActive: {
      color: '#fff',
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
      fontSize: 20,
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
    participantItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    participantInfo: {
      flex: 1,
    },
    participantHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
      marginBottom: 4,
    },
    participantName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    statusText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
    },
    participantCategory: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
    },
    participantDate: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 2,
    },
    participantActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
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
