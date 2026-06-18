/** Plugin-config assertion tests for the Railgun / nodejs-mobile native build.
 *
 *  WHY: the embedded Node runtime only boots on a device if five build-config
 *  details are EXACTLY right, and each was a multi-hour on-device debugging saga
 *  (see plugins/withNodejsMobile.js + nodejsMobileConfig.js comments):
 *    1. packagingOptions.jniLibs.pickFirst 'lib/**​/libnode.so' - else the per-ABI
 *       merge fails on the duplicate libnode.so the module bundles.
 *    2. libc++_shared.so is NOT pick-first - picking it could shadow the STL
 *       XMTP's Rust MLS lib was built against -> instant crash at XMTP.create.
 *    3. aapt ignoreAssetsPattern '.*:*~' - else aapt drops _-prefixed assets the
 *       file.list references -> "Node assets copy failed" launch crash.
 *    4. android:extractNativeLibs=true - else libnode.so stays compressed and
 *       System.loadLibrary("node") fails -> SIGABRT on launch.
 *    5. gradle org.gradle.jvmargs -Xmx6144m - else R8/signing OOMs the build.
 *
 *  A silent edit to any of these reverts a fix. We test the PURE transforms
 *  (plugins/nodejsMobileConfig.js - no @expo/config-plugins runtime needed) so
 *  CI catches a regression instead of a fresh APK. */

import { describe, expect, test } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cfg = require('../plugins/nodejsMobileConfig.js') as {
  transformAppBuildGradle(src: string): string;
  setExtractNativeLibs(m: { application?: { $?: Record<string, string> }[] }): unknown;
  setGradleMemory(p: { type: string; key: string; value: string }[]): unknown;
};

const TEMPLATE_GRADLE = [
  'android {',
  '    namespace "box.metro.app"',
  "    androidResources { ignoreAssetsPattern '!.svn:!.git' }",
  '}',
].join('\n');

describe('app build.gradle transform', () => {
  const out = cfg.transformAppBuildGradle(TEMPLATE_GRADLE);

  test('pins libnode.so pickFirst (dup merge fix)', () => {
    expect(out).toContain("pickFirst 'lib/**/libnode.so'");
    expect(out).toContain('packagingOptions');
    expect(out).toContain('jniLibs');
  });

  test('does NOT pick-first libc++_shared.so (XMTP STL safety)', () => {
    expect(out).not.toContain("pickFirst 'lib/**/libc++_shared.so'");
  });

  test('forces winning aapt ignoreAssetsPattern .*:*~ (asset copy fix)', () => {
    expect(out).toContain("ignoreAssetsPattern '.*:*~'");
    expect(out).not.toContain("ignoreAssetsPattern '!.svn:!.git'");
  });

  test('is idempotent (re-running does not double-inject)', () => {
    const twice = cfg.transformAppBuildGradle(out);
    expect(twice).toBe(out);
    expect(twice.split("pickFirst 'lib/**/libnode.so'").length - 1).toBe(1);
  });

  test('falls back to appending androidResources when template has none', () => {
    // real prebuild output ends with a trailing newline after the android{} close
    const bare = ['android {', '    namespace "x"', '}', ''].join('\n');
    const o = cfg.transformAppBuildGradle(bare);
    expect(o).toContain("ignoreAssetsPattern '.*:*~'");
    expect(o).toContain("pickFirst 'lib/**/libnode.so'");
  });
});

describe('AndroidManifest extractNativeLibs', () => {
  test('forces android:extractNativeLibs=true (libnode.so load fix)', () => {
    const manifest = { application: [{ $: { 'android:label': 'Metro' } }] };
    cfg.setExtractNativeLibs(manifest);
    expect(manifest.application[0].$['android:extractNativeLibs']).toBe('true');
  });

  test('tolerates an application node with no attribute bag', () => {
    const manifest = { application: [{}] } as { application: { $?: Record<string, string> }[] };
    cfg.setExtractNativeLibs(manifest);
    expect(manifest.application[0].$?.['android:extractNativeLibs']).toBe('true');
  });
});

describe('gradle.properties memory', () => {
  test('bumps org.gradle.jvmargs heap so R8/signing does not OOM', () => {
    const props = [{ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m' }];
    cfg.setGradleMemory(props);
    const jvm = props.find((p) => p.key === 'org.gradle.jvmargs');
    expect(jvm?.value).toContain('-Xmx6144m');
    expect(jvm?.value).toContain('MaxMetaspaceSize');
  });

  test('adds the prop when absent', () => {
    const props: { type: string; key: string; value: string }[] = [];
    cfg.setGradleMemory(props);
    expect(props.find((p) => p.key === 'org.gradle.jvmargs')?.value).toContain('-Xmx6144m');
  });
});
