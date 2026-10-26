import { afterEach, describe, expect, test } from 'bun:test';
import { ed25519 } from '@noble/curves/ed25519';
import { utf8ToBytes } from '@noble/hashes/utils';
import { base64ToBytes } from '../src/text/base64';
import {
  loadNode, loadReplyOf, messageReplyOf, newNodeKey, nodeHeaders, nodeKeyId, nodeRequestBody, nodeUrlOf, sendNodeMessage,
} from '../src/nodes/protocol';
import { nodeSigningText } from '../src/nodes/signing';

const RFC8032_KEY = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const RFC8032_PUBLIC = '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo';
const URL_A = 'https://btc.example.com/';
const NOW = 1_760_000_000_000;
const KIT = 'https://kit.stage.box/a2ui/v1_0/catalog.json';
const MESSAGES = [{ version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: KIT, components: [{ id: 'root', component: 'Title', text: '$100' }] } }];
const UPDATE = { version: 'v1.0', updateDataModel: { surfaceId: 'main', path: '/price', value: 101 } };
const VOTE = { name: 'vote', surfaceId: 'main', sourceComponentId: 'yes', timestamp: '2026-10-26T00:00:00.000Z', context: { option: 'yes' } };
const VOTE_MESSAGE = { version: 'v1.0', action: VOTE };
const CAPABILITIES = { 'v1.0': { supportedCatalogIds: [KIT] } };
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
      'https://localhost..', 'https://nas.local..', 'https://printer.local...',
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
    const body = nodeRequestBody({ message: VOTE_MESSAGE });
    const headers = nodeHeaders('POST', URL_A, body, RFC8032_KEY, NOW);
    const publicKey = await crypto.subtle.importKey('raw', bytesOf(RFC8032_PUBLIC), { name: 'Ed25519' }, false, ['verify']);
    const signed = utf8ToBytes(nodeSigningText('POST', URL_A, headers['Stage-Timestamp'] ?? '', body));
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, bytesOf(headers['Stage-Signature'] ?? ''), signed)).toBe(true);
  });
});

describe('node requests', () => {
  test('are the A2UI renderer message, with capabilities and the data model in its metadata', () => {
    expect(JSON.parse(nodeRequestBody({ message: VOTE_MESSAGE }))).toEqual(VOTE_MESSAGE);
    expect(JSON.parse(nodeRequestBody({ message: VOTE_MESSAGE, dataModel: { main: { price: 1 } } }, CAPABILITIES)).metadata).toEqual({
      a2uiRendererCapabilities: CAPABILITIES,
      a2uiRendererDataModel: { version: 'v1.0', surfaces: { main: { price: 1 } } },
    });
  });
});

describe('node replies', () => {
  const frame = { kind: 'frame', frame: { messages: MESSAGES } };
  const answer = { version: 'v1.0', agentFunctionResponse: { functionCallId: 'main.1', value: 42 } };
  const call = { version: 'v1.0', callRendererFunction: { functionCallId: 'f1', callFunction: { '@call': 'formatNumber', catalogId: KIT, args: { value: 1 } } } };

  test('a load answers A2UI messages as an array, a messages object or one message', () => {
    expect(loadReplyOf(MESSAGES)).toEqual(frame);
    expect(loadReplyOf({ messages: MESSAGES })).toEqual(frame);
    expect(loadReplyOf(MESSAGES[0])).toEqual(frame);
  });

  test('a request answers any agent message, function calls and answers included, and no messages keep the current frame', () => {
    expect(messageReplyOf([UPDATE])).toEqual({ kind: 'messages', messages: [UPDATE] });
    expect(messageReplyOf([answer, call, UPDATE])).toEqual({ kind: 'messages', messages: [answer, call, UPDATE] });
    for (const empty of [[], {}, { messages: [] }, undefined]) expect(messageReplyOf(empty)).toEqual({ kind: 'unchanged' });
  });

  test('a load refuses anything but A2UI frame messages', () => {
    const refused = [
      null, undefined, [], 'Card', {}, { price: 1 }, { type: 'Card', children: [] }, [{ version: 'v0.9', createSurface: { surfaceId: 'a' } }],
      [{ version: 'v1.0', createSurface: { surfaceId: 'a' }, extra: 1 }], [answer], [call],
      [{ version: 'v1.0', updateComponents: { components: [] } }], { messages: MESSAGES, title: 'x' },
      [{ version: 'v1.0', createSurface: { surfaceId: 'a', note: 'x'.repeat(70_000) } }],
    ];
    for (const reply of refused) expect([reply, loadReplyOf(reply)]).toEqual([reply, null]);
  });

  test('a request refuses anything but A2UI agent messages', () => {
    const refused = [
      null, 'Card', { price: 1 }, { updated_item: { type: 'widget' } }, [VOTE_MESSAGE],
      [{ version: 'v1.0', agentFunctionResponse: { value: 1 } }], [{ version: 'v1.0', callRendererFunction: {} }],
    ];
    for (const reply of refused) expect([reply, messageReplyOf(reply)]).toEqual([reply, null]);
  });
});

