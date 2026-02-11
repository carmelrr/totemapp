// App.js
import { I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';

// Force LTR layout for ALL users regardless of device language settings.
// Hebrew text direction is handled per-component via writingDirection style,
// but the overall app layout must always be LTR to keep the map, flash
// rings, and all visual elements consistent.

if (I18nManager.isRTL) {
  // User has stale RTL state from a previous version — flip to LTR and
  // reload so the change takes visual effect immediately.
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
  // reloadAsync works in both production and dev; on Android it restarts
  // the JS bundle, on iOS it behaves like a full re-launch.
  Updates.reloadAsync().catch(() => {
    // Fallback: the flags are saved — next cold start will be LTR.
  });
} else {
  // Already LTR — just make sure the flags stay locked.
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

export { default } from "./src/App";
