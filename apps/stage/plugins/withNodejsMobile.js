const {
  withAppBuildGradle,
  withDangerousMod,
  withAndroidManifest,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const {
  transformAppBuildGradle,
  setExtractNativeLibs,
} = require('./nodejsMobileConfig');

function withNodejsMobileGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    cfg.modResults.contents = transformAppBuildGradle(cfg.modResults.contents);
    return cfg;
  });
}

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

function withExtractNativeLibs(config) {
  return withAndroidManifest(config, (cfg) => {
    setExtractNativeLibs(cfg.modResults.manifest);
    return cfg;
  });
}

function withNodejsMobile(config) {
  config = withNodejsMobileGradle(config);
  config = withExtractNativeLibs(config);
  config = withNodejsAssetsGuard(config);
  return config;
}

module.exports = withNodejsMobile;
