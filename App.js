// App.js
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Synchronize I18nManager RTL state with saved language preference.
// AsyncStorage.getItem is technically async, but in practice the native
// module returns almost instantly on subsequent launches because the
// JS bundle waits for native modules to initialize. The RTL flag is
// latched — once set it persists across reloads, so this only matters
// on first launch or when the user switches language.
(async () => {
  try {
    const lang = await AsyncStorage.getItem('app_language');
    const shouldBeRTL = lang !== 'en'; // default Hebrew = RTL
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    }
  } catch (_) {
    // First launch — default to RTL (Hebrew)
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  }
})();

export { default } from "./src/App";
