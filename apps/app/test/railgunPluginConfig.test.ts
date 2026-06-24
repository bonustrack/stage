
import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';

interface NodejsMobileConfig {
  transformAppBuildGradle(src: string): string;
  setExtractNativeLibs(m: { application?: { $?: Record<string, string> }[] }): unknown;
  setGradleMemory(p: { type: string; key: string; value: string }[]): unknown;
}

const requireCjs = createRequire(import.meta.url);
const cfg = requireCjs('../plugins/nodejsMobileConfig.js') as NodejsMobileConfig;

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
