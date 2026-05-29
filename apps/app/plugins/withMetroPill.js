/**
 * Config plugin for the local `metro-pill` native module.
 *
 * Because there is no committed `android/` dir (prebuild runs on EAS), the
 * manifest permissions + the foreground-service declaration must come from a
 * config plugin so they survive every prebuild. The local module under
 * `modules/metro-pill` is auto-linked by Expo autolinking — this plugin only
 * supplies the manifest bits the module needs.
 *
 * Adds:
 *   - SYSTEM_ALERT_WINDOW   (floating overlay pill; the one nothing else grants)
 *   - RECORD_AUDIO          (mic; also covered by expo-av, declared for clarity)
 *   - FOREGROUND_SERVICE    + FOREGROUND_SERVICE_MICROPHONE (API 34+ mic FGS)
 *   - POST_NOTIFICATIONS    (API 33+, for the FGS + bubble notifications)
 *   - <service> OverlayService with foregroundServiceType="microphone"
 *   - android:resizeableActivity="true" on MainActivity — REQUIRED for Android
 *     Bubbles. The activity launched inside a bubble must be resizeable or the
 *     system silently refuses to float it (isBubblesSupported() can be true yet
 *     openAsBubble() shows nothing). Default RN/Expo manifests omit this.
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.RECORD_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.POST_NOTIFICATIONS',
];

const SERVICE_NAME = 'box.metro.pill.OverlayService';

/** @param {import('@expo/config-plugins').ExportedConfig} config */
function withMetroPill(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // --- permissions ---
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (u) => u.$ && u.$['android:name'] === name,
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    // --- foreground service declaration ---
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = app.service || [];
    const hasService = app.service.some(
      (s) => s.$ && s.$['android:name'] === SERVICE_NAME,
    );
    if (!hasService) {
      app.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone',
        },
      });
    }

    // --- MainActivity must be resizeable for Android Bubbles ---
    // A bubble hosts the target activity in a floating, resizeable window; if the
    // activity isn't resizeable the OS won't float it. Set it on every <activity>
    // (there's only MainActivity in this app) so the bubble deep-link target qualifies.
    for (const activity of app.activity || []) {
      if (activity.$) activity.$['android:resizeableActivity'] = 'true';
    }

    return cfg;
  });
}

module.exports = withMetroPill;
