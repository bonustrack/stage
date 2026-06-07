// @ts-check
/**
 * Resolve the short git commit SHA for the About page.
 *
 * Priority (most authoritative first):
 *   1. EAS_BUILD_GIT_COMMIT_HASH - set automatically by EAS on cloud builds.
 *   2. GIT_HASH / GIT_COMMIT     - explicit env from CI (the PR-preview Action
 *                                  sets GIT_COMMIT to the PR head SHA before the
 *                                  expo export, so previews carry the right SHA).
 *   3. `git rev-parse --short HEAD` - local fallback so dev/local builds are
 *                                     stamped with the working-tree commit.
 *   4. 'dev' - last resort when none of the above resolve.
 *
 * Always normalised to a SHORT (7-char) sha so the About row stays compact.
 */
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
    // not a git checkout (e.g. shallow CI without .git) - fall through to 'dev'
  }
  return 'dev';
}

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
  // reanimated 4.x + react-native-worklets are new-architecture-ONLY: their
  // gradle assertNewArchitectureEnabledTask hard-fails when this is false. The
  // nodejs-mobile launch crash is fixed by extractNativeLibs + jniLibs pickFirst
  // (see plugins/withNodejsMobile.js), NOT by disabling the new architecture.
  newArchEnabled: true,
  // ── expo-updates: the native enabler for per-PR JS-bundle previews (#236) ──
  // The PR-preview GitHub Action publishes each PR's `expo export` bundle and
  // the installed dev-client loads it via the deep link
  //   metro://expo-development-client/?url=<manifest-url>
  // That "load from URL" flow REQUIRES the expo-updates library on-device, so
  // these keys take effect only in a NEW dev-client APK. Until that build ships,
  // PR previews can't be tapped to load (the dev-client has no updates client).
  //
  // `runtimeVersion` is a FIXED string (not a policy) so the manifest the Action
  // generates always matches the installed app on JS-only changes — bump it only
  // when a native/runtime-incompatible change ships in a new APK. `updates.url`
  // is left to EAS Update's default endpoint (channel/branch previews via
  // `eas update`); the self-hosted static-manifest variant overrides the manifest
  // URL at load time via the deep link, so no `updates.url` is needed for it.
  runtimeVersion: '1.0.0',
  updates: {
    // Keep auto-fetch off: previews are loaded on demand via the dev-launcher,
    // not silently applied on cold start. The installed dev-client + EXPO_TOKEN
    // EAS project (extra.eas.projectId) back the EAS Update preview path.
    enabled: true,
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
    // EAS Update endpoint for this Expo project (extra.eas.projectId). The
    // PR-preview deep link is u.expo.dev/<projectId>/group/<groupId>; this is
    // the same host. Required for `eas update` previews to resolve on-device.
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
    associatedDomains: [`applinks:${variant.host}`],
  },
  android: {
    package: variant.androidPackage,
    versionCode: 27,
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
    // Native cold-launch splash so the app shows the Metro logo on the themed
    // dark background instead of a blank gray screen. The legacy top-level
    // `splash` key above is deprecated under the new architecture; the
    // expo-splash-screen plugin is the SDK-54 form that generates the native
    // splash resources. Takes effect only in a NEW native build (EAS/local),
    // not a running dev client or the current installed bundle.
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
    // withGradleMemory / withNodejsMobile stay as thin app-local wrappers (they
    // need expo/config-plugins, which only resolves from the app's node_modules
    // under the non-hoisted bun workspace). The substantive, testable transforms
    // they call live in @metro-labs/railgun-mobile/plugin/nodejsMobileConfig.
    './plugins/withGradleMemory',
    './plugins/withBouncyCastleDedup',
    // Embedded Node runtime (nodejs-mobile-react-native) that hosts the RAILGUN
    // engine + native Groth16 prover. Autolinking wires the module; this plugin
    // adds packagingOptions.pickFirst for the duplicate native libs. The AGP-8
    // namespace fix lives in patches/nodejs-mobile-react-native@18.20.4.patch
    // (bun). Requires a NEW APK before the embedded runtime exists on-device.
    './plugins/withNodejsMobile',
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
    // Git commit hash for the System -> About page. Resolved by resolveGitHash():
    // EAS_BUILD_GIT_COMMIT_HASH (cloud builds) -> GIT_HASH / GIT_COMMIT (CI, incl.
    // the PR-preview Action) -> local `git rev-parse --short HEAD` -> 'dev'.
    gitHash: resolveGitHash(),
    // Active EAS build profile (development | preview | production), surfaced
    // on the About page when available.
    buildProfile: process.env.EAS_BUILD_PROFILE || 'dev',
  },
  owner: 'bonustrack',
};

module.exports = { expo: config };
