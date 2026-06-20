/** @file Expo plugin supplying the metro-pill module's manifest bits: POST_NOTIFICATIONS, FCM service, resizeable MainActivity for Bubbles. */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
];

const FCM_SERVICE_NAME = 'box.metro.pill.MetroFcmService';

/** Expo's default FirebaseMessagingService, stripped from the merged manifest below. */
const EXPO_FCM_SERVICE_NAME =
  'expo.modules.notifications.service.ExpoFirebaseMessagingService';

/** Apply the metro-pill manifest edits (tools namespace, permissions, FCM service swap, resizeable activity). @param {import('@expo/config-plugins').ExportedConfig} config */
function withMetroPill(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    /** Ensure the tools namespace is available so we can use tools:node="remove". */
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    /** Add required uses-permission entries. */
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

    /** Register MetroFcmService as the single MESSAGING_EVENT receiver, forwarding non-avatar pushes to Expo's service. */
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

    /** Strip Expo's FCM receiver via tools:node="remove" so only MetroFcmService fires (delegation still works via reflection). */
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

    /** Mark every activity resizeable so the bubble deep-link target qualifies for Android Bubbles. */
    for (const activity of app.activity || []) {
      if (activity.$) activity.$['android:resizeableActivity'] = 'true';
    }

    return cfg;
  });
}

module.exports = withMetroPill;
