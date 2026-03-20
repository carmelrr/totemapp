// app.config.js - Dynamic Expo configuration
// Uses environment variables for sensitive values instead of hardcoding them.
// See .env.example for required environment variables.

export default ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      eas: config.extra?.eas,
      webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID || config.extra?.webClientId,
      androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID || config.extra?.androidClientId,
      iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID || config.extra?.iosClientId,
    },
  };
};
