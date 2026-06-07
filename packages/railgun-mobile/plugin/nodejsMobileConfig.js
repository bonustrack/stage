/* PURE config transforms for the nodejs-mobile / Railgun native build.
 *
 *  Extracted from withNodejsMobile.js so they can be unit-tested WITHOUT the
 *  @expo/config-plugins runtime (the plugin wraps these; the tests import them
 *  directly). Each function is a pure data transform - string in/out for the
 *  groovy build.gradle, object mutation for the AndroidManifest + gradle props.
 *  See withNodejsMobile.js for the full on-device debugging rationale behind
 *  every one of these values; a silent edit reverts a multi-hour fix, so
 *  test/railgunPluginConfig.test.ts asserts them in CI. */
'use strict';

/** .so libraries nodejs-mobile + RN both ship; pickFirst resolves the clash.
 *  libc++_shared.so is DELIBERATELY excluded (the bun patch stops nodejs-mobile
 *  emitting its own NDK-24 one; blanket-picking could shadow the STL XMTP's Rust
 *  MLS lib was built against -> crash at XMTP.create). */
const PICK_FIRST = ['lib/**/libnode.so'];

/** aapt ignoreAssetsPattern forced onto the WINNING androidResources block:
 *  ignore EXACTLY what nodejs-mobile's file.list excludes (dotfiles + *~) so
 *  every listed asset (incl. _-prefixed lodash files) is packaged + openable. */
const NODEJS_IGNORE_ASSETS_PATTERN = '.*:*~';

/** Transform the emitted app build.gradle groovy: inject the libnode.so
 *  pickFirst block + force the winning aapt ignoreAssetsPattern. Idempotent
 *  (guarded by the // nodejs-mobile-pickFirst marker). Returns the new source. */
function transformAppBuildGradle(src) {
  if (src.includes('// nodejs-mobile-pickFirst')) return src;
  const picks = PICK_FIRST.map((p) => `            pickFirst '${p}'`).join('\n');
  const block = [
    '    // nodejs-mobile-pickFirst - resolve duplicate libnode.so the embedded',
    '    // Node runtime bundles. (libc++_shared.so is no longer emitted by the',
    '    // module - see the bun patch - so it is intentionally NOT pick-first.)',
    '    packagingOptions {',
    '        jniLibs {',
    picks,
    '        }',
    '    }',
  ].join('\n');
  let out = src.replace(/android\s*\{/, (m) => `${m}\n${block}\n`);

  const ignoreRe = /ignoreAssetsPattern\s+'[^']*'/g;
  if (ignoreRe.test(out)) {
    out = out.replace(
      ignoreRe,
      `ignoreAssetsPattern '${NODEJS_IGNORE_ASSETS_PATTERN}' // nodejs-mobile-aaptIgnore: keep _-prefixed assets (file.list excludes only .* and *~)`,
    );
  } else {
    const aaptBlock = [
      '    // nodejs-mobile-aaptIgnore - package every asset nodejs-mobile lists.',
      '    androidResources {',
      `        ignoreAssetsPattern '${NODEJS_IGNORE_ASSETS_PATTERN}'`,
      '    }',
      '}',
    ].join('\n');
    out = out.replace(/\n\}\n/, `\n${aaptBlock}\n`);
  }
  return out;
}

/** Force android:extractNativeLibs=true on the manifest's <application> so
 *  libnode.so is extracted (else System.loadLibrary("node") fails -> SIGABRT).
 *  Mutates + returns the manifest object (shape: { application: [ { $ } ] }). */
function setExtractNativeLibs(manifest) {
  const app = manifest && manifest.application && manifest.application[0];
  if (app) {
    if (!app.$) app.$ = {};
    app.$['android:extractNativeLibs'] = 'true';
  }
  return manifest;
}

/** The gradle heap args R8/signing needs (the default -Xmx2048m OOMs this app). */
const GRADLE_JVMARGS =
  '-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

/** Set org.gradle.jvmargs on the gradle.properties prop array (mutates+returns). */
function setGradleMemory(props) {
  const existing = props.find((p) => p.type === 'property' && p.key === 'org.gradle.jvmargs');
  if (existing) existing.value = GRADLE_JVMARGS;
  else props.push({ type: 'property', key: 'org.gradle.jvmargs', value: GRADLE_JVMARGS });
  return props;
}

module.exports = {
  PICK_FIRST,
  NODEJS_IGNORE_ASSETS_PATTERN,
  GRADLE_JVMARGS,
  transformAppBuildGradle,
  setExtractNativeLibs,
  setGradleMemory,
};
