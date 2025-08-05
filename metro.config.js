// metro.config.js - תצורה מותאמת ל־Expo עם תמיכה ב־SVG ו־CJS
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ תמיכה בקבצי CJS
config.resolver.sourceExts.push('cjs');

// ✅ תמיכה בקבצי SVG (ייבוא כטקסט)
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts.push('svg');

// ✅ הגדרות רשת לחיבור יציב עם Expo Go
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // הוספת headers לחיבור טוב יותר
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return middleware(req, res, next);
    };
  }
};

module.exports = config;
