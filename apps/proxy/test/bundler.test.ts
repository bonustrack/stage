import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelFromPath, handleBundler, isBrowserRequest, manifestUrl } from '../src/bundler.ts';

test('channelFromPath maps single segments to channels', () => {
  assert.equal(channelFromPath('/main'), 'main');
  assert.equal(channelFromPath('/served-main'), 'served-main');
});

test('channelFromPath joins multi-segment branch paths with dashes', () => {
  assert.equal(
    channelFromPath('/claude/large-refactoring-pr-3rcl0d'),
    'claude-large-refactoring-pr-3rcl0d',
  );
  assert.equal(channelFromPath('/feat/foo/bar'), 'feat-foo-bar');
});

test('channelFromPath strips characters outside the eas channel alphabet', () => {
  assert.equal(channelFromPath('/feat/f%20oo'), 'feat-f20oo');
});

test('channelFromPath passes through root and file-like paths', () => {
  assert.equal(channelFromPath('/'), null);
  assert.equal(channelFromPath('/index.html'), null);
  assert.equal(channelFromPath('/preview-launcher.html'), null);
  assert.equal(channelFromPath('/favicon.svg'), null);
  assert.equal(channelFromPath('/.well-known/acme-challenge/token'), null);
});

test('isBrowserRequest is true for html accept without expo headers', () => {
  const request = new Request('https://bundler.stage.box/main', {
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  assert.equal(isBrowserRequest(request), true);
});

test('isBrowserRequest is false when expo-platform header is present', () => {
  const request = new Request('https://bundler.stage.box/main', {
    headers: { accept: 'text/html', 'expo-platform': 'android' },
  });
  assert.equal(isBrowserRequest(request), false);
});

test('isBrowserRequest is false for manifest accept', () => {
  const request = new Request('https://bundler.stage.box/main', {
    headers: { accept: 'multipart/mixed' },
  });
  assert.equal(isBrowserRequest(request), false);
});

test('manifestUrl defaults runtime and platform when headers absent', () => {
  const request = new Request('https://bundler.stage.box/main');
  const url = new URL(manifestUrl('main', request));
  assert.equal(url.origin, 'https://u.expo.dev');
  assert.equal(url.searchParams.get('channel-name'), 'main');
  assert.equal(url.searchParams.get('runtime-version'), '1.0.0');
  assert.equal(url.searchParams.get('platform'), 'android');
});

test('manifestUrl forwards client runtime and platform headers', () => {
  const request = new Request('https://bundler.stage.box/main', {
    headers: { 'expo-runtime-version': '2.0.0', 'expo-platform': 'ios' },
  });
  const url = new URL(manifestUrl('main', request));
  assert.equal(url.searchParams.get('runtime-version'), '2.0.0');
  assert.equal(url.searchParams.get('platform'), 'ios');
});

test('handleBundler redirects browsers to the launcher', async () => {
  const request = new Request('https://bundler.stage.box/feat/foo', {
    headers: { accept: 'text/html' },
  });
  const response = await handleBundler(request);
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get('location'),
    'https://bundler.stage.box/preview-launcher.html?u=' +
      encodeURIComponent('https://bundler.stage.box/feat-foo'),
  );
});
