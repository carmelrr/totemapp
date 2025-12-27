/**
 * @fileoverview Offline Indicator Component
 * @description Shows network status and pending operations
 * Following TopLogger's pattern of graceful offline handling
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useIsOffline, usePendingOperationsCount } from '@/hooks/useNetworkStatus';

interface OfflineIndicatorProps {
    showPendingCount?: boolean;
    style?: any;
}

/**
 * Banner shown when offline or when there are pending operations
 */
export function OfflineIndicator({ showPendingCount = true, style }: OfflineIndicatorProps) {
    const isOffline = useIsOffline();
    const pendingCount = usePendingOperationsCount();

    // Only show if offline or has pending operations
    if (!isOffline && pendingCount === 0) {
        return null;
    }

    return (
        <View style={[styles.container, isOffline ? styles.offline : styles.syncing, style]}>
            <View style={styles.content}>
                <View style={[styles.dot, isOffline ? styles.dotOffline : styles.dotSyncing]} />
                <Text style={styles.text}>
                    {isOffline 
                        ? 'מצב לא מקוון' 
                        : `מסנכרן ${pendingCount} פעולות...`}
                </Text>
            </View>
            {isOffline && (
                <Text style={styles.subtext}>
                    השינויים יישמרו כשתתחבר
                </Text>
            )}
        </View>
    );
}

/**
 * Small dot indicator for status bars
 */
export function NetworkStatusDot() {
    const isOffline = useIsOffline();

    return (
        <View style={[
            styles.statusDot,
            isOffline ? styles.dotOffline : styles.dotOnline
        ]} />
    );
}

/**
 * Pending sync badge for navigation
 */
export function PendingSyncBadge() {
    const pendingCount = usePendingOperationsCount();

    if (pendingCount === 0) {
        return null;
    }

    return (
        <View style={styles.badge}>
            <Text style={styles.badgeText}>
                {pendingCount > 9 ? '9+' : pendingCount}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: 'column',
        alignItems: 'center',
    },
    offline: {
        backgroundColor: '#FEE2E2', // Light red
    },
    syncing: {
        backgroundColor: '#FEF3C7', // Light yellow
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    dotOffline: {
        backgroundColor: '#EF4444', // Red
    },
    dotSyncing: {
        backgroundColor: '#F59E0B', // Yellow
    },
    dotOnline: {
        backgroundColor: '#10B981', // Green
    },
    text: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    subtext: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    badge: {
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
});

export default OfflineIndicator;
