/**
 * @fileoverview Shift Detail Screen
 * @description Shows shift details, registrations, and allows admin management
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useRoles } from '@/features/roles';
import { useShiftRoles, useShiftRegistrations, useOutgoingSwapRequests } from '../hooks';
import {
  updateShift,
  deleteShift,
  duplicateShift,
  handleRegistration,
  registerForShift,
  cancelRegistration,
  getShiftHistory,
  subscribeToShift,
  getEligibleSwapUsers,
  createSwapRequest,
} from '../shiftsService';
import { SHIFT_STATUS_CONFIG, REGISTRATION_STATUS_CONFIG } from '../constants';
import type { Shift, ShiftRegistration, ShiftStatus, ShiftHistoryEntry, UserShiftRole } from '../types';
import { auth } from '@/features/data/firebase';
import { useMyShiftRoles } from '../hooks';

interface ShiftDetailScreenProps {
  navigation: any;
  route: {
    params: {
      shift: Shift;
    };
  };
}

export function ShiftDetailScreen({ navigation, route }: ShiftDetailScreenProps) {
  const { theme } = useTheme();
  const initialShift = route.params.shift;
  const [shift, setShift] = useState<Shift>(initialShift);
  const { isAdmin } = useRoles();
  const { roles } = useShiftRoles();
  const { userShiftRole, isShiftManager } = useMyShiftRoles();
  const canManage = isAdmin || isShiftManager;
  const { registrations, loading: regsLoading } = useShiftRegistrations(shift.id);
  const { requests: outgoingSwaps } = useOutgoingSwapRequests();
  const [history, setHistory] = useState<ShiftHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<UserShiftRole[]>([]);
  const [loadingSwapUsers, setLoadingSwapUsers] = useState(false);
  const userId = auth.currentUser?.uid;

  // Pending outgoing swap request for this shift
  const myPendingSwap = outgoingSwaps.find(
    (s) => s.shiftId === shift.id && s.status === 'pending'
  );

  // Real-time shift updates
  useEffect(() => {
    const unsubscribe = subscribeToShift(initialShift.id, (updated) => {
      if (updated) setShift(updated);
    });
    return unsubscribe;
  }, [initialShift.id]);

  const statusConfig = SHIFT_STATUS_CONFIG[shift.status];
  const roleNames = shift.requiredRoleIds
    .map((id) => roles.find((r) => r.id === id))
    .filter(Boolean);

  const myRegistration = registrations.find(
    (r) => r.userId === userId && r.status !== 'cancelled' && r.status !== 'rejected'
  );

  const approvedRegs = registrations.filter((r) => r.status === 'approved');
  const pendingRegs = registrations.filter((r) => r.status === 'pending');
  const waitlistedRegs = registrations.filter((r) => r.status === 'waitlisted');

  const canRegister = useMemo(() => {
    if (!userShiftRole) return false;
    if (shift.status !== 'open') return false;
    if (myRegistration) return false;
    return shift.requiredRoleIds.some((id) => userShiftRole.shiftRoleIds.includes(id));
  }, [shift, userShiftRole, myRegistration]);

  const formatDate = (d: Date) => d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  const formatTime = (d: Date) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  const handleRegister = async () => {
    if (!userId || !userShiftRole) return;
    // Pick the first matching role
    const matchingRoleId = shift.requiredRoleIds.find((id) => userShiftRole.shiftRoleIds.includes(id));
    if (!matchingRoleId) return;

    try {
      await registerForShift(
        shift.id,
        userId,
        userShiftRole.userName || 'Unknown',
        matchingRoleId
      );
      Alert.alert('הצלחה', 'ההרשמה נשלחה! ממתין לאישור מנהל');
    } catch (error: any) {
      Alert.alert('שגיאה', error.message || 'לא ניתן להירשם');
    }
  };

  const handleCancelMyRegistration = () => {
    if (!myRegistration) return;
    Alert.alert('ביטול הרשמה', 'לבטל את ההרשמה למשמרת?', [
      { text: 'לא', style: 'cancel' },
      {
        text: 'כן, בטל',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelRegistration(myRegistration.id);
          } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן לבטל');
          }
        },
      },
    ]);
  };

  const handleOpenSwapModal = async () => {
    if (!myRegistration || !userId) return;
    setLoadingSwapUsers(true);
    setShowSwapModal(true);
    try {
      const users = await getEligibleSwapUsers(myRegistration.shiftRoleId, userId);
      setEligibleUsers(users);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לטעון משתמשים');
      setShowSwapModal(false);
    } finally {
      setLoadingSwapUsers(false);
    }
  };

  const handleRequestSwap = (targetUser: UserShiftRole) => {
    if (!myRegistration || !userId || !userShiftRole) return;
    Alert.alert(
      'בקשת החלפה',
      `לבקש מ-${targetUser.userName} לקחת את המשמרת?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שלח בקשה',
          onPress: async () => {
            try {
              await createSwapRequest(
                shift.id,
                myRegistration.id,
                userId,
                userShiftRole.userName || 'Unknown',
                targetUser.userId,
                targetUser.userName,
                myRegistration.shiftRoleId
              );
              setShowSwapModal(false);
              Alert.alert('הצלחה', 'בקשת ההחלפה נשלחה!');
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'לא ניתן לשלוח בקשה');
            }
          },
        },
      ]
    );
  };

  const handleStatusChange = (newStatus: ShiftStatus) => {
    Alert.alert('שינוי סטטוס', `לשנות סטטוס ל"${SHIFT_STATUS_CONFIG[newStatus].label}"?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'אישור',
        onPress: async () => {
          try {
            await updateShift(shift.id, { status: newStatus });
          } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן לשנות סטטוס');
          }
        },
      },
    ]);
  };

  const handleDeleteShift = () => {
    Alert.alert('מחיקת משמרת', 'למחוק את המשמרת?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShift(shift.id);
            navigation.goBack();
          } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן למחוק');
          }
        },
      },
    ]);
  };

  const handleDuplicate = () => {
    const tomorrow = new Date(shift.startTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = new Date(shift.endTime);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    Alert.alert('שכפול משמרת', 'לשכפל את המשמרת ליום הבא?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'שכפל',
        onPress: async () => {
          try {
            await duplicateShift(shift.id, tomorrow, tomorrowEnd);
            Alert.alert('הצלחה', 'המשמרת שוכפלה');
          } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן לשכפל');
          }
        },
      },
    ]);
  };

  const handleApproveReg = async (reg: ShiftRegistration) => {
    try {
      await handleRegistration(reg.id, 'approved', userId || '');
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לאשר');
    }
  };

  const handleRejectReg = async (reg: ShiftRegistration) => {
    try {
      await handleRegistration(reg.id, 'rejected', userId || '');
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לדחות');
    }
  };

  const handleWaitlistReg = async (reg: ShiftRegistration) => {
    try {
      await handleRegistration(reg.id, 'waitlisted', userId || '');
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן להעביר לרשימת המתנה');
    }
  };

  const handleRevokeReg = (reg: ShiftRegistration) => {
    Alert.alert('ביטול אישור', `להחזיר את ${reg.userName} לרשימת המתנה?`, [
      { text: 'לא', style: 'cancel' },
      {
        text: 'כן',
        onPress: async () => {
          try {
            await handleRegistration(reg.id, 'waitlisted', userId || '');
          } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן לבטל אישור');
          }
        },
      },
    ]);
  };

  const loadHistory = async () => {
    try {
      const h = await getShiftHistory(shift.id);
      setHistory(h);
      setShowHistory(true);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לטעון היסטוריה');
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>פרטי משמרת</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={handleDeleteShift}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Shift Info Card */}
        <View style={styles.infoCard}>
          {shift.title ? (
            <Text style={styles.shiftTitle}>{shift.title}</Text>
          ) : null}

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={18} color={theme.textSecondary} />
            <Text style={styles.infoText}>{formatDate(shift.startTime)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time" size={18} color={theme.textSecondary} />
            <Text style={styles.infoText}>{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people" size={18} color={theme.textSecondary} />
            <Text style={styles.infoText}>{approvedRegs.length} / {shift.maxWorkers} עובדים</Text>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.icon} {statusConfig.label}
            </Text>
          </View>

          {/* Required Roles */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {roleNames.map((role) => (
              <View key={role!.id} style={[styles.roleBadge, { backgroundColor: role!.color + '20' }]}>
                <Text style={[styles.roleBadgeText, { color: role!.color }]}>
                  {role!.icon} {role!.name}
                </Text>
              </View>
            ))}
          </View>

          {shift.description ? (
            <Text style={styles.description}>{shift.description}</Text>
          ) : null}
        </View>

        {/* Worker Registration / Cancel */}
        {!canManage && canRegister && (
          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
            <Ionicons name="hand-left" size={20} color="#fff" />
            <Text style={styles.registerBtnText}>הירשם למשמרת</Text>
          </TouchableOpacity>
        )}

        {!canManage && myRegistration && (
          <View style={styles.myRegCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myRegTitle}>ההרשמה שלך</Text>
              <View style={[styles.statusBadge, { backgroundColor: REGISTRATION_STATUS_CONFIG[myRegistration.status].color + '20', alignSelf: 'flex-start' }]}>
                <Text style={{ color: REGISTRATION_STATUS_CONFIG[myRegistration.status].color, fontWeight: '600', fontSize: 13 }}>
                  {REGISTRATION_STATUS_CONFIG[myRegistration.status].icon} {REGISTRATION_STATUS_CONFIG[myRegistration.status].label}
                </Text>
              </View>
            </View>
            {(myRegistration.status === 'pending') && (
              <TouchableOpacity onPress={handleCancelMyRegistration}>
                <Ionicons name="close-circle" size={28} color={theme.error} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Swap request button for approved workers */}
        {!canManage && myRegistration?.status === 'approved' && !myPendingSwap && (
          <TouchableOpacity style={styles.swapBtn} onPress={handleOpenSwapModal}>
            <Ionicons name="swap-horizontal" size={20} color="#fff" />
            <Text style={styles.swapBtnText}>בקש החלפה</Text>
          </TouchableOpacity>
        )}

        {/* Show pending swap request status */}
        {!canManage && myPendingSwap && (
          <View style={[styles.myRegCard, { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myRegTitle}>בקשת החלפה פעילה</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, writingDirection: 'rtl' as const }}>
                ⏳ ממתין לאישור מ-{myPendingSwap.targetUserName}
              </Text>
            </View>
          </View>
        )}

        {/* Admin Controls */}
        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>פעולות מנהל</Text>
            <View style={styles.adminActions}>
              {shift.status === 'open' && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => handleStatusChange('closed')}>
                  <Text style={styles.actionBtnText}>סגור הרשמה</Text>
                </TouchableOpacity>
              )}
              {shift.status === 'closed' && (
                <>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleStatusChange('open')}>
                    <Text style={styles.actionBtnText}>פתח הרשמה</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => handleStatusChange('assigned')}>
                    <Text style={styles.actionBtnText}>שבץ</Text>
                  </TouchableOpacity>
                </>
              )}
              {(shift.status === 'assigned' || shift.status === 'closed') && (
                <TouchableOpacity
                  style={[styles.actionBtn, {
                    backgroundColor: approvedRegs.length >= (shift.minWorkers || shift.maxWorkers) ? '#6B7280' : '#6B728050',
                  }]}
                  onPress={() => {
                    if (approvedRegs.length < (shift.minWorkers || shift.maxWorkers)) {
                      Alert.alert('לא ניתן', `חסרים עובדים — ${approvedRegs.length}/${shift.minWorkers || shift.maxWorkers} מאושרים`);
                      return;
                    }
                    handleStatusChange('completed');
                  }}
                >
                  <Text style={styles.actionBtnText}>סמן כהושלם</Text>
                </TouchableOpacity>
              )}
              {shift.status !== 'cancelled' && shift.status !== 'completed' && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleStatusChange('cancelled')}>
                  <Text style={styles.actionBtnText}>בטל משמרת</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.buttonSecondary }]} onPress={handleDuplicate}>
                <Text style={styles.actionBtnText}>שכפל</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.buttonPrimary }]}
                onPress={() => navigation.navigate('ShiftEditor', { shift })}
              >
                <Text style={styles.actionBtnText}>ערוך</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Registrations Management (admin + shift managers) */}
        {canManage && (
          <>
            <Text style={styles.sectionTitle}>הרשמות ({registrations.filter((r) => r.status !== 'cancelled').length})</Text>

            {regsLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                {/* Pending */}
                {pendingRegs.length > 0 && (
                  <>
                    <Text style={styles.subSectionTitle}>ממתינים ({pendingRegs.length})</Text>
                    {pendingRegs.map((reg) => (
                      <RegistrationCard
                        key={reg.id}
                        reg={reg}
                        theme={theme}
                        roles={roles}
                        onApprove={() => handleApproveReg(reg)}
                        onReject={() => handleRejectReg(reg)}
                        onWaitlist={() => handleWaitlistReg(reg)}
                      />
                    ))}
                  </>
                )}

                {/* Approved */}
                {approvedRegs.length > 0 && (
                  <>
                    <Text style={styles.subSectionTitle}>מאושרים ({approvedRegs.length})</Text>
                    {approvedRegs.map((reg) => (
                      <RegistrationCard key={reg.id} reg={reg} theme={theme} roles={roles} onRevoke={() => handleRevokeReg(reg)} />
                    ))}
                  </>
                )}

                {/* Waitlisted */}
                {waitlistedRegs.length > 0 && (
                  <>
                    <Text style={styles.subSectionTitle}>רשימת המתנה ({waitlistedRegs.length})</Text>
                    {waitlistedRegs.map((reg) => (
                      <RegistrationCard
                        key={reg.id}
                        reg={reg}
                        theme={theme}
                        roles={roles}
                        onApprove={() => handleApproveReg(reg)}
                      />
                    ))}
                  </>
                )}
              </>
            )}

            {/* History */}
            <TouchableOpacity style={styles.historyBtn} onPress={loadHistory}>
              <Ionicons name="time" size={18} color={theme.textSecondary} />
              <Text style={styles.historyBtnText}>הצג היסטוריה</Text>
            </TouchableOpacity>

            {showHistory && history.map((h) => (
              <View key={h.id} style={styles.historyItem}>
                <Text style={styles.historyAction}>{h.action}</Text>
                <Text style={styles.historyDetail}>
                  {h.performedByName} {h.targetUserName ? `→ ${h.targetUserName}` : ''}
                </Text>
                <Text style={styles.historyTime}>{h.timestamp.toLocaleString('he-IL')}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Swap User Selection Modal */}
      <Modal visible={showSwapModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>בחר עובד להחלפה</Text>
              <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              בחר עובד עם אותו תפקיד שיקח את המשמרת שלך
            </Text>
            {loadingSwapUsers ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
            ) : eligibleUsers.length === 0 ? (
              <Text style={[styles.modalSubtitle, { marginTop: 20, textAlign: 'center' }]}>
                לא נמצאו עובדים מתאימים להחלפה
              </Text>
            ) : (
              <FlatList
                data={eligibleUsers}
                keyExtractor={(item) => item.userId}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.swapUserItem}
                    onPress={() => handleRequestSwap(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.swapUserName, { color: theme.text }]}>
                        {item.userName}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                        {item.shiftRoleIds
                          .map((rid) => roles.find((r) => r.id === rid))
                          .filter(Boolean)
                          .map((r) => `${r!.icon} ${r!.name}`)
                          .join(', ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== Registration Card Component ====================

function RegistrationCard({
  reg,
  theme,
  roles,
  onApprove,
  onReject,
  onWaitlist,
  onRevoke,
}: {
  reg: ShiftRegistration;
  theme: any;
  roles: any[];
  onApprove?: () => void;
  onReject?: () => void;
  onWaitlist?: () => void;
  onRevoke?: () => void;
}) {
  const regStatus = REGISTRATION_STATUS_CONFIG[reg.status];
  const role = roles.find((r) => r.id === reg.shiftRoleId);

  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: regStatus.color,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, writingDirection: 'rtl' as const }}>{reg.userName}</Text>
          {role && (
            <Text style={{ fontSize: 12, color: role.color, marginTop: 2 }}>{role.icon} {role.name}</Text>
          )}
          {reg.note ? (
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, writingDirection: 'rtl' as const }}>הערה: {reg.note}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onApprove && reg.status !== 'approved' && (
            <TouchableOpacity onPress={onApprove} style={{ padding: 4 }}>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            </TouchableOpacity>
          )}
          {onWaitlist && reg.status !== 'waitlisted' && (
            <TouchableOpacity onPress={onWaitlist} style={{ padding: 4 }}>
              <Ionicons name="list" size={24} color="#8B5CF6" />
            </TouchableOpacity>
          )}
          {onRevoke && reg.status === 'approved' && (
            <TouchableOpacity onPress={onRevoke} style={{ padding: 4 }}>
              <Ionicons name="arrow-undo-circle" size={28} color="#F59E0B" />
            </TouchableOpacity>
          )}
          {onReject && (
            <TouchableOpacity onPress={onReject} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={28} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
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
    content: { flex: 1, padding: 16 },
    infoCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    },
    shiftTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 12, writingDirection: 'rtl' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    infoText: { fontSize: 15, color: theme.text },
    statusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginTop: 8 },
    statusText: { fontWeight: '600', fontSize: 14 },
    roleBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    roleBadgeText: { fontSize: 12, fontWeight: '600' },
    description: { fontSize: 14, color: theme.textSecondary, marginTop: 12, writingDirection: 'rtl' },
    registerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.buttonPrimary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    myRegCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    myRegTitle: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 8, writingDirection: 'rtl' },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 16, marginBottom: 12, writingDirection: 'rtl' },
    subSectionTitle: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, writingDirection: 'rtl' },
    adminActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    historyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
      paddingVertical: 8,
    },
    historyBtnText: { fontSize: 14, color: theme.textSecondary },
    historyItem: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 10,
      marginBottom: 4,
    },
    historyAction: { fontSize: 13, fontWeight: '600', color: theme.text },
    historyDetail: { fontSize: 12, color: theme.textSecondary },
    historyTime: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
    swapBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#8B5CF6',
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    swapBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      writingDirection: 'rtl' as const,
    },
    modalSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      writingDirection: 'rtl' as const,
      marginBottom: 12,
    },
    swapUserItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border || '#eee',
    },
    swapUserName: {
      fontSize: 15,
      fontWeight: '600',
      writingDirection: 'rtl' as const,
    },
  });
