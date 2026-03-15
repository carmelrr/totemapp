/**
 * @fileoverview Shift Role Management Screen (Admin)
 * @description Admin screen for managing shift work roles and assigning them to users
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useShiftRoles, useAllUserShiftRoles } from '../hooks';
import {
  createShiftRole,
  updateShiftRole,
  deleteShiftRole,
  setUserShiftRoles,
  setUserShiftManager,
} from '../shiftsService';
import { DEFAULT_SHIFT_ROLES } from '../constants';
import type { ShiftRole, UserShiftRole } from '../types';
import { auth, db } from '@/features/data/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// ==================== Role Editor Modal ====================

interface RoleEditorProps {
  visible: boolean;
  role: Partial<ShiftRole> | null;
  onClose: () => void;
  onSave: (data: Partial<ShiftRole>) => void;
}

function RoleEditorModal({ visible, role, onClose, onSave }: RoleEditorProps) {
  const { theme } = useTheme();
  const [name, setName] = useState(role?.name || '');
  const [nameEn, setNameEn] = useState(role?.nameEn || '');
  const [description, setDescription] = useState(role?.description || '');
  const [color, setColor] = useState(role?.color || '#3B82F6');
  const [icon, setIcon] = useState(role?.icon || '👤');

  React.useEffect(() => {
    if (role) {
      setName(role.name || '');
      setNameEn(role.nameEn || '');
      setDescription(role.description || '');
      setColor(role.color || '#3B82F6');
      setIcon(role.icon || '👤');
    } else {
      setName('');
      setNameEn('');
      setDescription('');
      setColor('#3B82F6');
      setIcon('👤');
    }
  }, [role, visible]);

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  const icons = ['👤', '🖥️', '🧗', '🏗️', '👷', '📋', '🎯', '⚡'];

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('שגיאה', 'יש להזין שם לתפקיד');
      return;
    }
    onSave({ name, nameEn, description, color, icon, isActive: true });
    onClose();
  };

  const styles = createEditorStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{role?.id ? 'עריכת תפקיד' : 'תפקיד חדש'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.label}>שם (עברית)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="לדוגמה: עובד דלפק"
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />

            <Text style={styles.label}>שם (אנגלית)</Text>
            <TextInput
              style={styles.input}
              value={nameEn}
              onChangeText={setNameEn}
              placeholder="e.g., Desk Worker"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.label}>תיאור</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="תיאור התפקיד..."
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlign="right"
            />

            <Text style={styles.label}>צבע</Text>
            <View style={styles.colorRow}>
              {colors.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorCircle, { backgroundColor: c }, color === c && styles.colorSelected]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            <Text style={styles.label}>אייקון</Text>
            <View style={styles.colorRow}>
              {icons.map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.iconCircle, icon === i && { borderColor: color, borderWidth: 2 }]}
                  onPress={() => setIcon(i)}
                >
                  <Text style={{ fontSize: 24 }}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
            <Text style={styles.saveBtnText}>שמור</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ==================== User Role Assignment Modal ====================

interface UserRoleAssignmentProps {
  visible: boolean;
  roles: ShiftRole[];
  userShiftRole: UserShiftRole | null;
  userId: string;
  userName: string;
  onClose: () => void;
}

function UserRoleAssignmentModal({ visible, roles, userShiftRole, userId, userName, onClose }: UserRoleAssignmentProps) {
  const { theme } = useTheme();
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(userShiftRole?.shiftRoleIds || []);
  const [isManager, setIsManager] = useState(userShiftRole?.isShiftManager || false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setSelectedRoleIds(userShiftRole?.shiftRoleIds || []);
    setIsManager(userShiftRole?.isShiftManager || false);
  }, [userShiftRole, visible]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setUserShiftRoles(userId, userName, selectedRoleIds, auth.currentUser?.uid || '');
      onClose();
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לשמור את התפקידים');
    } finally {
      setSaving(false);
    }
  };

  const styles = createEditorStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>תפקידי משמרת - {userName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {roles.filter((r) => r.isActive).map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleToggle, selectedRoleIds.includes(role.id) && { borderColor: role.color, backgroundColor: role.color + '15' }]}
                onPress={() => toggleRole(role.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 24 }}>{role.icon}</Text>
                  <View>
                    <Text style={[styles.roleToggleName, { color: theme.text }]}>{role.name}</Text>
                    {role.description ? (
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{role.description}</Text>
                    ) : null}
                  </View>
                </View>
                <Ionicons
                  name={selectedRoleIds.includes(role.id) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={selectedRoleIds.includes(role.id) ? role.color : theme.textSecondary}
                />
              </TouchableOpacity>
            ))}

            {/* Shift Manager Toggle */}
            <TouchableOpacity
              style={[styles.roleToggle, isManager && { borderColor: '#F59E0B', backgroundColor: '#F59E0B15' }]}
              onPress={() => setIsManager(!isManager)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24 }}>👑</Text>
                <View>
                  <Text style={[styles.roleToggleName, { color: theme.text }]}>מנהל משמרת</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>יכול לנהל שיבוצים ולהחליף עובדים</Text>
                </View>
              </View>
              <Ionicons
                name={isManager ? 'checkbox' : 'square-outline'}
                size={24}
                color={isManager ? '#F59E0B' : theme.textSecondary}
              />
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.buttonPrimary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>שמור</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ==================== Main Screen ====================

