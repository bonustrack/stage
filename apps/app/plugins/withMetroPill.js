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
 *   - POST_NOTIFICATIONS    (API 33+, for the bubble + FCM notifications)
 *   - <service> MetroFcmService (the single FirebaseMessagingService receiver)
 *   - android:resizeableActivity="true" on MainActivity — REQUIRED for Android
 *     Bubbles. The activity launched inside a bubble must be resizeable or the
 *     system silently refuses to float it (isBubblesSupported() can be true yet
 *     openAsBubble() shows nothing). Default RN/Expo manifests omit this.
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
];

const FCM_SERVICE_NAME = 'box.metro.pill.MetroFcmService';

/** @param {import('@expo/config-plugins').ExportedConfig} config */
const EXPO_FCM_SERVICE_NAME =
  'expo.modules.notifications.service.ExpoFirebaseMessagingService';

function withMetroPill(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure the `tools` namespace is available so we can use tools:node="remove".
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

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

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = app.service || [];

    // --- custom FCM service (the ONLY MESSAGING_EVENT receiver) ---
    // MetroFcmService is the single FirebaseMessagingService that receives FCM
    // messages. It renders avatar data-pushes natively (custom RemoteViews with
    // the avatar on the left) and reflectively forwards every other push to an
    // *instance* of ExpoFirebaseMessagingService (see MetroFcmService.kt) so all
    // existing expo-notifications behaviour is preserved.
    const hasFcm = app.service.some(
      (s) => s.$ && s.$['android:name'] === FCM_SERVICE_NAME,
    );
    if (!hasFcm) {
      app.service.push({
        $: {
          'android:name': FCM_SERVICE_NAME,
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }],
          },
        ],
      });
    }

    // --- strip Expo's FCM receiver from the merged manifest ---
    // The intent-filter priority trick does NOT make FCM route a data message to
    // a single service: FCM dispatches to whichever FirebaseMessagingService is
    // registered, and expo-notifications' ExpoFirebaseMessagingService is still a
    // MESSAGING_EVENT receiver at priority 0 in the merged manifest — so BOTH
    // services fire and the user gets two cards. We remove Expo's <service> via
    // the manifest-merger tools:node="remove" marker. Delegation still works
    // because MetroFcmService instantiates the Expo service class directly
    // (reflection) — that path does not need the manifest receiver.
    const hasExpoRemoval = app.service.some(
      (s) =>
        s.$ &&
        s.$['android:name'] === EXPO_FCM_SERVICE_NAME &&
        s.$['tools:node'] === 'remove',
    );
    if (!hasExpoRemoval) {
      app.service.push({
        $: {
          'android:name': EXPO_FCM_SERVICE_NAME,
          'tools:node': 'remove',
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
