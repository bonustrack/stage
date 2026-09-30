import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branchFromPath, branchPath, channelKey } from '../src/branchChannel.ts';

test('channelKey keeps plain branch names unchanged', () => {
  assert.equal(channelKey('main'), 'main');
  assert.equal(channelKey('served-main'), 'served-main');
  assert.equal(channelKey('release-0.1.4'), 'release-0.1.4');
});

test('channelKey escapes every other byte as _ and two hex digits', () => {
  assert.equal(channelKey('feat/native-calls'), 'feat_2fnative-calls');
  assert.equal(channelKey('fix_menu'), 'fix_5fmenu');
  assert.equal(channelKey('fix/café'), 'fix_2fcaf_c3_a9');
  assert.match(channelKey('a b+c@{d}~e'), /^[A-Za-z0-9._-]+$/);
});

test('channelKey never maps two branch names to one channel', () => {
  const branches = ['feat/foo', 'feat-foo', 'feat_foo', 'feat_2ffoo', 'feat/foo/bar', 'feat-foo/bar', 'feat/foo-bar', 'Feat/foo', 'feat/fóo'];
  assert.equal(new Set(branches.map(channelKey)).size, branches.length);
});

test('branchFromPath decodes percent escapes once', () => {
  assert.equal(branchFromPath('/main'), 'main');
  assert.equal(branchFromPath('/feat/native-calls'), 'feat/native-calls');
  assert.equal(branchFromPath('/feat%2Fnative-calls'), 'feat/native-calls');
  assert.equal(branchFromPath('/feat%252Fx'), 'feat%2Fx');
  assert.equal(branchFromPath('/fix/caf%C3%A9'), 'fix/café');
  assert.equal(branchFromPath('/chore/config-version-0.1.0-beta.2/'), 'chore/config-version-0.1.0-beta.2');
});

test('branchFromPath rejects paths that are not branch names', () => {
  assert.equal(branchFromPath('/'), null);
  assert.equal(branchFromPath(''), null);
  assert.equal(branchFromPath('/feat//foo'), null);
  assert.equal(branchFromPath('/feat%2F%2Ffoo'), null);
  assert.equal(branchFromPath('/.well-known/acme-challenge/token'), null);
  assert.equal(branchFromPath('/feat/.hidden'), null);
  assert.equal(branchFromPath('/feat%E0%A4%A'), null);
});

test('branchPath round-trips through branchFromPath', () => {
  for (const branch of ['main', 'feat/native-calls', 'fix/café menu', 'chore/v0.1.0-beta.2', 'a%2Fb', 'x#y?z']) {
    assert.equal(branchFromPath(branchPath(branch)), branch);
  }
  assert.equal(branchPath('feat/native-calls'), '/feat/native-calls');
});
