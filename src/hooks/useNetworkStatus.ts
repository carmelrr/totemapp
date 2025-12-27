/**
 * @fileoverview Network Status Hook
 * @description Monitor network connectivity for offline-first functionality
 * Following TopLogger's approach to handling offline scenarios
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/ApiClient';
import { useRoutesStore } from '@/store/routesStore';

interface NetworkStatus {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string;
    details: {
        isWifi: boolean;
        isCellular: boolean;
        strength?: number;
    };
}

// Try to import NetInfo, fall back to always-online if not available
let NetInfo: any = null;
try {
    NetInfo = require('@react-native-community/netinfo').default;
} catch (e) {
    console.warn('[NetworkStatus] NetInfo not available, assuming always online');
}

interface NetworkStatus {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string;
    details: {
        isWifi: boolean;
        isCellular: boolean;
        strength?: number;
    };
}

/**
 * Hook to monitor network connectivity
 * Automatically syncs pending operations when coming back online
 */
export function useNetworkStatus() {
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
        isConnected: true,
        isInternetReachable: true,
        type: 'unknown',
        details: {
            isWifi: false,
            isCellular: false,
        },
    });

    const processPendingOperations = useRoutesStore((state) => state.processPendingOperations);

    // Handle network state changes
    const handleNetworkChange = useCallback((state: any) => {
        const newStatus: NetworkStatus = {
            isConnected: state.isConnected ?? false,
            isInternetReachable: state.isInternetReachable,
            type: state.type,
            details: {
                isWifi: state.type === 'wifi',
                isCellular: state.type === 'cellular',
                strength: (state.details as any)?.strength,
            },
        };

        setNetworkStatus(newStatus);

        // Update API client
        apiClient.setOnlineStatus(newStatus.isConnected && newStatus.isInternetReachable !== false);

        // If coming back online, process pending operations
        if (newStatus.isConnected && newStatus.isInternetReachable) {
            console.log('[NetworkStatus] Back online, processing pending operations...');
            processPendingOperations();
        }
    }, [processPendingOperations]);

    useEffect(() => {
        let subscription: (() => void) | null = null;

        // If NetInfo is not available, assume always online
        if (!NetInfo) {
            return;
        }

        // Get initial state
        NetInfo.fetch().then(handleNetworkChange);

        // Subscribe to changes
        subscription = NetInfo.addEventListener(handleNetworkChange);

        return () => {
            if (subscription) {
                subscription();
            }
        };
    }, [handleNetworkChange]);

    return networkStatus;
}

/**
 * Hook to check if we should show offline indicator
 */
export function useIsOffline(): boolean {
    const { isConnected, isInternetReachable } = useNetworkStatus();
    return !isConnected || isInternetReachable === false;
}

/**
 * Hook to get pending operations count
 */
export function usePendingOperationsCount(): number {
    return useRoutesStore((state) => state.pendingOperations.length);
}

/**
 * Hook for offline-aware data fetching
 * Shows cached data when offline, syncs when online
 */
export function useOfflineAwareData<T>(
    fetchFn: () => Promise<T>,
    cachedData: T | null,
    options: {
        refreshOnReconnect?: boolean;
        onError?: (error: Error) => void;
    } = {}
) {
    const { refreshOnReconnect = true, onError } = options;
    const [data, setData] = useState<T | null>(cachedData);
    const [isLoading, setIsLoading] = useState(!cachedData);
    const [error, setError] = useState<Error | null>(null);
    const networkStatus = useNetworkStatus();

    const refresh = useCallback(async () => {
        if (!networkStatus.isConnected) {
            console.log('[useOfflineAwareData] Offline, using cached data');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await fetchFn();
            setData(result);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onError?.(error);

            // Fall back to cached data on error
            if (cachedData) {
                setData(cachedData);
            }
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn, networkStatus.isConnected, cachedData, onError]);

    // Refresh when coming back online
    useEffect(() => {
        if (refreshOnReconnect && networkStatus.isConnected && networkStatus.isInternetReachable) {
            refresh();
        }
    }, [networkStatus.isConnected, networkStatus.isInternetReachable, refreshOnReconnect, refresh]);

    return {
        data,
        isLoading,
        error,
        refresh,
        isOffline: !networkStatus.isConnected,
        isFromCache: !networkStatus.isConnected && data === cachedData,
    };
}
