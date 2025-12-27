/**
 * @fileoverview Centralized API Client - Abstraction layer for backend operations
 * @description Following TopLogger's architecture pattern - all data operations go through
 * a unified API client. This enables:
 * - Future migration to REST API
 * - Consistent error handling
 * - Request/response interceptors
 * - Offline queue management
 * - Caching strategies
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
export interface ApiConfig {
  baseUrl?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableOfflineQueue: boolean;
  enableCaching: boolean;
  cacheTimeout: number; // in milliseconds
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: undefined, // Using Firebase directly for now
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  enableOfflineQueue: true,
  enableCaching: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
};

// Request types
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiRequest<T = any> {
  endpoint: string;
  method: RequestMethod;
  data?: T;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  skipCache?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  error?: string;
  fromCache?: boolean;
  timestamp?: number;
}

// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Offline queue entry
interface QueuedRequest {
  id: string;
  request: ApiRequest;
  timestamp: number;
  retryCount: number;
}

/**
 * Centralized API Client
 * Provides unified interface for all backend operations
 */
class ApiClient {
  private config: ApiConfig;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private offlineQueue: QueuedRequest[] = [];
  private isOnline: boolean = true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeCache();
    this.setupNetworkListener();
  }

  // Initialize cache from AsyncStorage
  private async initializeCache(): Promise<void> {
    try {
      const cachedData = await AsyncStorage.getItem('@api_cache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        Object.entries(parsed).forEach(([key, value]) => {
          this.cache.set(key, value as CacheEntry<any>);
        });
      }

      // Load offline queue
      const queueData = await AsyncStorage.getItem('@api_offline_queue');
      if (queueData) {
        this.offlineQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.warn('[ApiClient] Failed to initialize cache:', error);
    }
  }

  // Setup network status listener
  private setupNetworkListener(): void {
    // In React Native, use NetInfo for network status
    // For now, assume online
    this.isOnline = true;
  }

  // Generate cache key for request
  private getCacheKey(request: ApiRequest): string {
    const { endpoint, method, params } = request;
    const paramString = params ? JSON.stringify(params) : '';
    return `${method}:${endpoint}:${paramString}`;
  }

  // Check if cache entry is valid
  private isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
  }

  // Get from cache
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (this.isCacheValid(entry)) {
      return entry!.data;
    }
    this.cache.delete(key);
    return null;
  }

  // Save to cache
  private async saveToCache<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.cacheTimeout,
    };
    this.cache.set(key, entry);

    // Persist to AsyncStorage
    try {
      const cacheObject: Record<string, CacheEntry<any>> = {};
      this.cache.forEach((value, k) => {
        if (this.isCacheValid(value)) {
          cacheObject[k] = value;
        }
      });
      await AsyncStorage.setItem('@api_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('[ApiClient] Failed to persist cache:', error);
    }
  }

  // Add to offline queue
  private async addToOfflineQueue(request: ApiRequest): Promise<void> {
    const queuedRequest: QueuedRequest = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      request,
      timestamp: Date.now(),
      retryCount: 0,
    };
    this.offlineQueue.push(queuedRequest);

    try {
      await AsyncStorage.setItem('@api_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.warn('[ApiClient] Failed to save offline queue:', error);
    }
  }

  // Process offline queue when back online
  async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) return;

    console.log(`[ApiClient] Processing ${this.offlineQueue.length} queued requests`);

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      try {
        // Re-execute the request
        // This would need to be integrated with actual Firebase operations
        console.log(`[ApiClient] Processing queued request: ${item.request.endpoint}`);
      } catch (error) {
        console.error(`[ApiClient] Failed to process queued request:`, error);
        if (item.retryCount < this.config.retryAttempts) {
          item.retryCount++;
          this.offlineQueue.push(item);
        }
      }
    }

    await AsyncStorage.setItem('@api_offline_queue', JSON.stringify(this.offlineQueue));
  }

  // Network status subscription
  onNetworkStatusChange(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Update network status
  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    this.listeners.forEach((listener) => listener(isOnline));

    // Process queue when coming back online
    if (wasOffline && isOnline) {
      this.processOfflineQueue();
    }
  }

  // Get online status
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    this.cache.clear();
    await AsyncStorage.removeItem('@api_cache');
  }

  // Clear offline queue
  async clearOfflineQueue(): Promise<void> {
    this.offlineQueue = [];
    await AsyncStorage.removeItem('@api_offline_queue');
  }

  // Get cache statistics
  getCacheStats(): { size: number; validEntries: number } {
    let validEntries = 0;
    this.cache.forEach((entry) => {
      if (this.isCacheValid(entry)) validEntries++;
    });
    return { size: this.cache.size, validEntries };
  }

  // Get offline queue length
  getOfflineQueueLength(): number {
    return this.offlineQueue.length;
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };
