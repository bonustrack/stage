import { describe, expect, test } from 'bun:test';
import {
  compatibleMainUrl, freshUrl, loadedCommit, mainUpdateMessage, parsePreviewManifest, previewFromStatus,
} from '../components/settings/DevClientUpdate.model';
import { findCompatibleMainUpdate, type UpdateRequest } from '../lib/devClientUpdates.core';

const PROJECT = 'https://u.expo.dev/1707f2db-c2b8-4c91-9341-27b1d57d355f';
const OLD_SHA = 'a'.repeat(40);
const NEW_SHA = 'b'.repeat(40);
const OLD_GROUP = `${PROJECT}/group/11111111-1111-1111-1111-111111111111`;
const NEW_GROUP = `${PROJECT}/group/22222222-2222-2222-2222-222222222222`;
const OLD_ID = '33333333-3333-3333-3333-333333333333';
const NEW_ID = '44444444-4444-4444-4444-444444444444';

function manifest(gitHash = OLD_SHA, runtimeVersion = 'old-runtime', id = OLD_ID): string {
  return JSON.stringify({ id, runtimeVersion, extra: { expoClient: { extra: { gitHash } } } });
}

function status(gitHash: string, url: string): string {
  return JSON.stringify({ sha: gitHash, statuses: [{ context: 'Preview', state: 'success', target_url: `https://bundler.stage.box/preview-launcher.html?u=${encodeURIComponent(url)}` }] });
}

function fixture(newRuntime = 'new-runtime', compatible = manifest()): { request: UpdateRequest; calls: { url: string; headers: Record<string, string> }[] } {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const request: UpdateRequest = (url, headers) => {
    calls.push({ url, headers });
    const path = new URL(url).pathname;
    let body = compatible;
    if (path.endsWith('/main/status')) body = status(NEW_SHA, NEW_GROUP);
    else if (path.endsWith(`/${OLD_SHA}/status`)) body = status(OLD_SHA, OLD_GROUP);
    else if (path.endsWith('/group/22222222-2222-2222-2222-222222222222')) body = manifest(NEW_SHA, newRuntime, NEW_ID);
    else if (path.includes('/group/')) body = manifest();
    return Promise.resolve({ body, contentType: 'application/expo+json' });
  };
  return { request, calls };
}

describe('main dev-client manifests', () => {
  test('reads only the manifest part, including quoted boundaries', () => {
    const body = `--abc\r\nContent-Disposition: form-data; name="manifest"\r\nContent-Type: application/json\r\n\r\n${manifest()}\r\n--abc\r\nContent-Disposition: form-data; name="extensions"\r\n\r\n{"not":"an update"}\r\n--abc--\r\n`;
    expect(parsePreviewManifest(body, 'multipart/mixed; boundary="abc"')).toEqual({ id: OLD_ID, runtime: 'old-runtime', gitHash: OLD_SHA });
  });

  test('rejects missing manifest, boundary and identity', () => {
    expect(() => parsePreviewManifest('', 'multipart/mixed')).toThrow('boundary');
    expect(() => parsePreviewManifest('--abc--', 'multipart/mixed; boundary=abc')).toThrow('No compatible');
    expect(() => parsePreviewManifest('{}', 'application/json')).toThrow('verified commit');
    expect(loadedCommit({ extra: { gitHash: NEW_SHA } })).toBeNull();
  });

  test('accepts only successful immutable previews for this project', () => {
    expect(previewFromStatus(JSON.parse(status(OLD_SHA, OLD_GROUP)))).toEqual({ gitHash: OLD_SHA, url: OLD_GROUP });
    for (const target of [`${PROJECT}?channel-name=main`, `${OLD_GROUP}?runtime-version=other`, OLD_GROUP.replace('u.expo.dev', 'other.example'), OLD_GROUP.replace('1707f2db', '9999f2db')]) {
      expect(() => previewFromStatus(JSON.parse(status(OLD_SHA, target)))).toThrow();
    }
    expect(() => previewFromStatus({ sha: OLD_SHA, statuses: [{ context: 'Preview', state: 'pending' }] })).toThrow('not published');
  });

  test('cache bust reaches EAS and retains runtime and channel', () => {
    const url = new URL(freshUrl(compatibleMainUrl('native-runtime', 'android'), 123));
    expect(url.origin).toBe('https://u.expo.dev');
    expect(Object.fromEntries(url.searchParams)).toEqual({ 'channel-name': 'main', 'runtime-version': 'native-runtime', platform: 'android', refresh: '123' });
  });
});

