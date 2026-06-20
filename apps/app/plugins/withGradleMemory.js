/** @file Expo plugin bumping gradle heap and metaspace so the local EAS dev-client APK build avoids R8/signing OOMs. */
const { withGradleProperties } = require('expo/config-plugins');
/** Pure transform testable without the expo runtime; see nodejsMobileConfig.js. */
const { setGradleMemory } = require('./nodejsMobileConfig');

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    setGradleMemory(cfg.modResults);
    return cfg;
  });
};
