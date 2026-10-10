import { afterEach, describe, expect, test } from 'bun:test';
import { ed25519 } from '@noble/curves/ed25519';
import { utf8ToBytes } from '@noble/hashes/utils';
import { clientRateKey, hostedNodeUrl, isNodeId, nodeIdOf, nodeScriptName } from '../src/nodes/hosting';
import { nodeKeyId } from '../src/nodes/protocol';
import { deleteNode, nodeCodeTooLarge, ownNodeUrl, publishNode } from '../src/nodes/publish';
import { base64url, base64urlBytes, isStrongNodeKey, nodeSigningText } from '../src/nodes/signing';

const RFC8032_KEY = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const RFC8032_PUBLIC = '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo';
const RFC8032_NODE = '21fe31dfa154a261626bf854046fd2271b7bed4b6abe45aa58877ef47f9721b9'.slice(0, 32);
const PROXY = 'https://proxy.stage.box';
const CODE = 'export default { fetch: () => Response.json({ type: "Card", children: [] }) };';
const realFetch = globalThis.fetch;

interface Seen { url: string; init: RequestInit }

function stubFetch(respond: () => Response | Promise<Response>): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    seen.push({ url: String(input), init: init ?? {} });
    return respond();
  }, { preconnect: realFetch.preconnect });
  return seen;
}

afterEach(() => { globalThis.fetch = realFetch; });

describe('hosted node ids', () => {
  test('are the first 16 bytes of the SHA-256 of the public key, in hex', () => {
    expect(nodeIdOf(RFC8032_PUBLIC)).toBe(RFC8032_NODE);
    expect(ownNodeUrl(RFC8032_KEY)).toBe(`https://nodes.stage.box/${RFC8032_NODE}`);
    expect(hostedNodeUrl(RFC8032_NODE)).toBe(`https://nodes.stage.box/${RFC8032_NODE}`);
    expect(nodeScriptName(RFC8032_NODE)).toBe(`node-${RFC8032_NODE}`);
  });

  test('need a 32 byte key', () => {
    expect(nodeIdOf(RFC8032_PUBLIC.slice(0, 42))).toBeNull();
    expect(nodeIdOf(`${RFC8032_PUBLIC}AA`)).toBeNull();
    expect(nodeIdOf('not base64url!')).toBeNull();
    expect(nodeIdOf('')).toBeNull();
  });

  test('are 32 lowercase hex characters', () => {
    expect(isNodeId(RFC8032_NODE)).toBe(true);
    expect(isNodeId(RFC8032_NODE.toUpperCase())).toBe(false);
    expect(isNodeId(RFC8032_NODE.slice(1))).toBe(false);
    expect(isNodeId(`${RFC8032_NODE}0`)).toBe(false);
    expect(isNodeId(`../${RFC8032_NODE.slice(3)}`)).toBe(false);
  });

  test('base64url round trips and refuses other alphabets', () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 62, 63]);
    expect(base64url(bytes)).toBe('-_8AAT4_');
    expect(base64urlBytes('-_8AAT4_')).toEqual(bytes);
    expect(base64urlBytes('+/8AAT4/')).toBeNull();
    expect(base64urlBytes('abcde')).toBeNull();
  });
});

