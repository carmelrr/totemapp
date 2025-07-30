// metro.config.js - תצורה מותאמת ל־Expo עם תמיכה ב־SVG ו־CJS
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ תמיכה בקבצי CJS
config.resolver.sourceExts.push('cjs');

// ✅ תמיכה בקבצי SVG (ייבוא כטקסט)
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts.push('svg');

module.exports = config;