describe('node calls', () => {
  test('loads with a signed GET, without cookies or redirects', async () => {
    const seen = stubFetch(() => Response.json(MESSAGES));
    expect(await loadNode('https://BTC.example.com', RFC8032_KEY, { capabilities: CAPABILITIES })).toEqual({ ok: true, reply: { kind: 'frame', frame: { messages: MESSAGES } } });
    const call = seen[0];
    expect(call?.url).toBe(URL_A);
    expect(call?.init).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
    const headers = call?.init.headers as Record<string, string>;
    expect(headers['Stage-Key']).toBe(RFC8032_PUBLIC);
    expect(JSON.parse(headers['Stage-A2UI-Capabilities'] ?? '')).toEqual(CAPABILITIES);
    const text = nodeSigningText('GET', URL_A, headers['Stage-Timestamp'] ?? '', '');
    expect(ed25519.verify(bytesOf(headers['Stage-Signature'] ?? ''), utf8ToBytes(text), bytesOf(RFC8032_PUBLIC))).toBe(true);
  });

  test('posts an action as JSON and returns the A2UI messages it answers, JSON lines included', async () => {
    const seen = stubFetch(() => new Response(`${JSON.stringify(UPDATE)}\n${JSON.stringify(UPDATE)}\n`));
    const result = await sendNodeMessage(URL_A, RFC8032_KEY, { message: VOTE_MESSAGE });
    expect(result).toEqual({ ok: true, reply: { kind: 'messages', messages: [UPDATE, UPDATE] } });
    expect(seen[0]?.init.method).toBe('POST');
    expect((seen[0]?.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(seen[0]?.init.body)).action).toEqual(VOTE);
    const call = { version: 'v1.0', callAgentFunction: { surfaceId: 'main', functionCallId: 'main.1', callFunction: { '@call': 'quote', catalogId: KIT } } };
    expect(await sendNodeMessage(URL_A, RFC8032_KEY, { message: call })).toMatchObject({ ok: true });
    expect(JSON.parse(String(seen[1]?.init.body))).toEqual(call);
    expect(await sendNodeMessage(URL_A, RFC8032_KEY, { message: { version: 'v1.0', createSurface: { surfaceId: 'x' } } })).toEqual({ ok: false, problem: 'invalid' });
    expect(seen).toHaveLength(2);
  });

  test('never calls a blocked url', async () => {
    const seen = stubFetch(() => Response.json(MESSAGES));
    expect(await loadNode('https://192.168.0.2/', RFC8032_KEY)).toEqual({ ok: false, problem: 'blocked' });
    expect(await sendNodeMessage('http://example.com/', RFC8032_KEY, { message: VOTE_MESSAGE })).toEqual({ ok: false, problem: 'blocked' });
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

  test('a load needs a surface, a tap may answer nothing', async () => {
    stubFetch(() => Response.json([]));
    expect(await sendNodeMessage(URL_A, RFC8032_KEY, { message: VOTE_MESSAGE })).toEqual({ ok: true, reply: { kind: 'unchanged' } });
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'invalid' });
    stubFetch(() => new Response(null, { status: 204 }));
    expect(await sendNodeMessage(URL_A, RFC8032_KEY, { message: VOTE_MESSAGE })).toEqual({ ok: true, reply: { kind: 'unchanged' } });
    expect(await loadNode(URL_A, RFC8032_KEY)).toEqual({ ok: false, problem: 'invalid' });
    stubFetch(() => Response.json({ updated_item: { type: 'widget' } }));
    expect(await sendNodeMessage(URL_A, RFC8032_KEY, { message: VOTE_MESSAGE })).toEqual({ ok: false, problem: 'invalid' });
  });

  test('refuses an action payload that is too large', async () => {
    const seen = stubFetch(() => Response.json(MESSAGES));
    expect(await sendNodeMessage(URL_A, RFC8032_KEY, { message: { version: 'v1.0', action: { ...VOTE, context: { text: 'x'.repeat(17_000) } } } })).toEqual({ ok: false, problem: 'too-large' });
    expect(seen).toHaveLength(0);
  });
});
