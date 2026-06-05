// One-off build helper for the local EAS dev-client APK: the default Expo
// template ships android/gradle.properties with org.gradle.jvmargs=-Xmx2048m,
// which OOMs during R8/signing on this app (nodejs-mobile + railgun + many
// native modules). Bump heap + metaspace so the local build completes.
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const set = (key, value) => {
      const existing = props.find(
        (p) => p.type === 'property' && p.key === key,
      );
      if (existing) existing.value = value;
      else props.push({ type: 'property', key, value });
    };
    set(
      'org.gradle.jvmargs',
      '-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
    );
    return cfg;
  });
};
