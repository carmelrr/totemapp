// app.config.js - Dynamic Expo configuration
// Uses environment variables for sensitive values instead of hardcoding them.
// See .env.example for required environment variables.

export default ({ config }) => {
  const isTvMode = process.env.EXPO_PUBLIC_TV_MODE === '1';
  const basePlugins = config.plugins || [];
  const plugins = isTvMode
    ? [...basePlugins, './plugins/withAndroidTv']
    : basePlugins;

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      eas: config.extra?.eas,
      webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    },
  };
};
