/** Plugin-config tests for native debug-symbol embedding in release AABs.
 *
 *  WHY: we ship large native libs (Railgun nodejs-mobile libnode.so, Groth16
 *  prover, reanimated/worklets). Without `release.ndk.debugSymbolLevel` the AAB
 *  carries no native-debug-symbols.zip, so Play Console crash reports show raw
 *  addresses instead of readable native stacks. expo-build-properties does not
 *  expose this option, so plugins/withNativeSymbols.js edits app/build.gradle.
 *
 *  We test the PURE transform (no @expo/config-plugins runtime needed) so CI
 *  catches a regression instead of a silently-symboless release build. */

import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';

const plugin = createRequire(import.meta.url)(
  '../plugins/withNativeSymbols.js',
) as {
  setDebugSymbolLevel(src: string): string;
  DEBUG_SYMBOL_LEVEL: string;
};

const TEMPLATE = `android {
    namespace 'box.stage'
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}`;

describe('withNativeSymbols.setDebugSymbolLevel', () => {
  test('injects SYMBOL_TABLE into the release buildType', () => {
    const out = plugin.setDebugSymbolLevel(TEMPLATE);
    expect(out).toContain("debugSymbolLevel 'SYMBOL_TABLE'");
    // Inside the release block, after `release {`, before the closing brace.
    const releaseIdx = out.indexOf('release {');
    const ndkIdx = out.indexOf('debugSymbolLevel');
    expect(ndkIdx).toBeGreaterThan(releaseIdx);
  });

  test('SYMBOL_TABLE (not FULL) to keep AAB symbol payload modest', () => {
    expect(plugin.DEBUG_SYMBOL_LEVEL).toBe('SYMBOL_TABLE');
  });

  test('is idempotent (no double-injection on re-run)', () => {
    const once = plugin.setDebugSymbolLevel(TEMPLATE);
    const twice = plugin.setDebugSymbolLevel(once);
    expect(twice).toBe(once);
    expect(twice.match(/debugSymbolLevel/g)?.length).toBe(1);
  });

  test('throws if no release buildType exists to attach to', () => {
    expect(() => plugin.setDebugSymbolLevel('android {\n}\n')).toThrow(
      /release/,
    );
  });
});
