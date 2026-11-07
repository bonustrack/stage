import { expect, test } from 'bun:test';
import { handleBundler, isBrowserRequest, manifestUrl } from '../src/bundler.ts';
import { restoreFetch, stubFetch } from './fakeFetch.ts';

const at = (path: string, init?: RequestInit): Request => new Request(`https://bundler.stage.box${path}`, init);

test.each([
  ['true for html accept without expo headers', { accept: 'text/html,application/xhtml+xml' }, true],
  ['false when expo-platform header is present', { accept: 'text/html', 'expo-platform': 'android' }, false],
  ['false for manifest accept', { accept: 'multipart/mixed' }, false],
])('isBrowserRequest is %s', (_case, headers, browser) => {
  expect(isBrowserRequest(at('/main', { headers }))).toBe(browser);
});

test('manifestUrl defaults runtime and platform when headers absent', () => {
  const url = new URL(manifestUrl('main', at('/main')));
  expect(url.origin).toBe('https://u.expo.dev');
  expect(url.searchParams.get('channel-name')).toBe('main');
  expect(url.searchParams.get('runtime-version')).toBe('1.0.0');
  expect(url.searchParams.get('platform')).toBe('android');
});

test('manifestUrl forwards client runtime and platform headers', () => {
  const url = new URL(manifestUrl('main', at('/main', { headers: { 'expo-runtime-version': '2.0.0', 'expo-platform': 'ios' } })));
  expect(url.searchParams.get('runtime-version')).toBe('2.0.0');
  expect(url.searchParams.get('platform')).toBe('ios');
});

function launcherTarget(response: Response): string | null {
  const location = response.headers.get('location');
  return location === null ? null : new URL(location).searchParams.get('u');
}

test('handleBundler redirects browsers to the launcher for the same branch', async () => {
  for (const path of ['/feat/foo', '/feat%2Ffoo', '/feat%2ffoo']) {
    const response = await handleBundler(at(path, { headers: { accept: 'text/html' } }));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://bundler.stage.box/preview-launcher.html?u=' + encodeURIComponent('https://bundler.stage.box/feat/foo'),
    );
  }
});

test('handleBundler keeps dotted and escaped branch names in the launcher link', async () => {
  const dotted = await handleBundler(at('/chore/version-0.1.0-beta.2', { headers: { accept: 'text/html' } }));
  expect(launcherTarget(dotted)).toBe('https://bundler.stage.box/chore/version-0.1.0-beta.2');
  const escaped = await handleBundler(at('/fix/caf%C3%A9%20menu', { headers: { accept: 'text/html' } }));
  expect(launcherTarget(escaped)).toBe('https://bundler.stage.box/fix/caf%C3%A9%20menu');
});

const EXPO_CLIENT_HEADERS = { 'expo-platform': 'android', accept: 'application/expo+json,application/json' };

async function withStubbedFetch(run: (urls: string[]) => Promise<void>): Promise<void> {
  const urls: string[] = [];
  stubFetch((request) => {
    urls.push(request.url);
    return new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
  });
  try {
    await run(urls);
  } finally {
    restoreFetch();
  }
}

test('handleBundler loads main for expo clients on the bare domain', () =>
  withStubbedFetch(async (urls) => {
    await handleBundler(at('/', { method: 'HEAD', headers: EXPO_CLIENT_HEADERS }));
    expect(urls.map(channelOf)).toStrictEqual(['main']);
  }));

test('handleBundler never answers expo clients with the dev hub html on file paths', () =>
  withStubbedFetch(async (urls) => {
    const response = await handleBundler(at('/preview-launcher.html?u=x', { method: 'HEAD', headers: EXPO_CLIENT_HEADERS }));
    expect(response.status).toBe(404);
    expect(urls.length).toBe(0);
  }));

function channelOf(url: string): string | null {
  expect(new URL(url).origin).toBe('https://u.expo.dev');
  return new URL(url).searchParams.get('channel-name');
}

test('handleBundler loads the same channel for raw and encoded branch paths', () =>
  withStubbedFetch(async (urls) => {
    for (const path of ['/feat/native-calls', '/feat%2Fnative-calls', '/feat/native-calls/']) {
      await handleBundler(at(path, { headers: EXPO_CLIENT_HEADERS }));
    }
    expect(urls.map(channelOf)).toStrictEqual(['feat_2fnative-calls', 'feat_2fnative-calls', 'feat_2fnative-calls']);
  }));

test('handleBundler keeps slash and dash branches on different channels', () =>
  withStubbedFetch(async (urls) => {
    for (const path of ['/feat/foo', '/feat-foo', '/main']) await handleBundler(at(path, { headers: EXPO_CLIENT_HEADERS }));
    expect(urls.map(channelOf)).toStrictEqual(['feat_2ffoo', 'feat-foo', 'main']);
  }));

test('handleBundler serves dotted branch names to expo clients', () =>
  withStubbedFetch(async (urls) => {
    await handleBundler(at('/chore/config-version-0.1.0-beta.2', { headers: EXPO_CLIENT_HEADERS }));
    expect(urls.map(channelOf)).toStrictEqual(['chore_2fconfig-version-0.1.0-beta.2']);
  }));

test('handleBundler rejects paths that cannot be branch names', () =>
  withStubbedFetch(async (urls) => {
    for (const path of ['/feat%E0%A4%A', '/.well-known/acme-challenge/token', '/feat//foo', '/index.html']) {
      const response = await handleBundler(at(path, { headers: EXPO_CLIENT_HEADERS }));
      expect(response.status).toBe(404);
    }
    expect(urls.length).toBe(0);
  }));

test('handleBundler passes browsers on static files through to the dev hub', () =>
  withStubbedFetch(async (urls) => {
    for (const path of ['/index.html', '/preview-launcher.html?u=x', '/favicon.svg', '/.well-known/x']) {
      await handleBundler(at(path, { headers: { accept: 'text/html' } }));
    }
    expect(urls).toStrictEqual([
      'https://bundler.stage.box/index.html',
      'https://bundler.stage.box/preview-launcher.html?u=x',
      'https://bundler.stage.box/favicon.svg',
      'https://bundler.stage.box/.well-known/x',
    ]);
  }));

test('handleBundler passes browsers on the bare domain through to the dev hub', () =>
  withStubbedFetch(async (urls) => {
    await handleBundler(at('/', { headers: { accept: 'text/html' } }));
    expect(urls).toStrictEqual(['https://bundler.stage.box/']);
  }));
