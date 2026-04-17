import { useState, useEffect } from 'react';
import { getVisibleColors } from '../utils/colors';
import {
  initializeColorSettings,
  subscribeToColorSettings,
  getColorSettingSync,
  getColorDisplayHex,
} from '../services/ColorSettingsService';

/**
 * Hook that returns a reactive list of visible colors (predefined − hidden + custom).
 * Initializes color settings on mount and subscribes to real-time Firestore changes.
 */
export function useVisibleColors() {
  const [colors, setColors] = useState<string[]>(() => getVisibleColors());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    initializeColorSettings().then(() => {
      setColors(getVisibleColors());
      setReady(true);

      // Subscribe to real-time changes
      unsubscribe = subscribeToColorSettings(() => {
        setColors(getVisibleColors());
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return { colors, ready, getColorSettingSync, getColorDisplayHex };
}
