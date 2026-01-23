/**
 * @fileoverview Announcements Management Screen
 * @description Screen for Social Managers to create/edit/manage announcements
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useRolesContext } from '@/features/roles/RolesContext';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { 
  Announcement, 
  AnnouncementStatus 
} from '../types';
import {
  subscribeToAllAnnouncements,
  deleteAnnouncement,
  publishAnnouncement,
  duplicateAnnouncement,
} from '../announcementService';

export function AnnouncementsManagementScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const { canManageAnnouncements, loading: rolesLoading } = useRolesContext();

  // Status labels with translations
  const STATUS_LABELS: Record<AnnouncementStatus, { label: string; color: string }> = {
    draft: { label: t.announcements.draft, color: '#6B7280' },
    scheduled: { label: t.announcements.scheduled, color: '#F59E0B' },
    active: { label: t.announcements.active, color: '#10B981' },
    expired: { label: t.announcements.expired, color: '#EF4444' },
    deleted: { label: t.announcements.deleted, color: '#9CA3AF' },
  };
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!canManageAnnouncements) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToAllAnnouncements((data) => {
      setAnnouncements(data);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [canManageAnnouncements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The subscription will automatically update
  }, []);

  const handleCreateNew = () => {
    (navigation as any).navigate('AnnouncementEditor', {});
  };

  const handleEdit = (announcement: Announcement) => {
    (navigation as any).navigate('AnnouncementEditor', { 
      announcementId: announcement.id 
    });
  };

  const handleDelete = (announcement: Announcement) => {
    Alert.alert(
      t.announcements.deleteAnnouncement,
      t.announcements.deleteConfirm(announcement.title),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAnnouncement(announcement.id);
            } catch (error) {
              console.error('Error deleting announcement:', error);
              Alert.alert(t.common.error, t.announcements.cannotDelete);
            }
          },
        },
      ]
    );
  };

  const handlePublish = async (announcement: Announcement) => {
    try {
      await publishAnnouncement(announcement.id);
      Alert.alert(t.common.success, t.announcements.published);
    } catch (error) {
      console.error('Error publishing announcement:', error);
      Alert.alert(t.common.error, t.announcements.cannotPublish);
    }
  };

  const handleDuplicate = async (announcement: Announcement) => {
    try {
      const newId = await duplicateAnnouncement(announcement.id);
      Alert.alert(t.common.success, t.announcements.duplicated);
      (navigation as any).navigate('AnnouncementEditor', { 
        announcementId: newId 
      });
    } catch (error) {
      console.error('Error duplicating announcement:', error);
      Alert.alert(t.common.error, t.announcements.cannotDuplicate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAnnouncementItem = ({ item }: { item: Announcement }) => {
    const status = STATUS_LABELS[item.status];
    
    return (
      <TouchableOpacity
        style={[styles.announcementCard, { backgroundColor: theme.surface }]}
        onPress={() => handleEdit(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
          <View style={styles.iconContainer}>
            <Text style={styles.announcementIcon}>{item.icon || '📢'}</Text>
          </View>
        </View>

        <Text style={[styles.announcementTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        
        <Text style={[styles.announcementText, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.text}
        </Text>

        <View style={styles.dateRow}>
          <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
            {formatDate(item.startDate)} - {formatDate(item.endDate)}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {item.status === 'draft' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.publishButton]}
              onPress={() => handlePublish(item)}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t.announcements.publish}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionButton, styles.duplicateButton]}
            onPress={() => handleDuplicate(item)}
          >
            <Ionicons name="copy-outline" size={16} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="pencil" size={16} color="#3B82F6" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (rolesLoading || loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!canManageAnnouncements) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ccc" />
          <Text style={styles.accessDeniedText}>{t.announcements.onlyManagersCanAccess}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.headerGradient }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.announcements.manageAnnouncements}</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateNew}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={announcements}
        renderItem={renderAnnouncementItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📢</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t.announcements.noAnnouncements}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t.announcements.createFirst}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  announcementCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  announcementIcon: {
    fontSize: 24,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 4,
  },
  announcementText: {
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 20,
  },
  dateRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  dateLabel: {
    fontSize: 12,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  publishButton: {
    backgroundColor: '#10B981',
  },
  duplicateButton: {
    backgroundColor: '#F3F4F6',
  },
  editButton: {
    backgroundColor: '#EFF6FF',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default AnnouncementsManagementScreen;
