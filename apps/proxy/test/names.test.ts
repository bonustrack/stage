import { describe, expect, test } from 'bun:test';
import { claimMessage } from '@stage-labs/client/identity/stageNames';
import { handleNames, type NamesChain, type NamesDeps, type NamesStore } from '../src/names.ts';

const ALICE = '0x00000000000000000000000000000000000000A1';
const NOW = 1_800_000_000_000;

function memoryStore(): NamesStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => { const v = data.get(key); return v === undefined || v === '' ? null : v; },
    put: async (key, value) => { data.set(key, value); },
  };
}

function fakeChain(opts: { valid?: boolean; taken?: string[]; fail?: boolean } = {}): NamesChain & { issued: string[] } {
  const issued: string[] = [];
  return {
    issued,
    operator: '0x00000000000000000000000000000000000000EE',
    verifyClaim: async (_a, message, signature) => (opts.valid ?? true) && signature === '0x5169' && message.startsWith('Claim '),
    subnameOwner: async (label) => (opts.taken ?? []).includes(label) ? '0x00000000000000000000000000000000000000B2' : null,
    issue: async (label) => { if (opts.fail) throw new Error('rpc down'); issued.push(label); return '0xtx'; },
  };
}

function deps(chain: NamesChain, store: NamesStore): NamesDeps {
  return { chain, store, now: () => NOW };
}

function claimRequest(body: unknown): Request {
  return new Request('https://proxy.stage.box/names/claim', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

const goodClaim = { label: 'fabien', address: ALICE, issuedAt: NOW - 1000, signature: '0x5169' };

describe('claim', () => {
  test('issues a valid claim and remembers it for the address', async () => {
    const chain = fakeChain(); const store = memoryStore();
    const res = await handleNames(claimRequest(goodClaim), deps(chain, store));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'fabien.stage.base.eth', txHash: '0xtx' });
    expect(chain.issued).toEqual(['fabien']);
    expect(store.data.get(`addr:${ALICE.toLowerCase()}`)).toBe('fabien');
    const again = await handleNames(claimRequest({ ...goodClaim, label: 'second' }), deps(chain, store));
    expect(again.status).toBe(409);
  });

  test('rejects short labels, stale claims, bad signatures and taken names', async () => {
    const store = memoryStore();
    expect((await handleNames(claimRequest({ ...goodClaim, label: 'abc' }), deps(fakeChain(), store))).status).toBe(400);
    expect((await handleNames(claimRequest({ ...goodClaim, issuedAt: NOW - 3_600_000 }), deps(fakeChain(), store))).status).toBe(400);
    expect((await handleNames(claimRequest({ ...goodClaim, signature: '0x0bad' }), deps(fakeChain(), store))).status).toBe(401);
    expect((await handleNames(claimRequest(goodClaim), deps(fakeChain({ taken: ['fabien'] }), store))).status).toBe(409);
    expect((await handleNames(claimRequest({ label: 'fabien' }), deps(fakeChain(), store))).status).toBe(400);
  });

  test('releases the label lock when the chain write fails', async () => {
    const store = memoryStore();
    const res = await handleNames(claimRequest(goodClaim), deps(fakeChain({ fail: true }), store));
    expect(res.status).toBe(502);
    expect(await store.get('label:fabien')).toBeNull();
    expect(await store.get(`addr:${ALICE.toLowerCase()}`)).toBeNull();
  });

  test('the signed message binds label, address and time', () => {
    expect(claimMessage(goodClaim)).toBe(`Claim fabien.stage.base.eth for ${ALICE.toLowerCase()} at ${NOW - 1000}`);
  });
});

describe('check and status', () => {
  test('reports validity and availability', async () => {
    const d = deps(fakeChain({ taken: ['fabien'] }), memoryStore());
    const taken = await (await handleNames(new Request('https://proxy.stage.box/names/check?label=fabien'), d)).json();
    expect(taken).toEqual({ valid: true, available: false });
    const free = await (await handleNames(new Request('https://proxy.stage.box/names/check?label=someone'), d)).json();
    expect(free).toEqual({ valid: true, available: true });
    const invalid = await (await handleNames(new Request('https://proxy.stage.box/names/check?label=ab'), d)).json() as { valid: boolean };
    expect(invalid.valid).toBe(false);
  });

  test('status returns the name owned by an address, or null', async () => {
    const store = memoryStore(); const d = deps(fakeChain(), store);
    expect(await (await handleNames(new Request(`https://proxy.stage.box/names/status?address=${ALICE}`), d)).json()).toEqual({ name: null });
    await handleNames(claimRequest(goodClaim), d);
    expect(await (await handleNames(new Request(`https://proxy.stage.box/names/status?address=${ALICE}`), d)).json()).toEqual({ name: 'fabien.stage.base.eth' });
    expect((await handleNames(new Request('https://proxy.stage.box/names/status'), d)).status).toBe(400);
  });

  test('answers preflight', async () => {
    const res = await handleNames(new Request('https://proxy.stage.box/names/claim', { method: 'OPTIONS' }), deps(fakeChain(), memoryStore()));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});
