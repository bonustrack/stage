/** @file Pure, unit-testable config transforms for the nodejs-mobile / Railgun native Android build. */
'use strict';

/** .so files both nodejs-mobile and RN ship; pickFirst resolves the clash (libc++_shared.so excluded on purpose). */
const PICK_FIRST = ['lib/**/libnode.so'];

/** aapt ignoreAssetsPattern ignoring exactly what nodejs-mobile's file.list excludes so every listed asset is packaged. */
const NODEJS_IGNORE_ASSETS_PATTERN = '.*:*~';

/** Inject the libnode.so pickFirst block and force the winning aapt ignoreAssetsPattern into the groovy build.gradle. */
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

/** Force android:extractNativeLibs=true on the manifest application so libnode.so is extracted at launch. */
function setExtractNativeLibs(manifest) {
  const app = manifest && manifest.application && manifest.application[0];
  if (app) {
    if (!app.$) app.$ = {};
    app.$['android:extractNativeLibs'] = 'true';
  }
  return manifest;
}

/** The gradle heap args R8 and signing need (the default -Xmx2048m OOMs this app). */
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
