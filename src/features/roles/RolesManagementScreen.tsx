/**
 * @fileoverview Roles Management Screen
 * @description Admin screen for managing user roles
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserRole, UserWithRoles } from './types';
import { ROLES } from './constants';
import {
  getAllUsersWithRoles,
  searchUsers,
  setUserRoles,
} from './rolesService';
import { useRolesContext } from './RolesContext';

const ROLE_COLORS: Record<UserRole, string> = {
  route_setter: '#4CAF50',
  judge: '#2196F3',
  head_judge: '#9C27B0',
  admin: '#F44336',
};

export function RolesManagementScreen() {
  const { canManageRoles, loading: roleLoading } = useRolesContext();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [editedRoles, setEditedRoles] = useState<UserRole[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadUsersWithRoles = useCallback(async () => {
    setLoading(true);
    try {
      const usersWithRoles = await getAllUsersWithRoles();
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users with roles:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לטעון את רשימת המשתמשים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageRoles) {
      loadUsersWithRoles();
    }
  }, [canManageRoles, loadUsersWithRoles]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadUsersWithRoles();
      return;
    }

    setSearching(true);
    try {
      const results = await searchUsers(searchQuery.trim());
      setUsers(results);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לחפש משתמשים');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, loadUsersWithRoles]);

  const openEditModal = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditedRoles([...user.roles]);
    setModalVisible(true);
  };

  const toggleRole = (role: UserRole) => {
    setEditedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const saveRoles = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      await setUserRoles(selectedUser.id, editedRoles);
      // Update local state
      setUsers(prev =>
        prev.map(u =>
          u.id === selectedUser.id
            ? { ...u, roles: editedRoles }
            : u
        )
      );
      setModalVisible(false);
      Alert.alert('הצלחה', 'התפקידים עודכנו בהצלחה');
    } catch (error) {
      console.error('Error saving roles:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את התפקידים');
    } finally {
      setSaving(false);
    }
  };

  const renderRoleBadge = (role: UserRole) => (
    <View
      key={role}
      style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[role] }]}
    >
      <Text style={styles.roleBadgeText}>{ROLES[role].name}</Text>
    </View>
  );

  const renderUserItem = ({ item }: { item: UserWithRoles }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName || 'משתמש ללא שם'}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.rolesContainer}>
          {item.roles.length > 0 ? (
            item.roles.map(renderRoleBadge)
          ) : (
            <Text style={styles.noRoles}>ללא תפקידים</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const renderRoleOption = (role: UserRole) => {
    const roleInfo = ROLES[role];
    const isSelected = editedRoles.includes(role);

    return (
      <TouchableOpacity
        key={role}
        style={[
          styles.roleOption,
          isSelected && { backgroundColor: ROLE_COLORS[role] + '20' },
        ]}
        onPress={() => toggleRole(role)}
      >
        <View style={styles.roleOptionContent}>
          <View
            style={[
              styles.roleCheckbox,
              isSelected && { backgroundColor: ROLE_COLORS[role], borderColor: ROLE_COLORS[role] },
            ]}
          >
            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <View style={styles.roleOptionText}>
            <Text style={styles.roleOptionName}>{roleInfo.name}</Text>
            <Text style={styles.roleOptionDesc}>{roleInfo.description}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (roleLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!canManageRoles) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ccc" />
          <Text style={styles.accessDeniedText}>אין לך הרשאה לצפות בעמוד זה</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ניהול תפקידים</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש משתמש לפי שם או אימייל..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                loadUsersWithRoles();
              }}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>חפש</Text>
        </TouchableOpacity>
      </View>

      {loading || searching ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'לא נמצאו תוצאות' : 'אין משתמשים עם תפקידים'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>ביטול</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>עריכת תפקידים</Text>
            <TouchableOpacity onPress={saveRoles} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.modalSave}>שמור</Text>
              )}
            </TouchableOpacity>
          </View>

          {selectedUser && (
            <View style={styles.modalContent}>
              <View style={styles.selectedUserInfo}>
                <Text style={styles.selectedUserName}>
                  {selectedUser.displayName || 'משתמש ללא שם'}
                </Text>
                <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
              </View>

              <Text style={styles.rolesTitle}>בחר תפקידים:</Text>

              <View style={styles.rolesList}>
                {(Object.keys(ROLES) as UserRole[]).map(renderRoleOption)}
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    textAlign: 'right',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  rolesContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noRoles: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCancel: {
    color: '#666',
    fontSize: 16,
  },
  modalSave: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  selectedUserInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  selectedUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  selectedUserEmail: {
    fontSize: 14,
    color: '#666',
  },
  rolesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'right',
  },
  rolesList: {
    gap: 8,
  },
  roleOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  roleOptionContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  roleCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  roleOptionText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  roleOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  roleOptionDesc: {
    fontSize: 13,
    color: '#666',
  },
});
