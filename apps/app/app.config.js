// @ts-check
/**
 * Expo app config — TWO variants that install side-by-side on one device.
 *
 * Variant is selected by the APP_VARIANT env var:
 *   APP_VARIANT=prod   → "Stage"  / stage://  / stage.box  / box.stage  ids
 *   (unset / anything) → "Metro"  / metro://  / metro.box  / box.metro.monitor (dev, default)
 *
 * Only NATIVE config differs between variants (app name, scheme, bundle id /
 * package, associated domains, intent filters, Firebase file). The runtime
 * deep-link parser (lib/deepLinks.ts) is already scheme-agnostic — it parses
 * whatever custom scheme the OS hands it — so stage:// links work with no JS
 * change. Push-tap navigation (lib/pushRegister.ts) routes by convId in the
 * notification `data`, not by URL scheme, so it's variant-agnostic too.
 *
 * NOTE: these are native-build-time settings. Switching variant requires a NEW
 * native build (EAS or local); it has no effect on a running dev client or the
 * current installed bundle.
 */

// ─── Prod display name — ONE-LINE change if the user wants "State" instead. ───
const PROD_NAME = 'Stage';
// ──────────────────────────────────────────────────────────────────────────

const IS_PROD = process.env.APP_VARIANT === 'prod';

/** Per-variant native identity. Dev ids are UNCHANGED from the original
 *  app.json so existing installs/builds keep working. Prod mirrors dev's
 *  reverse-DNS-of-host structure: metro.box→box.metro.monitor, stage.box→box.stage. */
const variant = IS_PROD
  ? {
      name: PROD_NAME,
      slug: 'metro', // EAS project slug is fixed (same Expo project / projectId).
      scheme: 'stage',
      host: 'stage.box',
      bundleId: 'box.stage',
      androidPackage: 'box.stage',
      // Prod Firebase file — MUST be added before a prod Android build will
      // succeed. See report: prod google-services.json is still MISSING.
      googleServicesFile: './google-services.prod.json',
    }
  : {
      name: 'Metro',
      slug: 'metro',
      scheme: 'metro',
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
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0f1115',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: variant.bundleId,
    associatedDomains: [`applinks:${variant.host}`],
  },
  android: {
    package: variant.androidPackage,
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
    // react-native-webrtc — NATIVE module powering video/voice calls. The
    // config plugin wires the Android/iOS build (camera + mic permissions,
    // Gradle/Podfile glue). Requires a NEW dev-client APK before the camera
    // preview / RTCView renders; until then lib/webrtc gates and the test
    // screen shows "WebRTC needs the dev build".
    [
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission: 'Metro uses your camera for video calls.',
        microphonePermission: 'Metro uses your microphone for calls.',
      },
    ],
    // Native audio-decode module — powers TRUE voice-message waveforms
    // (decodeAudioData → PCM). Requires a new dev-client build to take effect.
    'react-native-audio-api',
    // RAILGUN private wallet — the JS SDK (@railgun-community/wallet +
    // shared-models + ethers) is autolinked as a normal JS dep. PROVING needs
    // the C++ Groth16 prover `@railgun-community/native-prover`, a NATIVE
    // module: it is NOT yet an npm package, so it must be added to package.json
    // (git/tarball source) and will then autolink via Expo prebuild — NO config
    // plugin entry is required for autolinking, but a NEW APK is REQUIRED before
    // the Private wallet can prove. Until that build ships, lib/railgun gates on
    // the prover's presence and the Private tab shows "needs the new app build"
    // (see lib/railgun/native.ts). Add the native-prover dep + rebuild the APK
    // to enable shield/transfer/unshield.
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
    // Git commit hash for the System → About page. EAS sets
    // EAS_BUILD_GIT_COMMIT_HASH on cloud builds; falls back to a local GIT_HASH
    // env or 'dev' when running an un-stamped dev bundle.
    gitHash:
      process.env.EAS_BUILD_GIT_COMMIT_HASH || process.env.GIT_HASH || 'dev',
    // Active EAS build profile (development | preview | production), surfaced
    // on the About page when available.
    buildProfile: process.env.EAS_BUILD_PROFILE || 'dev',
  },
  owner: 'bonustrack',
};

module.exports = { expo: config };
