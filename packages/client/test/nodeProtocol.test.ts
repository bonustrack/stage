import { afterEach, describe, expect, test } from 'bun:test';
import { ed25519 } from '@noble/curves/ed25519';
import { utf8ToBytes } from '@noble/hashes/utils';
import { base64ToBytes } from '../src/text/base64';
import {
  actionReplyOf, loadNode, loadReplyOf, newNodeKey, nodeActionBody, nodeHeaders, nodeKeyId, nodeUrlOf, sendNodeAction,
} from '../src/nodes/protocol';
import { nodeSigningText } from '../src/nodes/signing';

const RFC8032_KEY = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const RFC8032_PUBLIC = '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo';
const URL_A = 'https://btc.example.com/';
const NOW = 1_760_000_000_000;
const CARD = { type: 'Card', children: [{ type: 'Title', value: '$100' }] };
const realFetch = globalThis.fetch;

function bytesOf(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

interface Seen { url: string; init: RequestInit }

function stubFetch(respond: (seen: Seen) => Response | Promise<Response>): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const call = { url: String(input), init: init ?? {} };
    seen.push(call);
    return respond(call);
  }, { preconnect: realFetch.preconnect });
  return seen;
}

afterEach(() => { globalThis.fetch = realFetch; });

describe('node url safety', () => {
  test('accepts https public hosts and normalizes the url', () => {
    expect(nodeUrlOf(' https://BTC.example.com ')).toEqual({ ok: true, url: URL_A, host: 'btc.example.com' });
    expect(nodeUrlOf('https://node.example.com:8443/w?id=1#frag')).toEqual({
      ok: true, url: 'https://node.example.com:8443/w?id=1', host: 'node.example.com:8443',
    });
    expect(nodeUrlOf('https://1.1.1.1/').ok).toBe(true);
    expect(nodeUrlOf('https://[2606:4700:4700::1111]/').ok).toBe(true);
    expect(nodeUrlOf('https://bücher.example/')).toEqual({ ok: true, url: 'https://xn--bcher-kva.example/', host: 'xn--bcher-kva.example' });
  });

  test('signs the url in the form a Cloudflare Worker sees it', () => {
    expect(nodeUrlOf('https://x.example.com/a%7eb/%2f?q=a|b^c&d=%41')).toEqual({
      ok: true, url: 'https://x.example.com/a~b/%2F?q=a%7Cb%5Ec&d=A', host: 'x.example.com',
    });
    expect(nodeUrlOf(`https://x.example.com/a${' '.repeat(700)}b`)).toEqual({ ok: false, problem: 'invalid' });
  });

  test('rejects other schemes, credentials and junk', () => {
    expect(nodeUrlOf('http://example.com')).toEqual({ ok: false, problem: 'insecure' });
    expect(nodeUrlOf('javascript:alert(1)')).toEqual({ ok: false, problem: 'insecure' });
    expect(nodeUrlOf('ftp://example.com')).toEqual({ ok: false, problem: 'insecure' });
    expect(nodeUrlOf('https://user:pass@example.com')).toEqual({ ok: false, problem: 'credentials' });
    expect(nodeUrlOf('not a url')).toEqual({ ok: false, problem: 'invalid' });
    expect(nodeUrlOf('')).toEqual({ ok: false, problem: 'invalid' });
    expect(nodeUrlOf(`https://example.com/${'a'.repeat(2100)}`)).toEqual({ ok: false, problem: 'invalid' });
  });

  test('blocks local names and private, loopback and link-local addresses', () => {
    const blocked = [
      'https://localhost', 'https://localhost.', 'https://api.localhost', 'https://printer.local', 'https://db.internal',
      'https://nas.lan', 'https://box.home.arpa', 'https://intranet', 'https://127.0.0.1', 'https://127.1', 'https://2130706433',
      'https://0x7f.0.0.1', 'https://0.0.0.0', 'https://10.1.2.3', 'https://172.16.0.1', 'https://172.31.255.255',
      'https://192.168.1.10', 'https://169.254.169.254', 'https://100.64.0.1', 'https://224.0.0.1', 'https://[::1]',
      'https://[::]', 'https://[fe80::1]', 'https://[fd00::1]', 'https://[fc00::1]', 'https://[ff02::1]',
      'https://[::ffff:127.0.0.1]', 'https://[::ffff:a9fe:a9fe]', 'https://[::ffff:192.168.0.1]', 'https://localhost.localdomain',
      'https://198.18.0.1', 'https://[64:ff9b::7f00:1]', 'https://[2002:7f00:1::1]', 'https://[::ffff:0:a00:1]', 'https://１２７.０.０.１',
    ];
    for (const url of blocked) expect([url, nodeUrlOf(url)]).toEqual([url, { ok: false, problem: 'local' }]);
    expect(nodeUrlOf('https://172.32.0.1').ok).toBe(true);
    expect(nodeUrlOf('https://[::ffff:8.8.8.8]').ok).toBe(true);
  });
});

