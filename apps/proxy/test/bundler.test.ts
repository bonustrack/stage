import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleBundler, isBrowserRequest, manifestUrl } from '../src/bundler.ts';

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

function launcherTarget(response: Response): string | null {
  const location = response.headers.get('location');
  return location === null ? null : new URL(location).searchParams.get('u');
}

test('handleBundler redirects browsers to the launcher for the same branch', async () => {
  for (const path of ['/feat/foo', '/feat%2Ffoo', '/feat%2ffoo']) {
    const response = await handleBundler(
      new Request(`https://bundler.stage.box${path}`, { headers: { accept: 'text/html' } }),
    );
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('location'),
      'https://bundler.stage.box/preview-launcher.html?u=' +
        encodeURIComponent('https://bundler.stage.box/feat/foo'),
    );
  }
});

test('handleBundler keeps dotted and escaped branch names in the launcher link', async () => {
  const dotted = await handleBundler(
    new Request('https://bundler.stage.box/chore/version-0.1.0-beta.2', { headers: { accept: 'text/html' } }),
  );
  assert.equal(launcherTarget(dotted), 'https://bundler.stage.box/chore/version-0.1.0-beta.2');
  const escaped = await handleBundler(
    new Request('https://bundler.stage.box/fix/caf%C3%A9%20menu', { headers: { accept: 'text/html' } }),
  );
  assert.equal(launcherTarget(escaped), 'https://bundler.stage.box/fix/caf%C3%A9%20menu');
});

const EXPO_CLIENT_HEADERS = {
  'expo-platform': 'android',
  accept: 'application/expo+json,application/json',
};

async function withStubbedFetch(run: (urls: string[]) => Promise<void>): Promise<void> {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL): Promise<Response> => {
    urls.push(input instanceof Request ? input.url : String(input));
    return Promise.resolve(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }));
  };
  try {
    await run(urls);
  } finally {
    globalThis.fetch = original;
  }
}

test('handleBundler loads main for expo clients on the bare domain', () =>
  withStubbedFetch(async (urls) => {
    await handleBundler(
      new Request('https://bundler.stage.box/', { method: 'HEAD', headers: EXPO_CLIENT_HEADERS }),
    );
    const [target] = urls;
    assert.ok(target);
    assert.equal(new URL(target).origin, 'https://u.expo.dev');
    assert.equal(new URL(target).searchParams.get('channel-name'), 'main');
  }));

test('handleBundler never answers expo clients with the dev hub html on file paths', () =>
  withStubbedFetch(async (urls) => {
    const response = await handleBundler(
      new Request('https://bundler.stage.box/preview-launcher.html?u=x', {
        method: 'HEAD',
        headers: EXPO_CLIENT_HEADERS,
      }),
    );
    assert.equal(response.status, 404);
    assert.equal(urls.length, 0);
  }));

function channelOf(url: string | undefined): string | null {
  assert.ok(url);
  assert.equal(new URL(url).origin, 'https://u.expo.dev');
  return new URL(url).searchParams.get('channel-name');
}

test('handleBundler loads the same channel for raw and encoded branch paths', () =>
  withStubbedFetch(async (urls) => {
    for (const path of ['/feat/native-calls', '/feat%2Fnative-calls', '/feat/native-calls/']) {
      await handleBundler(new Request(`https://bundler.stage.box${path}`, { headers: EXPO_CLIENT_HEADERS }));
    }
    assert.deepEqual(urls.map(channelOf), ['feat_2fnative-calls', 'feat_2fnative-calls', 'feat_2fnative-calls']);
  }));

test('handleBundler keeps slash and dash branches on different channels', () =>
  withStubbedFetch(async (urls) => {
    await handleBundler(new Request('https://bundler.stage.box/feat/foo', { headers: EXPO_CLIENT_HEADERS }));
    await handleBundler(new Request('https://bundler.stage.box/feat-foo', { headers: EXPO_CLIENT_HEADERS }));
    await handleBundler(new Request('https://bundler.stage.box/main', { headers: EXPO_CLIENT_HEADERS }));
    assert.deepEqual(urls.map(channelOf), ['feat_2ffoo', 'feat-foo', 'main']);
  }));

test('handleBundler serves dotted branch names to expo clients', () =>
  withStubbedFetch(async (urls) => {
    await handleBundler(
      new Request('https://bundler.stage.box/chore/config-version-0.1.0-beta.2', { headers: EXPO_CLIENT_HEADERS }),
    );
    assert.deepEqual(urls.map(channelOf), ['chore_2fconfig-version-0.1.0-beta.2']);
  }));

test('handleBundler rejects paths that cannot be branch names', () =>
  withStubbedFetch(async (urls) => {
    for (const path of ['/feat%E0%A4%A', '/.well-known/acme-challenge/token', '/feat//foo', '/index.html']) {
      const response = await handleBundler(
        new Request(`https://bundler.stage.box${path}`, { headers: EXPO_CLIENT_HEADERS }),
      );
      assert.equal(response.status, 404);
    }
    assert.equal(urls.length, 0);
  }));

test('handleBundler passes browsers on static files through to the dev hub', () =>
  withStubbedFetch(async (urls) => {
    for (const path of ['/index.html', '/preview-launcher.html?u=x', '/favicon.svg', '/.well-known/x']) {
      await handleBundler(new Request(`https://bundler.stage.box${path}`, { headers: { accept: 'text/html' } }));
    }
    assert.deepEqual(urls, [
      'https://bundler.stage.box/index.html',
      'https://bundler.stage.box/preview-launcher.html?u=x',
      'https://bundler.stage.box/favicon.svg',
      'https://bundler.stage.box/.well-known/x',
    ]);
  }));

test('handleBundler passes browsers on the bare domain through to the dev hub', () =>
  withStubbedFetch(async (urls) => {
    await handleBundler(new Request('https://bundler.stage.box/', { headers: { accept: 'text/html' } }));
    assert.deepEqual(urls, ['https://bundler.stage.box/']);
  }));
