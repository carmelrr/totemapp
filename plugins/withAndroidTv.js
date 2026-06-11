/**
 * withAndroidTv — Expo config plugin that makes the Android build installable
 * and launchable on Android TV (leanback) devices.
 *
 * Applied only for the dedicated TV build (see app.config.js, gated on
 * EXPO_PUBLIC_TV_MODE) so regular phone/tablet builds are unaffected.
 *
 * It:
 *  - declares the leanback software feature (not required, so phones still work)
 *  - marks touchscreen as not required (TVs have no touchscreen)
 *  - adds the LEANBACK_LAUNCHER category to the main activity so the app shows
 *    up on the Android TV home screen
 *  - sets an application banner (required for the TV launcher)
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const LEANBACK_LAUNCHER = 'android.intent.category.LEANBACK_LAUNCHER';

function ensureUsesFeature(manifest, name, required) {
  manifest['uses-feature'] = manifest['uses-feature'] || [];
  const existing = manifest['uses-feature'].find(
    (f) => f.$ && f.$['android:name'] === name,
  );
  if (existing) {
    existing.$['android:required'] = String(required);
  } else {
    manifest['uses-feature'].push({
      $: { 'android:name': name, 'android:required': String(required) },
    });
  }
}

const withAndroidTv = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Feature declarations at the manifest root.
    ensureUsesFeature(manifest, 'android.software.leanback', false);
    ensureUsesFeature(manifest, 'android.hardware.touchscreen', false);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults,
    );

    // Banner shown on the Android TV launcher.
    application.$['android:banner'] = '@mipmap/ic_launcher';

    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      cfg.modResults,
    );

    // Add LEANBACK_LAUNCHER category to the existing LAUNCHER intent-filter.
    const intentFilters = mainActivity['intent-filter'] || [];
    for (const filter of intentFilters) {
      const categories = filter.category || [];
      const isLauncher = categories.some(
        (c) => c.$ && c.$['android:name'] === 'android.intent.category.LAUNCHER',
      );
      if (isLauncher) {
        const hasLeanback = categories.some(
          (c) => c.$ && c.$['android:name'] === LEANBACK_LAUNCHER,
        );
        if (!hasLeanback) {
          categories.push({ $: { 'android:name': LEANBACK_LAUNCHER } });
        }
        filter.category = categories;
      }
    }

    return cfg;
  });
};

module.exports = withAndroidTv;
