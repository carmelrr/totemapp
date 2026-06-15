/**
 * withIosModularHeaders — Expo config plugin that adds `use_modular_headers!` to the
 * generated iOS Podfile.
 *
 * Fixes the CocoaPods "Install pods" failure:
 *   [!] The following Swift pods cannot yet be integrated as static libraries:
 *   The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and `RecaptchaInterop`,
 *   which do not define modules.
 *
 * `AppCheckCore` (a Swift pod) is pulled in transitively (GoogleSignIn / Firebase). To build
 * it as a static library, its non-modular Obj-C dependencies must generate module maps.
 * Enabling modular headers globally is the fix recommended by CocoaPods itself, and is the
 * standard remedy for Firebase/GoogleSignIn in managed Expo projects. Started failing only
 * after those floating transitive pod versions updated upstream — not a project code change.
 *
 * iOS-only (no-op on Android, which is prebuilt/committed).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DIRECTIVE = 'use_modular_headers!';

module.exports = function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(DIRECTIVE)) {
        // Insert as a global, top-level directive just before the first target block.
        const targetIndex = contents.indexOf('target ');
        if (targetIndex !== -1) {
          contents =
            contents.slice(0, targetIndex) + `${DIRECTIVE}\n\n` + contents.slice(targetIndex);
        } else {
          contents = `${DIRECTIVE}\n${contents}`;
        }
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