describe('node request signing', () => {
  test('a key is 32 random bytes and its id is the base64url public key', () => {
    const key = newNodeKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(newNodeKey()).not.toBe(key);
    expect(nodeKeyId(RFC8032_KEY)).toBe(RFC8032_PUBLIC);
  });

  test('signs method, url, timestamp and body hash with the widget key', () => {
    const headers = nodeHeaders('GET', URL_A, '', RFC8032_KEY, NOW);
    expect(headers['Stage-Key']).toBe(RFC8032_PUBLIC);
    expect(headers['Stage-Timestamp']).toBe('1760000000');
    const text = nodeSigningText('GET', URL_A, '1760000000', '');
    expect(text).toBe(
      'stage-node-v1\nGET\nhttps://btc.example.com/\n1760000000\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(headers['Stage-Signature']).toBe(
      'LZX_kFDKueYoejNdCwxJNrvgZTwUjbC5zhQQqmW5ZMddbw5aXhRfi0WHRilqi7ZW89G8eNza0AxVUde4iQu1CQ',
    );
    const signature = bytesOf(headers['Stage-Signature'] ?? '');
    expect(ed25519.verify(signature, utf8ToBytes(text), bytesOf(RFC8032_PUBLIC))).toBe(true);
    expect(ed25519.verify(signature, utf8ToBytes(text.replace('GET', 'POST')), bytesOf(RFC8032_PUBLIC))).toBe(false);
  });

  test('a node verifies the signature with WebCrypto Ed25519', async () => {
    const body = nodeActionBody(RFC8032_PUBLIC, { type: 'vote' });
    const headers = nodeHeaders('POST', URL_A, body, RFC8032_KEY, NOW);
    const publicKey = await crypto.subtle.importKey('raw', bytesOf(RFC8032_PUBLIC), { name: 'Ed25519' }, false, ['verify']);
    const signed = utf8ToBytes(nodeSigningText('POST', URL_A, headers['Stage-Timestamp'] ?? '', body));
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, bytesOf(headers['Stage-Signature'] ?? ''), signed)).toBe(true);
  });
});

describe('node action request', () => {
  test('mirrors the ChatKit threads.sync_custom_action request', () => {
    expect(JSON.parse(nodeActionBody('kid', { type: 'vote' }))).toEqual({
      type: 'threads.sync_custom_action', params: { thread_id: 'kid', item_id: 'kid', action: { type: 'vote' } },
    });
    expect(JSON.parse(nodeActionBody('kid', { type: 'buy', payload: { qty: 2 } })).params.action).toEqual({ type: 'buy', payload: { qty: 2 } });
  });
});

describe('node replies', () => {
  const frame = { kind: 'frame', frame: { widget: CARD } };

  test('a load answers a ChatKit widget root', () => {
    expect(loadReplyOf(CARD)).toEqual(frame);
    const list = { type: 'ListView', children: [] };
    expect(loadReplyOf(list)).toEqual({ kind: 'frame', frame: { widget: list } });
  });

  test('an action answers a sync action response, and no updated item keeps the current widget', () => {
    expect(actionReplyOf({ updated_item: { id: 'w1', thread_id: 't', type: 'widget', widget: CARD } })).toEqual(frame);
    expect(actionReplyOf({})).toEqual({ kind: 'unchanged' });
    expect(actionReplyOf({ updated_item: null })).toEqual({ kind: 'unchanged' });
  });

  test('a load refuses anything but a widget root', () => {
    const refused = [
      null, undefined, [CARD], 'Card', {}, { price: 1 }, { type: 'widget', widget: CARD }, { title: 'BTC', widget: CARD },
      { screens: { a: CARD }, start: 'a' }, { updated_item: { type: 'widget', widget: CARD } }, { type: 'Card', note: 'x'.repeat(70_000) },
      { type: 'error', message: 'oops' }, { type: 'Text', value: 'not a root' },
    ];
    for (const reply of refused) expect([reply, loadReplyOf(reply)]).toEqual([reply, null]);
  });

  test('an action refuses anything but a sync action response', () => {
    const refused = [
      null, undefined, [CARD], 'Card', CARD, { price: 1 }, { type: 'widget', widget: CARD }, { title: 'BTC', widget: CARD },
      { updated_item: { type: 'assistant_message', content: [] } }, { updated_item: { type: 'widget', widget: { type: 'Text', value: 'x' } } },
      { updated_item: { type: 'widget' } }, { updated_item: 'Card' },
    ];
    for (const reply of refused) expect([reply, actionReplyOf(reply)]).toEqual([reply, null]);
  });
});

