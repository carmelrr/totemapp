// metro.config.js - תצורה מותאמת ל־Expo עם תמיכה ב־SVG, CJS ותיקון Firebase
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ תמיכה בקבצי CJS
config.resolver.sourceExts.push('cjs');

// ✅ ביטול exports package עבור Firebase
config.resolver.unstable_enablePackageExports = false;

// ✅ תמיכה בקבצי SVG (ייבוא כטקסט)
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts.push('svg');

module.exports = config;
