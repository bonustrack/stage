// One-off build helper for the local EAS dev-client APK: the default Expo
// template ships android/gradle.properties with org.gradle.jvmargs=-Xmx2048m,
// which OOMs during R8/signing on this app (nodejs-mobile + railgun + many
// native modules). Bump heap + metaspace so the local build completes.
const { withGradleProperties } = require('expo/config-plugins');
// Pure transform (testable without the expo runtime) — see nodejsMobileConfig.js
// + test/railgunPluginConfig.test.ts.
const { setGradleMemory } = require('./nodejsMobileConfig');

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    setGradleMemory(cfg.modResults);
    return cfg;
  });
};
