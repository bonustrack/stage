/** @file Expo app config with prod/dev variants and git-SHA stamping for the About page. */

// @ts-check

/** Resolve the short (7-char) git commit SHA for the About page from EAS/CI env or git, else 'dev'. */
function resolveGitHash() {
  const fromEnv =
    process.env.EAS_BUILD_GIT_COMMIT_HASH ||
    process.env.GIT_HASH ||
    process.env.GIT_COMMIT;
  if (fromEnv && fromEnv.length > 0) return fromEnv.slice(0, 7);
  try {
    const { execSync } = require('node:child_process');
    const sha = execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (sha.length > 0) return sha;
  } catch {
    /** Not a git checkout (e.g. shallow CI without .git) - fall through to 'dev'. */
  }
  return 'dev';
}

/** Expo config has TWO native-only variants (prod/dev via APP_VARIANT) that install side-by-side on one device. */

/** Prod display name — ONE-LINE change if the user wants "State" instead. */
const PROD_NAME = 'Stage';

const IS_PROD = process.env.APP_VARIANT === 'prod';

/** Per-variant native identity; dev ids match the original app.json, prod mirrors its reverse-DNS-of-host structure. */
const variant = IS_PROD
  ? {
      name: PROD_NAME,
      slug: 'metro', /** EAS project slug is fixed (same Expo project / projectId). */
      scheme: 'stage',
      host: 'stage.box',
      bundleId: 'box.stage',
      androidPackage: 'box.stage',
      /** Prod Firebase file — MUST be added before a prod Android build succeeds (still MISSING). */
      googleServicesFile: './google-services.prod.json',
    }
  : {
      name: 'Stage',
      slug: 'metro',
      scheme: 'stage',
      host: 'metro.box',
      bundleId: 'box.metro.monitor',
      androidPackage: 'box.metro.monitor',
      googleServicesFile: './google-services.json',
    };

/** @type {import('@expo/config-types').ExpoConfig} */
const config = {
  name: variant.name,
  slug: variant.slug,
  scheme: variant.scheme,
  version: '0.1.2',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  /** Required true: reanimated 4.x + worklets are new-architecture-ONLY (the launch crash is fixed elsewhere). */
  newArchEnabled: true,
  /** expo-updates enables per-PR JS-bundle previews (#236); runtimeVersion is a FIXED string for JS-only match. */
  runtimeVersion: '1.0.0',
  updates: {
    /** Keep auto-fetch off: previews are loaded on demand via the dev-launcher, not on cold start. */
    enabled: true,
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
    /** EAS Update endpoint for this Expo project; required for `eas update` previews to resolve on-device. */
    url: 'https://u.expo.dev/1707f2db-c2b8-4c91-9341-27b1d57d355f',
  },
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0f1115',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: variant.bundleId,
    /** `webcredentials:` enables WebAuthn passkeys bound to the host (needs an AASA); `applinks:` stays alongside. */
    associatedDomains: [`applinks:${variant.host}`, `webcredentials:${variant.host}`],
  },
  android: {
    package: variant.androidPackage,
    versionCode: 27,
    /** Block READ_MEDIA/storage and FGS permissions Google Play flagged; we use the picker, never read media. */
    blockedPermissions: [
      /** Hard-block media/mic/overlay perms so no transitive AAR re-injects them at gradle manifest-merge. */
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f1115',
    },
    edgeToEdgeEnabled: true,
    androidStatusBar: {
      barStyle: 'light-content',
      translucent: true,
    },
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: 'resize',
    googleServicesFile: variant.googleServicesFile,
    allowBackup: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: variant.host }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        data: [{ scheme: variant.scheme }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    /** SDK-54 native cold-launch splash (replaces the deprecated top-level `splash` key); needs a new build. */
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0f1115',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#ffffff',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: `Allow ${variant.name} to choose images to send in the messenger.`,
        cameraPermission: `Allow ${variant.name} to take photos to send in the messenger.`,
      },
    ],
    [
      'expo-av',
      {
        microphonePermission: `Allow ${variant.name} to record voice messages.`,
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: `Allow ${variant.name} to share your current location in chat.`,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: `Allow ${variant.name} to show your recent photos in the message composer.`,
        savePhotosPermission: `Allow ${variant.name} to save photos.`,
        isAccessMediaLocationEnabled: false,
        granularPermissions: ['photo'],
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 30,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
    './plugins/withMetroPill',
    './plugins/withGradleMemory',
    './plugins/withBouncyCastleDedup',
    /** Embedded Node runtime hosting the RAILGUN engine + prover; adds pickFirst for dup native libs (needs new APK). */
    './plugins/withNodejsMobile',
    /** Native audio-decode (decodeAudioData only); disables its FGS/iOS audio defaults Google Play flagged. */
    [
      'react-native-audio-api',
      {
        iosBackgroundMode: false,
        androidForegroundService: false,
        androidPermissions: ['android.permission.FOREGROUND_SERVICE'],
      },
    ],
    /** RAILGUN wallet JS SDK autolinks normally; proving needs the native prover dep + a new APK, no plugin entry. */
  ],
  notification: {
    icon: './assets/notification-icon.png',
    color: '#ffffff',
    iosDisplayInForeground: true,
    androidMode: 'default',
  },
  extra: {
    router: {},
    eas: {
      projectId: '1707f2db-c2b8-4c91-9341-27b1d57d355f',
    },
    /** Git commit hash for the System -> About page, resolved by resolveGitHash(). */
    gitHash: resolveGitHash(),
    /** Active EAS build profile (development | preview | production), surfaced on the About page. */
    buildProfile: process.env.EAS_BUILD_PROFILE || 'dev',
  },
  owner: 'bonustrack',
};

module.exports = { expo: config };