describe('node calls', () => {
  test('loads with a signed GET, without cookies or redirects', async () => {
    const seen = stubFetch(() => Response.json(CARD));
    expect(await loadNode('https://BTC.example.com', RFC8032_KEY)).toEqual({ ok: true, reply: { kind: 'frame', frame: { widget: CARD } } });
    const call = seen[0];
    expect(call?.url).toBe(URL_A);
    expect(call?.init).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
    const headers = call?.init.headers as Record<string, string>;
    expect(headers['Stage-Key']).toBe(RFC8032_PUBLIC);
    const text = nodeSigningText('GET', URL_A, headers['Stage-Timestamp'] ?? '', '');
    expect(ed25519.verify(bytesOf(headers['Stage-Signature'] ?? ''), utf8ToBytes(text), bytesOf(RFC8032_PUBLIC))).toBe(true);
  });

  test('posts an action as JSON and returns the updated widget', async () => {
    const seen = stubFetch(() => Response.json({ updated_item: { type: 'widget', widget: CARD } }));
    const result = await sendNodeAction(URL_A, RFC8032_KEY, { type: 'vote', payload: { coin: 'BTC' } });
    expect(result).toEqual({ ok: true, reply: { kind: 'frame', frame: { widget: CARD } } });
    expect(seen[0]?.init.method).toBe('POST');
    expect((seen[0]?.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(seen[0]?.init.body)).params.action).toEqual({ type: 'vote', payload: { coin: 'BTC' } });
  });

  test('never calls a blocked url', async () => {
    const seen = stubFetch(() => Response.json(CARD));
    expect(await loadNode('https://192.168.0.2/', RFC8032_KEY)).toEqual({ ok: false, problem: 'blocked' });
    expect(await sendNodeAction('http://example.com/', RFC8032_KEY, { type: 'vote' })).toEqual({ ok: false, problem: 'blocked' });
    expect(seen).toHaveLength(0);
  });

  test('maps failures to problems', async () => {
    stubFetch(() => new Response('nope', { status: 503 }));
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'status', status: 503 });
    stubFetch(() => new Response('<html>'));
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'invalid' });
    stubFetch(() => new Response('x'.repeat(140 * 1024)));
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'too-large' });
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({ pull(controller) { pulled += 1; controller.enqueue(new Uint8Array(16 * 1024)); } });
    stubFetch(() => new Response(endless));
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'too-large' });
    expect(pulled).toBeLessThan(12);
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'unreachable' });
  });

  test('a load takes only a widget root and a tap only a sync action response', async () => {
    stubFetch(() => Response.json({}));
    expect(await sendNodeAction(URL_A, RFC8032_KEY, { type: 'vote' })).toEqual({ ok: true, reply: { kind: 'unchanged' } });
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'invalid' });
    stubFetch(() => new Response(null, { status: 204 }));
    expect(await sendNodeAction(URL_A, RFC8032_KEY, { type: 'vote' })).toEqual({ ok: false, problem: 'invalid' });
    stubFetch(() => Response.json({ updated_item: { type: 'widget', widget: CARD } }));
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'invalid' });
    stubFetch(() => Response.json(CARD));
    expect(await sendNodeAction(URL_A, RFC8032_KEY, { type: 'vote' })).toEqual({ ok: false, problem: 'invalid' });
  });

  test('refuses an action payload that is too large', async () => {
    const seen = stubFetch(() => Response.json(CARD));
    expect(await sendNodeAction(URL_A, RFC8032_KEY, { type: 'save', payload: { text: 'x'.repeat(17_000) } })).toEqual({ ok: false, problem: 'too-large' });
    expect(seen).toHaveLength(0);
  });
});
