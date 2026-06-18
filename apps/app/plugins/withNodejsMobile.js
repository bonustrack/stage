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
 *   2. The module bundles its own `libnode.so` (and the prover later adds more
 *      .so/.node prebuilds). libnode.so has no RN counterpart but the per-ABI
 *      build can still produce a packaging dup → "More than one file ... abi/...".
 *      THIS plugin adds packagingOptions.jniLibs.pickFirst for libnode.so so the
 *      merge wins deterministically instead of failing. It does NOT pick-first
 *      libc++_shared.so: the bun patch makes nodejs-mobile rely on the app's
 *      (RN/Expo) STL instead of compiling + shipping its own NDK-24
 *      libc++_shared.so, so there is no dup — and blanket-picking it could keep
 *      the wrong STL and shadow the one XMTP's Rust MLS lib was built against.
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

/** .so libraries nodejs-mobile + RN both ship; pickFirst resolves the clash.
 *
 *  NOTE: libc++_shared.so was DELIBERATELY removed from this list. The bun patch
 *  (patches/nodejs-mobile-react-native@18.20.4.patch) now forces the module's
 *  DoesAppAlreadyDefineWantedSTL() → true, so nodejs-mobile no longer compiles
 *  with -DANDROID_STL=c++_shared and no longer emits its OWN NDK-24
 *  libc++_shared.so. With only RN/Expo's libc++_shared.so present there is no dup
 *  to arbitrate. Blanket-picking it here was the bug: gradle could keep
 *  nodejs-mobile's NDK-24 STL and drop RN's, shadowing the STL that XMTP's Rust
 *  MLS lib (libuniffi_xmtpv3.so) was built against → instant crash at XMTP.create.
 *  If a future build still reports a libc++_shared.so merge dup, add it back as a
 *  pickFirst — it will now pick RN's (the only remaining one). */
// PURE transforms (PICK_FIRST list, aapt pattern, the groovy/manifest edits)
// live in ./nodejsMobileConfig so they are unit-testable without the expo
// plugin runtime — see test/railgunPluginConfig.test.ts. This plugin only wraps
// them in the @expo/config-plugins mod runners.
const {
  transformAppBuildGradle,
  setExtractNativeLibs,
} = require('./nodejsMobileConfig');

/** Insert the libnode.so pickFirst block AND make aapt package every asset
 *  nodejs-mobile lists, by editing the Groovy build.gradle Expo prebuild emits.
 *
 *  WHY THE aapt PATTERN MATTERS (the "Node assets copy failed" launch crash):
 *  nodejs-mobile-react-native's GenerateNodeProjectAssetsLists builds `file.list`
 *  with a Gradle fileTree that excludes ONLY `**​/.*` (dotfiles) and `**​/*~`. At
 *  launch RNNodeJsMobileModule reads file.list and AssetManager.open()s EVERY
 *  listed path, so the set aapt PACKAGES must be a superset of file.list — else the
 *  first missing entry throws FileNotFoundException → "Node assets copy failed".
 *  aapt's compiled-in DEFAULT pattern drops `.*` AND `<dir>_*` (every `_`-prefixed
 *  entry — dirs AND files, e.g. lodash `_baseClone.js`), which file.list contains →
 *  crash. ded2a8f tried pruning `_`-DIRS + a legacy `aaptOptions` override, but
 *  lodash et al. require() `_*.js` FILES at runtime (must NOT delete) and the
 *  override was applied to a block the template later OVERWRITES.
 *
 *  THE FIX: set the FINAL/winning `ignoreAssetsPattern` to `.*:*~` so aapt ignores
 *  EXACTLY what Gradle's file.list excludes and nothing else. Set-theory:
 *    packaged = ALL − {dotfiles, *~}   file.list = ALL − {dotfiles, *~}
 *  ⇒ packaged == file.list ⊇ file.list — every listed entry (incl. ALL `_`-prefixed
 *  dirs AND files) is packaged and AssetManager.open()-able. No `!` tokens are
 *  needed: `!` only un-ignores the literal default tokens, and we replace the whole
 *  string rather than relying on the defaults.
 *
 *  CRITICAL gotcha (found via the generated gradle): Expo SDK 54 / RN 0.81 prebuild
 *  ALREADY emits its own `androidResources { ignoreAssetsPattern '...' }` at the END
 *  of the android{} block. In Groovy the LAST assignment wins, so PREPENDING a block
 *  is inert — the template's value would override it. We therefore REPLACE the value
 *  inside the template's existing androidResources block (regex on the emitted
 *  string). If for some reason no such block exists, we fall back to appending one
 *  just before android{}'s closing brace so ours is still last. */
function withNodejsMobileGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    cfg.modResults.contents = transformAppBuildGradle(cfg.modResults.contents);
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
    setExtractNativeLibs(cfg.modResults.manifest);
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
