/**
 * Expo config plugin for `nodejs-mobile-react-native` (the embedded Node runtime
 * that hosts the RAILGUN engine + the native Groth16 prover — see
 * apps/app/lib/railgun/bridge/* and apps/app/nodejs-assets/nodejs-project).
 *
 * WHAT AUTOLINKING ALREADY DOES (so this plugin does NOT redo it):
 *   nodejs-mobile-react-native ships a `react-native.config.js` declaring its
 *   android `sourceDir` + iOS post-compile script phases, and its own
 *   `android/build.gradle` that wires the nodejs-assets/nodejs-project bundling
 *   (CopyNodeProjectAssetsFolder → GenerateNodeProjectAssetsLists →
 *   preBuild.dependsOn) and the per-ABI native-module build tasks. Expo SDK 54
 *   autolinks transitive RN modules, so `expo prebuild` picks the module up with
 *   NO settings.gradle / app build.gradle edits. The classic manual install
 *   steps (apply-from in settings.gradle, implementation project(...)) are
 *   therefore intentionally OMITTED — they would double-link under autolinking.
 *
 * WHAT STILL BREAKS WITHOUT HELP (and what this plugin / the bun patch fix):
 *   1. AGP 8 (RN 0.81 / SDK 54) rejects the module's legacy `package=` manifest
 *      attribute and requires a `namespace`. Fixed in node_modules at install
 *      time by patches/nodejs-mobile-react-native@18.20.4.patch (bun
 *      patchedDependencies) — NOT here, because a config plugin can only edit the
 *      generated android/ project, not node_modules.
 *   2. The module bundles its own `libnode.so` and `libc++_shared.so` (and the
 *      prover later adds more .so/.node prebuilds). These collide with RN's own
 *      libc++_shared.so during APK packaging → "More than one file ... abi/...".
 *      THIS plugin adds packagingOptions.jniLibs.pickFirst so the merge wins
 *      deterministically instead of failing.
 *   3. nodejs-mobile's libnode.so must not be stripped/compressed in a way that
 *      breaks dlopen of the bundled native modules — we keep the default useLegacy
 *      jniLibs packaging off (RN 0.81 default) and only pick-first the clashes.
 *
 * iOS: STUBBED for this pass (Android is the priority — see task). The module's
 *   react-native.config.js already injects the four iOS script phases via
 *   `pod install`, and CocoaPods autolinking will include the podspec. No extra
 *   Info.plist / entitlement is required just to boot the runtime, so the iOS
 *   branch here is a documented no-op. Revisit when we wire iOS proving.
 */
const {
  withAppBuildGradle,
  withDangerousMod,
  withAndroidManifest,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** .so libraries nodejs-mobile + RN both ship; pickFirst resolves the clash. */
const PICK_FIRST = [
  'lib/**/libnode.so',
  'lib/**/libc++_shared.so',
];

/** Insert (idempotently) a packagingOptions.jniLibs.pickFirst block into the
 *  app module's android {} so the duplicate .so files from nodejs-mobile don't
 *  fail the APK merge. Works on the Groovy build.gradle Expo prebuild emits. */
function withNodejsMobileGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let src = cfg.modResults.contents;
    if (src.includes('// nodejs-mobile-pickFirst')) return cfg;
    const picks = PICK_FIRST.map((p) => `            pickFirst '${p}'`).join('\n');
    const block = [
      '    // nodejs-mobile-pickFirst — resolve duplicate native libs (libnode/',
      '    // libc++_shared) the embedded Node runtime bundles alongside RN.',
      '    packagingOptions {',
      '        jniLibs {',
      '            useLegacyPackaging true',
      picks,
      '        }',
      '    }',
    ].join('\n');
    // Inject as the first statement inside the top-level `android {` block.
    src = src.replace(/android\s*\{/, (m) => `${m}\n${block}\n`);
    cfg.modResults.contents = src;
    return cfg;
  });
}

/** Safety net: guarantee nodejs-assets/nodejs-project exists at prebuild time.
 *  The committed scaffold means it always does, but if a fresh clone ever lost
 *  it the module's gradle CopyNodeProjectAssetsFolder task would silently bundle
 *  nothing. We only WARN (never write) so we don't mask a real problem. */
function withNodejsAssetsGuard(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const proj = path.join(root, 'nodejs-assets', 'nodejs-project', 'main.js');
      if (!fs.existsSync(proj)) {
        // eslint-disable-next-line no-console
        console.warn(
          '[withNodejsMobile] nodejs-assets/nodejs-project/main.js is missing — ' +
            'the embedded Node runtime will boot with no host script.',
        );
      }
      return cfg;
    },
  ]);
}

/** nodejs-mobile's libnode.so is loaded in a Java static initializer via
 *  System.loadLibrary("node") at app launch (before JS). Under AGP 8 the default
 *  extractNativeLibs=false leaves it compressed-in-APK and the load fails →
 *  UnsatisfiedLinkError in a static block → SIGABRT on launch. Force extraction. */
function withExtractNativeLibs(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:extractNativeLibs'] = 'true';
    return cfg;
  });
}

/** @param {import('@expo/config-plugins').ExportedConfig} config */
function withNodejsMobile(config) {
  config = withNodejsMobileGradle(config);
  config = withExtractNativeLibs(config);
  config = withNodejsAssetsGuard(config);
  return config;
}

module.exports = withNodejsMobile;
