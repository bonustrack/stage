/**
 * Config plugin: raise the gradle daemon JVM heap + metaspace.
 *
 * The production app-bundle build compiles THREE ABIs (arm64-v8a, armeabi-v7a,
 * x86_64) and then runs bundletool in :app:signReleaseBundle to finalize +
 * sign the .aab. With the default daemon heap/metaspace that finalize step
 * (and, under memory pressure, even mid-build CMake configure) thrashes GC and
 * the daemon dies:
 *   org.gradle.launcher.daemon.server.api.DaemonStoppedException:
 *   Gradle build daemon has been stopped: since the JVM garbage collector is
 *   thrashing and after running out of JVM Metaspace
 *
 * There is no committed android/ dir (prebuild runs at build time), and
 * expo-build-properties 1.0.x exposes no gradleProperties key, so we patch
 * android/gradle.properties during prebuild here.
 */
const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS =
  '-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const upsert = (key, value) => {
      const existing = props.find(
        (p) => p.type === 'property' && p.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    };
    upsert('org.gradle.jvmargs', JVM_ARGS);
    return cfg;
  });
};
