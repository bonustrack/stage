import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';
import { AndroidConfig, type AndroidManifest, type ConfigPlugin, type ExportedConfig } from 'expo/config-plugins';

const requireCjs = createRequire(import.meta.url);
const plugin = requireCjs('../plugins/withCrashReport.js') as ConfigPlugin;
const base = { name: 'Stage', slug: 'metro', android: { package: 'box.metro.monitor' } };

async function apply(manifest: AndroidManifest): Promise<AndroidManifest> {
  const config = plugin(base) as ExportedConfig;
  const mod = config.mods?.android?.manifest;
  if (!mod) throw new Error('Manifest mod missing');
  const result = await mod({
    ...config,
    modRawConfig: base,
    modResults: manifest,
    modRequest: {
      projectRoot: '/unused',
      platformProjectRoot: '/unused/android',
      platform: 'android',
      modName: 'manifest',
      introspect: true,
    },
  });
  return result.modResults;
}

type ApplicationWithProvider = AndroidConfig.Manifest.ManifestApplication & { provider: { $: Record<string, string> }[] };

function manifest(factory = 'androidx.core.app.CoreComponentFactory'): AndroidManifest {
  const application: ApplicationWithProvider = {
    $: { 'android:name': '.MainApplication', 'android:appComponentFactory': factory, 'tools:replace': 'android:allowBackup' },
    activity: [
      {
        $: { 'android:name': '.MainActivity', 'android:exported': 'true' },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
          },
        ],
      },
    ],
    provider: [{ $: { 'android:name': 'ExistingProvider', 'android:authorities': 'box.metro.monitor.provider' } }],
  };
  return { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' }, queries: [], application: [application] } };
}

const providersOf = (application: object): unknown => ('provider' in application ? application.provider : undefined);

describe('native crash report entry', () => {
  test('adds an isolated entry without changing normal entry or provider process', async () => {
    const input = manifest();
    const original = structuredClone(AndroidConfig.Manifest.getMainApplicationOrThrow(input));
    const result = AndroidConfig.Manifest.getMainApplicationOrThrow(await apply(input));
    expect(result.$['android:name']).toBe('.MainApplication');
    expect(result.activity?.[0]).toEqual(original.activity?.[0]);
    expect(providersOf(result)).toEqual(providersOf(original));
    expect(providersOf(result)).toBeDefined();
    expect(result.activity?.[1]?.$).toMatchObject({
      'android:process': ':stage_crash_report',
      'android:taskAffinity': 'box.metro.monitor.crashreport',
      'android:excludeFromRecents': 'true',
      'android:label': 'Stage crash report',
    });
    expect(result.$['tools:replace']).toBe('android:allowBackup,android:appComponentFactory');
  });

  test('reapplying does not duplicate the entry or manifest override', async () => {
    const once = await apply(manifest());
    const before = structuredClone(once);
    expect(await apply(once)).toEqual(before);
  });

  test('refuses to silently replace another custom factory', async () => {
    await expect(apply(manifest('other.CustomFactory'))).rejects.toThrow('unknown app component factory');
  });
});
