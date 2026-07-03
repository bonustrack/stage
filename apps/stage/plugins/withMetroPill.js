const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
];

const FCM_SERVICE_NAME = 'box.metro.pill.MetroFcmService';

const EXPO_FCM_SERVICE_NAME =
  'expo.modules.notifications.service.ExpoFirebaseMessagingService';

function withMetroPill(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

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

    for (const activity of app.activity || []) {
      if (activity.$) activity.$['android:resizeableActivity'] = 'true';
    }

    return cfg;
  });
}

module.exports = withMetroPill;