export function ShiftRolesManagementScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { roles, loading: rolesLoading } = useShiftRoles();
  const { users: userShiftRoles, loading: usersLoading } = useAllUserShiftRoles();
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');
  const [roleEditorVisible, setRoleEditorVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Partial<ShiftRole> | null>(null);
  const [userAssignVisible, setUserAssignVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; displayName: string; email: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all users for assignment
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('displayName'));
        const snap = await getDocs(q);
        setAllUsers(snap.docs.map((d) => ({
          id: d.id,
          displayName: d.data().displayName || d.data().email || d.id,
          email: d.data().email || '',
        })));
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    if (activeTab === 'users') loadUsers();
  }, [activeTab]);

  const handleCreateRole = useCallback(async (data: Partial<ShiftRole>) => {
    try {
      await createShiftRole(data as any);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן ליצור את התפקיד');
    }
  }, []);

  const handleUpdateRole = useCallback(async (data: Partial<ShiftRole>) => {
    if (!editingRole?.id) return;
    try {
      await updateShiftRole(editingRole.id, data);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן את התפקיד');
    }
  }, [editingRole]);

  const handleDeleteRole = useCallback((role: ShiftRole) => {
    Alert.alert(
      'מחיקת תפקיד',
      `למחוק את התפקיד "${role.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteShiftRole(role.id);
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן למחוק את התפקיד');
            }
          },
        },
      ]
    );
  }, []);

  const handleInitDefaults = useCallback(async () => {
    try {
      for (const r of DEFAULT_SHIFT_ROLES) {
        await createShiftRole({ ...r, description: '', isActive: true });
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן ליצור תפקידים');
    }
  }, []);

  const filteredUsers = allUsers.filter((u) =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userShiftRolesMap = new Map(userShiftRoles.map((ur) => [ur.userId, ur]));

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ניהול תפקידי משמרת</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'roles' && styles.tabActive]}
          onPress={() => setActiveTab('roles')}
        >
          <Text style={[styles.tabText, activeTab === 'roles' && styles.tabTextActive]}>תפקידים</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>שיוך עובדים</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'roles' ? (
        <>
          {rolesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
          ) : roles.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>אין תפקידי משמרת</Text>
              <TouchableOpacity style={styles.initBtn} onPress={handleInitDefaults}>
                <Text style={styles.initBtnText}>צור תפקידים ברירת מחדל</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={roles}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={[styles.roleCard, { borderLeftColor: item.color, borderLeftWidth: 4 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                      <Text style={styles.roleName}>{item.name}</Text>
                      {!item.isActive && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>לא פעיל</Text>
                        </View>
                      )}
                    </View>
                    {item.description ? (
                      <Text style={styles.roleDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingRole(item);
                        setRoleEditorVisible(true);
                      }}
                    >
                      <Ionicons name="pencil" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteRole(item)}>
                      <Ionicons name="trash" size={20} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              setEditingRole(null);
              setRoleEditorVisible(true);
            }}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="חיפוש משתמש..."
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />
          </View>
          {usersLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const userRole = userShiftRolesMap.get(item.id);
                const assignedRoleNames = userRole
                  ? userRole.shiftRoleIds.map((rid) => roles.find((r) => r.id === rid)?.name).filter(Boolean)
                  : [];

                return (
                  <TouchableOpacity
                    style={styles.userCard}
                    onPress={() => {
                      setSelectedUser({ id: item.id, name: item.displayName });
                      setUserAssignVisible(true);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{item.displayName}</Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                      {assignedRoleNames.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {assignedRoleNames.map((name, i) => {
                            const role = roles.find((r) => r.name === name);
                            return (
                              <View key={i} style={[styles.roleBadge, { backgroundColor: (role?.color || '#3B82F6') + '20' }]}>
                                <Text style={[styles.roleBadgeText, { color: role?.color || '#3B82F6' }]}>
                                  {role?.icon} {name}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.noRoles}>ללא תפקיד</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}

      {/* Modals */}
      <RoleEditorModal
        visible={roleEditorVisible}
        role={editingRole}
        onClose={() => setRoleEditorVisible(false)}
        onSave={editingRole?.id ? handleUpdateRole : handleCreateRole}
      />

      {selectedUser && (
        <UserRoleAssignmentModal
          visible={userAssignVisible}
          roles={roles}
          userShiftRole={userShiftRolesMap.get(selectedUser.id) || null}
          userId={selectedUser.id}
          userName={selectedUser.name}
          onClose={() => {
            setUserAssignVisible(false);
            setSelectedUser(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ==================== Styles ====================

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.headerGradient,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    backBtn: { width: 40 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    tabs: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: theme.buttonPrimary },
    tabText: { fontSize: 15, color: theme.textSecondary, fontWeight: '600' },
    tabTextActive: { color: theme.buttonPrimary },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyText: { fontSize: 16, color: theme.textSecondary, marginBottom: 16, textAlign: 'center' },
    initBtn: {
      backgroundColor: theme.buttonPrimary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    initBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    roleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    roleName: { fontSize: 16, fontWeight: '700', color: theme.text, writingDirection: 'rtl' },
    roleDesc: { fontSize: 13, color: theme.textSecondary, marginTop: 4, writingDirection: 'rtl' },
    inactiveBadge: { backgroundColor: theme.error + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    inactiveBadgeText: { color: theme.error, fontSize: 11, fontWeight: '600' },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    searchInput: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      writingDirection: 'rtl',
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    userName: { fontSize: 15, fontWeight: '600', color: theme.text, writingDirection: 'rtl' },
    userEmail: { fontSize: 12, color: theme.textSecondary },
    noRoles: { fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', marginTop: 4 },
    roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    roleBadgeText: { fontSize: 11, fontWeight: '600' },
  });

const createEditorStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: theme.text, writingDirection: 'rtl' },
    content: { padding: 16 },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6, marginTop: 12, writingDirection: 'rtl' },
    input: {
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', paddingVertical: 4 },
    colorCircle: { width: 36, height: 36, borderRadius: 18 },
    colorSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.inputBackground,
    },
    saveBtn: {
      margin: 16,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    roleToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
    },
    roleToggleName: { fontSize: 15, fontWeight: '600' },
  });
