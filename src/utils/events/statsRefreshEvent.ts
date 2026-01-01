/**
 * @fileoverview Simple event system for stats refresh notifications
 * @description Allows components to trigger and listen to stats refresh events
 * This solves the issue where profile stats don't update after feedback submission
 */

type StatsRefreshCallback = () => void;

class StatsRefreshEventEmitter {
  private listeners: Set<StatsRefreshCallback> = new Set();

  /**
   * Subscribe to stats refresh events
   * @returns Unsubscribe function
   */
  subscribe(callback: StatsRefreshCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Emit a stats refresh event to all listeners
   */
  emit(): void {
    this.listeners.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in stats refresh listener:", error);
      }
    });
  }

  /**
   * Get the number of active listeners (for debugging)
   */
  get listenerCount(): number {
    return this.listeners.size;
  }
}

// Singleton instance
export const statsRefreshEvent = new StatsRefreshEventEmitter();

/**
 * Trigger a stats refresh across all listening components
 * Call this after any action that modifies user stats (feedback, route completion, etc.)
 */
export function triggerStatsRefresh(): void {
  statsRefreshEvent.emit();
}
