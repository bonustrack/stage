/** @file Expo plugin for nodejs-mobile-react-native: pickFirst libnode.so, force extractNativeLibs, guard the node assets (iOS no-op). */
const {
  withAppBuildGradle,
  withDangerousMod,
  withAndroidManifest,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Pure, unit-testable transforms (libc++_shared.so excluded on purpose); this plugin only wraps them in the mod runners. */
const {
  transformAppBuildGradle,
  setExtractNativeLibs,
} = require('./nodejsMobileConfig');

/** Edit the emitted groovy build.gradle to pickFirst libnode.so and set the winning ignoreAssetsPattern so every node asset is packaged. */
function withNodejsMobileGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    cfg.modResults.contents = transformAppBuildGradle(cfg.modResults.contents);
    return cfg;
  });
}

/** Warn (never write) at prebuild if nodejs-assets/nodejs-project/main.js is missing so a lost scaffold is not silent. */
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

/** Force android:extractNativeLibs=true so libnode.so loads via System.loadLibrary("node") at launch instead of crashing. */
function withExtractNativeLibs(config) {
  return withAndroidManifest(config, (cfg) => {
    setExtractNativeLibs(cfg.modResults.manifest);
    return cfg;
  });
}

/** Compose the nodejs-mobile gradle, extract-native-libs, and assets-guard mods into one plugin. @param {import('@expo/config-plugins').ExportedConfig} config */
function withNodejsMobile(config) {
  config = withNodejsMobileGradle(config);
  config = withExtractNativeLibs(config);
  config = withNodejsAssetsGuard(config);
  return config;
}

module.exports = withNodejsMobile;
