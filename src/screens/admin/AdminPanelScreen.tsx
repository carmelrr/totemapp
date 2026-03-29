import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useDefaultAvatar } from '@/context/DefaultAvatarContext';
import { useRolesContext } from '@/features/roles';
import { Image as ExpoImage } from 'expo-image';
import { RouteStatsService } from '@/features/routes-map/services/RouteStatsService';
import { RoutesService } from '@/features/routes-map/services/RoutesService';
import { useRoutesStore } from '@/store/routesStore';
import { useBalanceModeStore } from '@/store/useBalanceModeStore';

interface AdminItem {
  key: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  visible?: boolean;
}

export default function AdminPanelScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const { defaultAvatarUrl, uploadDefaultAvatar, removeDefaultAvatar } = useDefaultAvatar();
  const { canManageRoles, canManageAnnouncements } = useRolesContext();

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isNormalizingColors, setIsNormalizingColors] = useState(false);
  const [isResettingPoints, setIsResettingPoints] = useState(false);
  const [isBalancing, setIsBalancing] = useState(false);
  const [isBackfillingProgress, setIsBackfillingProgress] = useState(false);

  const routes = useRoutesStore((s) => s.routes);
  const initializeRoutes = useRoutesStore((s) => s.initializeRoutes);

  useEffect(() => {
    initializeRoutes();
  }, [initializeRoutes]);

  // Extract unique dates from active routes (newest first)
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    routes
      .filter((r) => r.status !== 'archived')
      .forEach((route) => {
        if (route.createdAt) {
          const date = route.createdAt.toDate ? route.createdAt.toDate() : new Date(route.createdAt);
          // Use local time to match the date filtering logic
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          dates.add(`${y}-${m}-${d}`);
        }
      });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [routes]);

  // --- Handlers (moved from SidePanel) ---

  const handleRecalculateRoutes = () => {
    Alert.alert(
      t.admin.refreshRouteData,
      t.admin.selectAction,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.admin.refreshCalc,
          onPress: async () => {
            setIsRecalculating(true);
            try {
              const [statsResult, namesResult] = await Promise.all([
                RouteStatsService.recalculateAllRoutes(),
                RouteStatsService.recalculateAllRouteNames(true),
              ]);
              Alert.alert(
                t.admin.refreshComplete,
                `${statsResult.success} routes updated${statsResult.failed > 0 ? `, ${statsResult.failed} failed` : ''}\n\nNames: ${namesResult.success} updated${namesResult.failed > 0 ? `, ${namesResult.failed} failed` : ''}${namesResult.skipped > 0 ? `, ${namesResult.skipped} skipped` : ''}`,
              );
            } catch (error) {
              console.error('Error recalculating:', error);
              Alert.alert(t.common.error, t.alerts.refreshCalcError);
            } finally {
              setIsRecalculating(false);
            }
          },
        },
        {
          text: t.admin.syncClosureFilter,
          onPress: async () => {
            setIsRecalculating(true);
            try {
              const [sprayResult, communityResult, mapResult] = await Promise.all([
                RouteStatsService.syncSprayRouteSends(),
                RouteStatsService.syncCommunityRouteSends(),
                RouteStatsService.syncRouteFeedbacksToUserRoutes(),
              ]);
              Alert.alert(
                t.admin.syncComplete,
                `SprayWall: ${sprayResult.success} synced${sprayResult.failed > 0 ? `, ${sprayResult.failed} failed` : ''}\n\nCommunity: ${communityResult.success} records\n\nRoutes Map: ${mapResult.success} synced${mapResult.failed > 0 ? `, ${mapResult.failed} failed` : ''}`,
              );
            } catch (error) {
              console.error('Error syncing sends:', error);
              Alert.alert(t.common.error, t.alerts.syncFiltersError);
            } finally {
              setIsRecalculating(false);
            }
          },
        },
      ],
    );
  };

  const handleNormalizeColors = () => {
    Alert.alert(
      t.admin.normalizeColors || 'נרמול צבעי מסלולים',
      t.admin.normalizeColorsConfirm || 'פעולה זו תעבור על כל המסלולים ותתאים את הצבע והשם לצבע הקרוב ביותר מרשימת הצבעים. להמשיך?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.admin.normalize || 'נרמל',
          onPress: async () => {
            setIsNormalizingColors(true);
            try {
              const result = await RoutesService.normalizeAllRouteColors();
              Alert.alert(
                t.common.success,
                t.admin.normalizeResult
                  ? t.admin.normalizeResult(result.updated, result.skipped, result.total)
                  : `${result.updated} מסלולים עודכנו מתוך ${result.total}\n${result.skipped} לא דרשו שינוי`,
              );
            } catch (error) {
              console.error('Error normalizing colors:', error);
              Alert.alert(t.common.error, t.admin.normalizeError || 'שגיאה בנרמול צבעי המסלולים');
            } finally {
              setIsNormalizingColors(false);
            }
          },
        },
      ],
    );
  };

  const handleResetAllTimePoints = () => {
    Alert.alert(
      t.admin.resetAllTimePoints,
      t.admin.resetPointsConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.admin.reset,
          style: 'destructive',
          onPress: async () => {
            setIsResettingPoints(true);
            try {
              const result = await RouteStatsService.resetAllTimePoints();
              Alert.alert(t.admin.resetComplete, t.admin.resetResult(result.deleted));
            } catch (error) {
              console.error('Error resetting points:', error);
              Alert.alert(t.common.error, t.admin.resetError);
            } finally {
              setIsResettingPoints(false);
            }
          },
        },
      ],
    );
  };

  const handleBalancePositions = () => {
    if (availableDates.length === 0) {
      Alert.alert(t.common.error, t.admin.balanceNotEnough);
      return;
    }

    const formatDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    };

    const dateButtons = availableDates.slice(0, 8).map((dateStr) => ({
      text: formatDate(dateStr),
      onPress: () => {
        // Compute route IDs from this date
        const [year, month, day] = dateStr.split('-').map(Number);
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

        const dateRouteIds = routes
          .filter((r) => r.status !== 'archived' && r.createdAt)
          .filter((r) => {
            const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            return d >= startOfDay && d < endOfDay;
          })
          .map((r) => r.id);

        if (dateRouteIds.length < 2) {
          Alert.alert(t.common.error, t.admin.balanceNotEnough);
          return;
        }

        // Start balance mode and navigate to the routes map
        useBalanceModeStore.getState().startBalanceMode(dateStr, dateRouteIds);
        (navigation as any).navigate('MainTabs', {
          screen: 'RoutesMapTab',
          params: { screen: 'RoutesMap' },
        });
      },
    }));

    Alert.alert(
      t.admin.balancePositions,
      t.admin.balancePositionsDesc,
      [
        { text: t.common.cancel, style: 'cancel' },
        ...dateButtons,
      ],
    );
  };

  const handleBackfillProgress = () => {
    Alert.alert(
      t.admin.backfillProgress || 'מילוי היסטוריית התקדמות',
      t.admin.backfillProgressConfirm || 'פעולה זו תסנכרן את כל נתוני הסגירות ותשלים תאריכים חסרים בהיסטוריה. להמשיך?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.admin.backfillStart || 'התחל',
          onPress: async () => {
            setIsBackfillingProgress(true);
            try {
              const result = await RouteStatsService.backfillProgressHistory();
              Alert.alert(
                t.admin.backfillComplete || 'הושלם!',
                t.admin.backfillResult
                  ? t.admin.backfillResult(result.synced, result.backfilled, result.users)
                  : `${result.synced} סגירות סונכרנו\n${result.backfilled} תאריכים הושלמו\n${result.users} משתמשים עודכנו`,
              );
            } catch (error) {
              console.error('Error backfilling progress:', error);
              Alert.alert(t.common.error, t.admin.backfillError || 'שגיאה במילוי היסטוריית ההתקדמות');
            } finally {
              setIsBackfillingProgress(false);
            }
          },
        },
      ],
    );
  };

  // --- Navigation items ---
  const navigationItems: AdminItem[] = [
    {
      key: 'roles',
      icon: '👥',
      label: t.admin.rolesManagement,
      color: '#9C27B0',
      onPress: () => (navigation as any).navigate('RolesManagement'),
      visible: canManageRoles,
    },
    {
      key: 'wallEditor',
      icon: '🧱',
      label: t.admin.wallEditor,
      color: '#00BCD4',
      onPress: () => (navigation as any).navigate('WallEditor'),
    },
    {
      key: 'shifts',
      icon: '📅',
      label: 'ניהול משמרות',
      color: '#FF5722',
      onPress: () => (navigation as any).navigate('Shifts'),
    },
    {
      key: 'tapes',
      icon: '🏷️',
      label: 'ניהול טייפים',
      color: '#8BC34A',
      onPress: () => (navigation as any).navigate('WallTapeManagement'),
    },
    {
      key: 'announcements',
      icon: '📢',
      label: t.admin.messageManagement || 'ניהול הודעות',
      color: '#F59E0B',
      onPress: () => (navigation as any).navigate('AnnouncementsManagement'),
      visible: canManageAnnouncements,
    },
    {
      key: 'statistics',
      icon: '📊',
      label: t.statistics.title,
      color: '#3F51B5',
      onPress: () => (navigation as any).navigate('AdminStatistics'),
    },
    {
      key: 'fonts',
      icon: '🔤',
      label: 'תצוגת פונטים',
      color: '#607D8B',
      onPress: () => (navigation as any).navigate('FontPreview'),
    },
  ];

  // --- Action items ---
  const actionItems: AdminItem[] = [
    {
      key: 'recalculate',
      icon: '🔄',
      label: t.admin.refreshRouteCalc,
      color: '#2196F3',
      onPress: handleRecalculateRoutes,
    },
    {
      key: 'normalize',
      icon: '🎨',
      label: t.admin.normalizeColors || 'נרמול צבעי מסלולים',
      color: '#FF9800',
      onPress: handleNormalizeColors,
    },
    {
      key: 'resetPoints',
      icon: '⚠️',
      label: t.admin.resetPoints,
      color: '#E53935',
      onPress: handleResetAllTimePoints,
    },
    {
      key: 'balancePositions',
      icon: '⚖️',
      label: t.admin.balancePositions,
      color: '#4CAF50',
      onPress: handleBalancePositions,
    },
    {
      key: 'backfillProgress',
      icon: '📊',
      label: t.admin.backfillProgress || 'מילוי היסטוריית התקדמות',
      color: '#7C4DFF',
      onPress: handleBackfillProgress,
    },
  ];

  const isLoading = (key: string) => {
    if (key === 'recalculate') return isRecalculating;
    if (key === 'normalize') return isNormalizingColors;
    if (key === 'resetPoints') return isResettingPoints;
    if (key === 'balancePositions') return isBalancing;
    if (key === 'backfillProgress') return isBackfillingProgress;
    return false;
  };

  const visibleNavItems = navigationItems.filter((item) => item.visible !== false);

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.admin.adminPanel}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Default Avatar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.admin.defaultAvatar}</Text>
          <View style={styles.avatarRow}>
            <View style={styles.avatarPreview}>
              {defaultAvatarUrl ? (
                <ExpoImage
                  source={{ uri: defaultAvatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>?</Text>
                </View>
              )}
            </View>
            <View style={styles.avatarActions}>
              <TouchableOpacity style={styles.avatarButton} onPress={uploadDefaultAvatar}>
                <Text style={styles.avatarButtonText}>
                  {defaultAvatarUrl ? t.admin.changeDefaultAvatar : t.admin.setDefaultAvatar}
                </Text>
              </TouchableOpacity>
              {defaultAvatarUrl && (
                <TouchableOpacity
                  style={[styles.avatarButton, styles.avatarRemoveButton]}
                  onPress={removeDefaultAvatar}
                >
                  <Text style={styles.avatarRemoveText}>{t.admin.removeDefaultAvatar}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Navigation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ניהול</Text>
          <View style={styles.grid}>
            {visibleNavItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.card, { borderLeftColor: item.color }]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={[styles.cardLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.cardArrow, { color: theme.textSecondary }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פעולות מערכת</Text>
          <View style={styles.grid}>
            {actionItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.card, { borderLeftColor: item.color }]}
                onPress={item.onPress}
                activeOpacity={0.7}
                disabled={isLoading(item.key)}
              >
                {isLoading(item.key) ? (
                  <ActivityIndicator color={item.color} size="small" style={styles.cardIcon} />
                ) : (
                  <Text style={styles.cardIcon}>{item.icon}</Text>
                )}
                <Text style={[styles.cardLabel, { color: theme.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      fontSize: 24,
      color: theme.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 12,
      writingDirection: 'rtl',
    },
    // Avatar
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      gap: 16,
    },
    avatarPreview: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: theme.border,
    },
    avatarImage: {
      width: 64,
      height: 64,
    },
    avatarPlaceholder: {
      width: 64,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.border,
    },
    avatarPlaceholderText: {
      fontSize: 28,
      color: theme.textSecondary,
    },
    avatarActions: {
      flex: 1,
      gap: 8,
    },
    avatarButton: {
      backgroundColor: theme.primary,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    avatarButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 13,
    },
    avatarRemoveButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.error,
    },
    avatarRemoveText: {
      color: theme.error,
      fontWeight: '600',
      fontSize: 13,
    },
    // Card grid
    grid: {
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      borderLeftWidth: 4,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    cardIcon: {
      fontSize: 22,
      marginRight: 14,
      width: 30,
      textAlign: 'center',
    },
    cardLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      writingDirection: 'rtl',
    },
    cardArrow: {
      fontSize: 22,
      fontWeight: '300',
    },
  });
}
