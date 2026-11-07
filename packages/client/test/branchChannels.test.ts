import { expect, test } from 'bun:test';
import { channelKey, easManifestUrl } from '../src/endpoints';

test('channelKey keeps plain branch names unchanged', () => {
  expect(channelKey('main')).toBe('main');
  expect(channelKey('served-main')).toBe('served-main');
  expect(channelKey('release-0.1.4')).toBe('release-0.1.4');
});

test('channelKey escapes every other byte as _ and two hex digits', () => {
  expect(channelKey('feat/native-calls')).toBe('feat_2fnative-calls');
  expect(channelKey('fix_menu')).toBe('fix_5fmenu');
  expect(channelKey('fix/café')).toBe('fix_2fcaf_c3_a9');
  expect(channelKey('a b+c@{d}~e')).toMatch(/^[A-Za-z0-9._-]+$/);
});

test('channelKey never maps two branch names to one channel', () => {
  const branches = [
    'feat/foo',
    'feat-foo',
    'feat_foo',
    'feat_2ffoo',
    'feat/foo/bar',
    'feat-foo/bar',
    'feat/foo-bar',
    'Feat/foo',
    'feat/fóo',
  ];
  expect(new Set(branches.map(channelKey)).size).toBe(branches.length);
});

test('the manifest url asks EAS for the channel of the branch', () => {
  const url = new URL(easManifestUrl({ branch: 'feat/native-calls', runtime: '2.0.0', platform: 'ios' }));
  expect(url.origin).toBe('https://u.expo.dev');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    'channel-name': 'feat_2fnative-calls',
    'runtime-version': '2.0.0',
    platform: 'ios',
  });
});
