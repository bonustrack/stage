import { expect, test } from 'bun:test';
import { branchFromPath, branchPath, channelKey } from '../src/branchChannel.ts';

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

test('branchFromPath decodes percent escapes once', () => {
  expect(branchFromPath('/main')).toBe('main');
  expect(branchFromPath('/feat/native-calls')).toBe('feat/native-calls');
  expect(branchFromPath('/feat%2Fnative-calls')).toBe('feat/native-calls');
  expect(branchFromPath('/feat%252Fx')).toBe('feat%2Fx');
  expect(branchFromPath('/fix/caf%C3%A9')).toBe('fix/café');
  expect(branchFromPath('/chore/config-version-0.1.0-beta.2/')).toBe('chore/config-version-0.1.0-beta.2');
});

test('branchFromPath rejects paths that are not branch names', () => {
  expect(branchFromPath('/')).toBe(null);
  expect(branchFromPath('')).toBe(null);
  expect(branchFromPath('/feat//foo')).toBe(null);
  expect(branchFromPath('/feat%2F%2Ffoo')).toBe(null);
  expect(branchFromPath('/.well-known/acme-challenge/token')).toBe(null);
  expect(branchFromPath('/feat/.hidden')).toBe(null);
  expect(branchFromPath('/feat%E0%A4%A')).toBe(null);
});

test('branchPath round-trips through branchFromPath', () => {
  for (const branch of ['main', 'feat/native-calls', 'fix/café menu', 'chore/v0.1.0-beta.2', 'a%2Fb', 'x#y?z']) {
    expect(branchFromPath(branchPath(branch))).toBe(branch);
  }
  expect(branchPath('feat/native-calls')).toBe('/feat/native-calls');
});
