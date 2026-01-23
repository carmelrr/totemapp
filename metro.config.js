// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// ✅ תמיכה בקבצי CJS
config.resolver.sourceExts.push("cjs");

// ✅ תמיכה בקבצי SVG (ייבוא כטקסט)
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg",
);
config.resolver.sourceExts.push("svg");

// ✅ תמיכה בקבצי database (אם נדרש)
config.resolver.assetExts.push("db");

// ✅ אופטימיזציה ל-production builds
if (process.env.NODE_ENV === 'production') {
  config.transformer.minifierConfig = {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  };
}

module.exports = config;
