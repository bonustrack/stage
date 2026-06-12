/**
 * Config plugin: embed NATIVE debug symbols in release AABs.
 *
 * We ship large native libraries (the Railgun nodejs-mobile `libnode.so`, the
 * Groth16 prover, reanimated/worklets, etc). Without symbols, Play Console's
 * crash/ANR reports show only raw native addresses ("#00 pc 0x000abcd …"), which
 * are useless for debugging native stacks.
 *
 * The Android Gradle Plugin can embed a `native-debug-symbols.zip` directly in
 * the AAB when `release.ndk.debugSymbolLevel` is set. Play extracts it on upload
 * automatically - NO separate upload step, NO pipeline change, no Play API call.
 *
 * `SYMBOL_TABLE` (chosen) keeps function names for readable native stack frames
 * at a modest size cost. `FULL` additionally embeds file/line info but bloats the
 * symbols payload several-fold; SYMBOL_TABLE is the sane default for crash triage.
 *
 * expo-build-properties does NOT expose `debugSymbolLevel` (as of 1.0.10), so
 * this small plugin edits the generated `android/app/build.gradle` at prebuild
 * time. It is idempotent (no-op if already present) and only touches the release
 * buildType, so debug/dev-client builds are unaffected.
 *
 * NOTE: build-time only. Takes effect on the next native release build (AAB),
 * i.e. v0.1.3+. No effect on a running dev client or the current installed build.
 *
 * R8/minification is NOT enabled anywhere in this project (no
 * enableMinifyInReleaseBuilds / enableProguardInReleaseBuilds), so there is no
 * mapping.txt to upload - the deobfuscation half of Play's "missing symbols"
 * warning is moot by design; only the native-symbols half applies, which this
 * plugin satisfies.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const DEBUG_SYMBOL_LEVEL = 'SYMBOL_TABLE';

/**
 * Inject `ndk { debugSymbolLevel '<level>' }` into the release buildType of an
 * app `build.gradle`. Pure + idempotent so it's unit-testable without the Expo
 * runtime.
 * @param {string} buildGradle - contents of android/app/build.gradle
 * @returns {string}
 */
function setDebugSymbolLevel(buildGradle) {
  // Already wired (any quote style) - no-op.
  if (/debugSymbolLevel/.test(buildGradle)) return buildGradle;

  // Match the `release { … }` block inside `buildTypes { … }`. The Expo template
  // emits a `release {` line we can anchor to; insert the ndk block right after.
  const releaseAnchor = /(\n(\s*)release\s*\{)/;
  if (!releaseAnchor.test(buildGradle)) {
    throw new Error(
      "withNativeSymbols: could not find a `release {` buildType in app/build.gradle to attach debugSymbolLevel",
    );
  }
  return buildGradle.replace(releaseAnchor, (_m, head, indent) => {
    const inner = `${indent}    `;
    return (
      `${head}\n` +
      `${inner}// Embed native debug symbols in the AAB so Play Console crash\n` +
      `${inner}// reports show readable native stacks (added by withNativeSymbols).\n` +
      `${inner}ndk {\n` +
      `${inner}    debugSymbolLevel '${DEBUG_SYMBOL_LEVEL}'\n` +
      `${inner}}`
    );
  });
}

/** @param {import('@expo/config-plugins').ExportedConfig} config */
function withNativeSymbols(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `withNativeSymbols: expected a Groovy build.gradle, got ${cfg.modResults.language}`,
      );
    }
    cfg.modResults.contents = setDebugSymbolLevel(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withNativeSymbols;
module.exports.setDebugSymbolLevel = setDebugSymbolLevel;
module.exports.DEBUG_SYMBOL_LEVEL = DEBUG_SYMBOL_LEVEL;