describe('node keys and rate keys', () => {
  test('small order public keys are refused, real keys pass', () => {
    const identity = new Uint8Array(32);
    identity[0] = 1;
    expect(isStrongNodeKey(identity)).toBe(false);
    expect(isStrongNodeKey(new Uint8Array(32))).toBe(false);
    expect(isStrongNodeKey(new Uint8Array(32).fill(255))).toBe(false);
    expect(isStrongNodeKey(new Uint8Array(31))).toBe(false);
    expect(isStrongNodeKey(base64urlBytes(RFC8032_PUBLIC) ?? new Uint8Array())).toBe(true);
  });

  test('the signing text hashes the same bytes for a string or its UTF-8', () => {
    const body = '\uFEFFexport default {};';
    expect(nodeSigningText('PUT', PROXY, '1', new TextEncoder().encode(body))).toBe(nodeSigningText('PUT', PROXY, '1', body));
  });

  test('an IPv6 client counts by its /64 and an IPv4 one by its address', () => {
    expect(clientRateKey('203.0.113.7')).toBe('203.0.113.7');
    expect(clientRateKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(clientRateKey('2001:DB8:0001:0002::9')).toBe('2001:db8:1:2::/64');
    expect(clientRateKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(clientRateKey('::1')).toBe('0:0:0:0::/64');
    expect(clientRateKey('::ffff:198.51.100.4')).toBe('198.51.100.4');
    expect(clientRateKey('unknown')).toBe('unknown');
  });
});

describe('publishing', () => {
  test('signs a PUT of the code to the proxy with the node key', async () => {
    const seen = stubFetch(() => Response.json({ id: RFC8032_NODE }));
    expect(await publishNode(PROXY, RFC8032_KEY, CODE)).toEqual({ ok: true, url: `https://nodes.stage.box/${RFC8032_NODE}` });
    const call = seen[0];
    expect(call?.url).toBe(`${PROXY}/nodes`);
    expect(call?.init).toMatchObject({ method: 'PUT', body: CODE, credentials: 'omit', redirect: 'error', cache: 'no-store' });
    const headers = call?.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/javascript');
    expect(headers['Stage-Key']).toBe(nodeKeyId(RFC8032_KEY));
    const text = nodeSigningText('PUT', `${PROXY}/nodes`, headers['Stage-Timestamp'] ?? '', CODE);
    expect(ed25519.verify(base64urlBytes(headers['Stage-Signature'] ?? '') ?? new Uint8Array(), utf8ToBytes(text), base64urlBytes(RFC8032_PUBLIC) ?? new Uint8Array())).toBe(true);
  });

  test('checks the code before sending it', async () => {
    const seen = stubFetch(() => Response.json({}));
    expect(nodeCodeTooLarge('é'.repeat(32 * 1024))).toBe(false);
    expect(nodeCodeTooLarge('é'.repeat(32 * 1024 + 1))).toBe(true);
    expect(await publishNode(PROXY, RFC8032_KEY, 'x'.repeat(64 * 1024 + 1))).toEqual({ ok: false, problem: 'too-large' });
    expect(await publishNode(PROXY, RFC8032_KEY, '  \n')).toEqual({ ok: false, problem: 'refused' });
    expect(seen).toHaveLength(0);
  });

  test('maps proxy answers to problems', async () => {
    const cases: [Response, unknown][] = [
      [Response.json({ error: 'Uncaught SyntaxError: Unexpected token' }, { status: 400 }), { ok: false, problem: 'refused', detail: 'Uncaught SyntaxError: Unexpected token' }],
      [Response.json({ error: 'code too large' }, { status: 413 }), { ok: false, problem: 'too-large' }],
      [Response.json({ error: 'rate limited' }, { status: 429 }), { ok: false, problem: 'busy' }],
      [Response.json({ error: 'nodes are not set up' }, { status: 503 }), { ok: false, problem: 'not-ready' }],
      [Response.json({ error: 'full' }, { status: 507 }), { ok: false, problem: 'full' }],
      [Response.json({ error: 'invalid signature' }, { status: 401 }), { ok: false, problem: 'failed' }],
      [new Response('<html>', { status: 400 }), { ok: false, problem: 'refused', detail: undefined }],
    ];
    for (const [response, expected] of cases) {
      stubFetch(() => response);
      expect(await publishNode(PROXY, RFC8032_KEY, CODE)).toEqual(expected);
    }
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await publishNode(PROXY, RFC8032_KEY, CODE)).toEqual({ ok: false, problem: 'unreachable' });
  });

  test('deletes with a signed DELETE and treats a missing node as gone', async () => {
    const seen = stubFetch(() => Response.json({ id: RFC8032_NODE }));
    expect(await deleteNode(PROXY, RFC8032_KEY)).toBe(true);
    expect(seen[0]?.init.method).toBe('DELETE');
    expect(seen[0]?.init.body).toBeUndefined();
    const headers = seen[0]?.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    const text = nodeSigningText('DELETE', `${PROXY}/nodes`, headers['Stage-Timestamp'] ?? '', '');
    expect(ed25519.verify(base64urlBytes(headers['Stage-Signature'] ?? '') ?? new Uint8Array(), utf8ToBytes(text), base64urlBytes(RFC8032_PUBLIC) ?? new Uint8Array())).toBe(true);
    stubFetch(() => Response.json({ error: 'no such node' }, { status: 404 }));
    expect(await deleteNode(PROXY, RFC8032_KEY)).toBe(true);
    stubFetch(() => Response.json({ error: 'node hosting failed' }, { status: 502 }));
    expect(await deleteNode(PROXY, RFC8032_KEY)).toBe(false);
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await deleteNode(PROXY, RFC8032_KEY)).toBe(false);
  });
});
