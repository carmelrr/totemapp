// App.js
import { I18nManager } from 'react-native';

// Force LTR layout immediately at app startup
// This ensures consistent left-to-right layout regardless of device language
if (I18nManager.isRTL) {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

export { default } from "./src/App";