describe('compatible main selection', () => {
  test('pins a compatible older update and identifies the newer runtime', async () => {
    const { request, calls } = fixture();
    const update = await findCompatibleMainUpdate(request, 'old-runtime', 'android', 123);
    expect(update).toEqual({ id: OLD_ID, runtime: 'old-runtime', gitHash: OLD_SHA, url: OLD_GROUP, latest: { id: NEW_ID, runtime: 'new-runtime', gitHash: NEW_SHA } });
    expect(calls).toHaveLength(5);
    expect(calls.every((call) => new URL(call.url).searchParams.get('refresh') === '123')).toBe(true);
    expect(calls.filter((call) => call.url.includes('u.expo.dev')).every((call) => call.headers['Expo-Runtime-Version'] === 'old-runtime')).toBe(true);
    expect(mainUpdateMessage(update, OLD_SHA)).toContain('needs a new dev-client APK');
    expect(mainUpdateMessage(update, OLD_SHA)).toContain('only load compatible main aaaaaaa');
  });

  test('pins the latest update when compatible', async () => {
    const { request, calls } = fixture('old-runtime', manifest(NEW_SHA, 'old-runtime', NEW_ID));
    const update = await findCompatibleMainUpdate(request, 'old-runtime', 'android', 123);
    expect(update.url).toBe(NEW_GROUP);
    expect(calls).toHaveLength(3);
    expect(mainUpdateMessage(update, NEW_SHA)).toContain('already loaded');
    expect(mainUpdateMessage(update, OLD_SHA)).not.toContain('new dev-client APK');
  });

  test('never accepts a incompatible channel response or unknown runtime', async () => {
    const { request } = fixture('new-runtime', manifest(NEW_SHA, 'new-runtime', NEW_ID));
    await expect(findCompatibleMainUpdate(request, 'old-runtime', 'android', 123)).rejects.toThrow('incompatible');
    await expect(findCompatibleMainUpdate(request, '', 'android', 123)).rejects.toThrow('known native runtime');
    await expect(findCompatibleMainUpdate(request, 'old-runtime', 'web', 123)).rejects.toThrow('known native runtime');
  });

  test('refuses mutable main races and mismatched pinned update identities', async () => {
    const { request } = fixture('old-runtime');
    await expect(findCompatibleMainUpdate(request, 'old-runtime', 'android', 123)).rejects.toThrow('changed during');
    const older = fixture();
    const wrongPinned: UpdateRequest = (url, headers) => url.startsWith(OLD_GROUP)
      ? Promise.resolve({ body: manifest(OLD_SHA, 'new-runtime'), contentType: 'application/json' }) : older.request(url, headers);
    await expect(findCompatibleMainUpdate(wrongPinned, 'old-runtime', 'android', 123)).rejects.toThrow('immutable compatible');
  });

  test('does not treat pending main or network failure as latest', async () => {
    const pending: UpdateRequest = () => Promise.resolve({ body: JSON.stringify({ sha: NEW_SHA, statuses: [] }), contentType: 'application/json' });
    await expect(findCompatibleMainUpdate(pending, 'old-runtime', 'android', 123)).rejects.toThrow('not published');
    const offline: UpdateRequest = () => Promise.reject(new Error('offline'));
    await expect(findCompatibleMainUpdate(offline, 'old-runtime', 'android', 123)).rejects.toThrow('offline');
  });
});
