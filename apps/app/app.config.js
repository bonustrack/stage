
// @ts-check

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
  }
  return 'dev';
}


const PROD_NAME = 'Stage';

const IS_PROD = process.env.APP_VARIANT === 'prod';

const variant = IS_PROD
  ? {
      name: PROD_NAME,
      slug: 'metro',
      scheme: 'stage',
      host: 'stage.box',
      bundleId: 'box.stage',
      androidPackage: 'box.stage',
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

const config = {
  name: variant.name,
  slug: variant.slug,
  scheme: variant.scheme,
  version: '0.1.2',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  runtimeVersion: '1.0.0',
  updates: {
    enabled: true,
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
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
    associatedDomains: [`applinks:${variant.host}`, `webcredentials:${variant.host}`],
  },
  android: {
    package: variant.androidPackage,
    versionCode: 27,
    blockedPermissions: [
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
    './plugins/withNodejsMobile',
    [
      'react-native-audio-api',
      {
        iosBackgroundMode: false,
        androidForegroundService: false,
        androidPermissions: ['android.permission.FOREGROUND_SERVICE'],
      },
    ],
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
    gitHash: resolveGitHash(),
    buildProfile: process.env.EAS_BUILD_PROFILE || 'dev',
  },
  owner: 'bonustrack',
};

module.exports = { expo: config };
