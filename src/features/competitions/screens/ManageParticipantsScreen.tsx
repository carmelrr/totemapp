/**
 * @fileoverview Manage Participants Screen (Admin)
 * @description Add and manage competition participants
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import { useLanguage } from '@/features/language';
import {
  useParticipants,
  useCompetition,
} from '@/features/competitions/hooks/useCompetition';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { Participant, Category } from '@/features/competitions/types';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { CachedAvatar } from '@/components/ui/CachedAvatar';

interface UserSearchResult {
  id: string;
  displayName: string;
  email?: string;
  photoURL?: string;
}

export default function ManageParticipantsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const rolesContext = useRolesContext();

  const { competition } = useCompetition(competitionId);
  const { participants, loading, refresh } = useParticipants(competitionId);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  
  // Category assignment modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [participantToAssign, setParticipantToAssign] = useState<Participant | null>(null);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);

  // Load categories for the competition
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await ParticipantService.getCategories(competitionId);
        setCategoriesList(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, [competitionId]);

  // Check if user has permission to manage participants
  if (!rolesContext.canManageParticipants) {
    return (
      <SafeAreaView style={createStyles(theme).container} edges={['top', 'bottom']}>
        <View style={createStyles(theme).header}>
          <TouchableOpacity
            style={createStyles(theme).backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-forward" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={createStyles(theme).headerTitle}>{t.competitionExt.manageParticipants}</Text>
          <View style={createStyles(theme).placeholder} />
        </View>
        <View style={createStyles(theme).errorContainer}>
          <Ionicons name="lock-closed" size={64} color={theme.error || '#e74c3c'} />
          <Text style={createStyles(theme).errorText}>{t.competitionExt.noPermission}</Text>
          <Text style={createStyles(theme).errorSubtext}>
            {t.competitionExt.onlyJudgesCanManage}
          </Text>
          <TouchableOpacity
            style={createStyles(theme).backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={createStyles(theme).backBtnText}>{t.competitionExt.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const styles = createStyles(theme);

  const categories = competition?.categories || [];

  // Memoized stats to avoid recalculating on every render
  const stats = useMemo(() => ({
    total: participants.length,
    approved: participants.filter(p => p.status === 'approved').length,
    pending: participants.filter(p => p.status === 'pending' || p.status === 'pending_approval').length,
  }), [participants]);

  // Search users (case-insensitive by running multiple queries)
  const handleSearch = useCallback(async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const usersRef = collection(db, 'users');

      // Build case variants to search: original, lowercase, and capitalized
      const variants = new Set<string>();
      variants.add(text);
      variants.add(text.toLowerCase());
      variants.add(text.charAt(0).toUpperCase() + text.slice(1).toLowerCase());

      // Run queries for each variant in parallel
      const queryPromises = Array.from(variants).map(variant => {
        const q = query(
          usersRef,
          where('displayName', '>=', variant),
          where('displayName', '<=', variant + '\uf8ff'),
          limit(10)
        );
        return getDocs(q);
      });

      const snapshots = await Promise.all(queryPromises);

      // Merge results, deduplicate by doc ID
      const seen = new Set<string>();
      const results: UserSearchResult[] = [];
      for (const snapshot of snapshots) {
        snapshot.forEach((doc) => {
          if (seen.has(doc.id)) return;
          seen.add(doc.id);
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
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  }, [participants]);

  const handleAddParticipant = useCallback(async (user: UserSearchResult) => {
    // Prevent double-clicks
    if (isAddingParticipant) return;
    
    setIsAddingParticipant(true);
    try {
      await ParticipantService.addParticipant(competitionId, {
        userId: user.id,
        userName: user.displayName,
        category: selectedCategory,
      });
      
      setSearchQuery('');
      setSearchResults([]);
      // No need to call refresh() - realtime subscription handles updates
      
      Alert.alert(t.common.success, `${user.displayName} ${t.competitionExt.participantApproved}`);
    } catch (error: any) {
      const errorMessage = error?.message || t.competitionExt.cannotApproveParticipant;
      Alert.alert(t.common.error, errorMessage);
    } finally {
      setIsAddingParticipant(false);
    }
  }, [competitionId, isAddingParticipant, selectedCategory]);

  const handleRemoveParticipant = useCallback((participant: Participant) => {
    Alert.alert(
      t.competitionExt.removeParticipant,
      t.competitionExt.removeParticipantConfirm(participant.userName),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await ParticipantService.removeParticipant(competitionId, participant.id);
              // No need to call refresh() - realtime subscription handles updates
            } catch (error) {
              Alert.alert(t.common.error, t.competitionExt.cannotRemoveParticipant);
            }
          },
        },
      ]
    );
  }, [competitionId, t]);

  const handleUpdateStatus = useCallback(async (participant: Participant, status: 'approved' | 'pending' | 'rejected') => {
    try {
      await ParticipantService.updateParticipantStatus(competitionId, participant.id, status);
      // No need to call refresh() - realtime subscription handles updates
    } catch (error) {
      Alert.alert(t.common.error, t.competitionExt.cannotApproveParticipant);
    }
  }, [competitionId, t]);

  // Approve a self-registration (for Totemtition)
  const handleApproveRegistration = async (participant: Participant) => {
    Alert.alert(
      t.competitionExt.approve,
      t.competitionExt.approveRegistrationConfirm(participant.userName),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.ok,
          onPress: async () => {
            try {
              // Get current user ID for approval tracking
              const currentUserId = rolesContext.userId || 'system';
              await ParticipantService.approveRegistration(competitionId, participant.id, currentUserId);
              // No need to call refresh() - realtime subscription handles updates
              Alert.alert(t.common.success, t.competitionExt.participantApproved);
            } catch (error: any) {
              Alert.alert(t.common.error, error.message || t.competitionExt.cannotApproveParticipant);
            }
          },
        },
      ]
    );
  };

  // Reject a self-registration (for Totemtition)
  const handleRejectRegistration = async (participant: Participant) => {
    Alert.alert(
      t.competitionExt.reject,
      t.competitionExt.rejectRegistrationConfirm(participant.userName),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.competitionExt.reject,
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUserId = rolesContext.userId || 'system';
              await ParticipantService.rejectRegistration(competitionId, participant.id, currentUserId);
              // No need to call refresh() - realtime subscription handles updates
              Alert.alert(t.competitionExt.participantRejected);
            } catch (error: any) {
              Alert.alert(t.common.error, error.message || t.competitionExt.cannotRejectParticipant);
            }
          },
        },
      ]
    );
  };

  // Open category assignment modal
  const handleOpenCategoryModal = (participant: Participant) => {
    setParticipantToAssign(participant);
    setShowCategoryModal(true);
  };

  // Assign participant to a category
  const handleAssignCategory = async (categoryId: string, categoryName: string) => {
    if (!participantToAssign) return;
    
    try {
      await ParticipantService.updateParticipant(competitionId, participantToAssign.id, {
        category: categoryId || null,
        categoryName: categoryName || null,
      });
      setShowCategoryModal(false);
      setParticipantToAssign(null);
      // No need to call refresh() - realtime subscription handles updates
      
      // Reload categories to get updated counts
      const cats = await ParticipantService.getCategories(competitionId);
      setCategoriesList(cats);
      
      Alert.alert(t.common.success, t.competitionExt.assignedTo(participantToAssign.userName, categoryName));
    } catch (error) {
      Alert.alert(t.common.error, t.competitionExt.cannotAssignParticipant);
    }
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleAddParticipant(item)}
    >
      <View style={styles.userInfo}>
        <CachedAvatar
          photoURL={item.photoURL}
          displayName={item.displayName}
          size={40}
          showBorder={true}
        />
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

  const renderParticipant = ({ item }: { item: Participant }) => {
    const isTotemtition = competition?.format === 'totemtition';
    const isPendingApproval = item.status === 'pending_approval';
    
    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'approved': return 'מאושר';
        case 'rejected': return 'נדחה';
        case 'pending_approval': return 'ממתין לאישור';
        case 'cancelled': return 'בוטל';
        default: return 'ממתין';
      }
    };
    
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'approved': return '#27ae60';
        case 'rejected': return '#e74c3c';
        case 'cancelled': return '#95a5a6';
        default: return '#f39c12';
      }
    };
    
    return (
      <View style={styles.participantItem}>
        <View style={styles.participantInfo}>
          <View style={styles.participantHeader}>
            <Text style={styles.participantName}>{item.userName}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) }
            ]}>
              <Text style={styles.statusText}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
          
          {item.category && (
            <Text style={styles.participantCategory}>
              קטגוריה: {item.categoryName || categoriesList.find(c => c.id === item.category)?.name || item.category}
            </Text>
          )}
          
          <Text style={styles.participantDate}>
            נרשם: {item.registeredAt.toLocaleDateString('he-IL')}
          </Text>
          
          {/* Show self-registration indicator for Totemtition */}
          {isTotemtition && item.userId && item.registeredBy === item.userId && (
            <Text style={styles.selfRegistered}>📱 הרשמה עצמית</Text>
          )}
        </View>

        <View style={styles.participantActions}>
          {/* Approve button for pending registrations */}
          {isPendingApproval && (
            <TouchableOpacity
              style={[styles.actionIcon, { backgroundColor: '#27ae60' }]}
              onPress={() => handleApproveRegistration(item)}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          
          {/* Reject button for pending registrations */}
          {isPendingApproval && (
            <TouchableOpacity
              style={[styles.actionIcon, { backgroundColor: '#e74c3c' }]}
              onPress={() => handleRejectRegistration(item)}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          
          {/* Standard approve for non-pending */}
          {!isPendingApproval && item.status !== 'approved' && (
            <TouchableOpacity
              style={[styles.actionIcon, { backgroundColor: '#27ae60' }]}
              onPress={() => handleUpdateStatus(item, 'approved')}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          
          {/* Assign category button */}
          {categoriesList.length > 0 && (
            <TouchableOpacity
              style={[styles.actionIcon, { backgroundColor: theme.primary }]}
              onPress={() => handleOpenCategoryModal(item)}
            >
              <Ionicons name="layers" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          
          {/* Delete button for non-pending */}
          {!isPendingApproval && item.status !== 'rejected' && (
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
            placeholder={t.competitionExt.searchUsersToAdd}
            placeholderTextColor={theme.textSecondary}
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
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>סה"כ</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.approved}</Text>
          <Text style={styles.statLabel}>מאושרים</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>ממתינים</Text>
        </View>
      </View>

      {/* Participants List */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipant}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
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

      {/* Category Assignment Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                שייך את {participantToAssign?.userName} לקטגוריה
              </Text>
              <TouchableOpacity onPress={() => {
                setShowCategoryModal(false);
                setParticipantToAssign(null);
              }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {categoriesList.length === 0 ? (
                <Text style={styles.noCategoriesText}>
                  אין קטגוריות. צור קטגוריות במסך ניהול קטגוריות.
                </Text>
              ) : (
                <>
                  {categoriesList.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categorySelectItem,
                        participantToAssign?.category === category.id && styles.categorySelectItemActive,
                      ]}
                      onPress={() => handleAssignCategory(category.id, category.name)}
                    >
                      <Text style={styles.categorySelectName}>{category.name}</Text>
                      <Text style={styles.categorySelectCount}>
                        {category.participantCount || 0} משתתפים
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* Option to remove from category */}
                  {participantToAssign?.category && (
                    <TouchableOpacity
                      style={[styles.categorySelectItem, styles.removeFromCategory]}
                      onPress={() => handleAssignCategory('', '')}
                    >
                      <Text style={styles.removeFromCategoryText}>הסר מקטגוריה</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
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
    },
    participantDate: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    selfRegistered: {
      fontSize: 11,
      color: theme.primary,
      marginTop: 4,
      fontWeight: '500',
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
    // Error container styles
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    errorSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 24,
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
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '60%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    modalBody: {
      padding: 16,
    },
    categorySelectItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 8,
      marginBottom: 8,
    },
    categorySelectItemActive: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    categorySelectName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    categorySelectCount: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    noCategoriesText: {
      textAlign: 'center',
      color: theme.textSecondary,
      padding: 32,
    },
    removeFromCategory: {
      borderWidth: 1,
      borderColor: '#e74c3c',
      backgroundColor: 'transparent',
      marginTop: 8,
    },
    removeFromCategoryText: {
      color: '#e74c3c',
      fontWeight: '500',
    },
  });
