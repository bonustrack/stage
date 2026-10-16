import { describe, expect, test } from 'bun:test';
import { claimMessage } from '@stage-labs/client/identity/stageNames';
import { handleNames } from '../src/names.ts';
import { claimsStore, serialized } from '../src/namesClaims.ts';
import type { NamesChain, NamesDeps, NamesStore } from '../src/namesTypes.ts';

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

function fakeChain(opts: { valid?: boolean; taken?: string[]; fail?: boolean; failWith?: string } = {}): NamesChain & { issued: string[] } {
  const issued: string[] = [];
  return {
    issued,
    operator: '0x00000000000000000000000000000000000000EE',
    confirm: (hash) => Promise.resolve(hash),
    verifyClaim: async (_a, message, signature) => (opts.valid ?? true) && signature === '0x5169' && message.startsWith('Claim '),
    subnameOwner: async (label) => (opts.taken ?? []).includes(label) ? '0x00000000000000000000000000000000000000B2' : null,
    issue: async (label) => {
      if (opts.failWith) throw new Error(opts.failWith);
      if (opts.fail) throw new Error('rpc down\nURL: https://rpc.example/secret-key');
      issued.push(label);
      return '0xtx';
    },
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

  test('a signed retry for a name already owned by the claimant succeeds without another transaction', async () => {
    const chain = fakeChain();
    chain.subnameOwner = () => Promise.resolve(ALICE);
    const store = memoryStore();
    const response = await handleNames(claimRequest(goodClaim), deps(chain, store));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'fabien.stage.base.eth', alreadyOwned: true });
    expect(chain.issued).toEqual([]);
    expect(await store.get(`addr:${ALICE.toLowerCase()}`)).toBe('fabien');
    expect((await handleNames(claimRequest({ ...goodClaim, signature: '0x0bad' }), deps(chain, store))).status).toBe(401);
    expect((await handleNames(claimRequest({ ...goodClaim, issuedAt: NOW - 3_600_000 }), deps(chain, store))).status).toBe(400);
  });

  test('rejects short labels, stale claims, bad signatures and taken names', async () => {
    const store = memoryStore();
    expect((await handleNames(claimRequest({ ...goodClaim, label: 'abc' }), deps(fakeChain(), store))).status).toBe(400);
    expect((await handleNames(claimRequest({ ...goodClaim, issuedAt: NOW - 3_600_000 }), deps(fakeChain(), store))).status).toBe(400);
    expect((await handleNames(claimRequest({ ...goodClaim, signature: '0x0bad' }), deps(fakeChain(), store))).status).toBe(401);
    expect((await handleNames(claimRequest(goodClaim), deps(fakeChain({ taken: ['fabien'] }), store))).status).toBe(409);
    expect((await handleNames(claimRequest({ label: 'fabien' }), deps(fakeChain(), store))).status).toBe(400);
  });

  test('retains the reservation when a chain write has an uncertain outcome', async () => {
    const store = memoryStore();
    const res = await handleNames(claimRequest(goodClaim), deps(fakeChain({ fail: true }), store));
    expect(res.status).toBe(502);
    expect(await store.get('label:fabien')).toBe(ALICE.toLowerCase());
    expect(await store.get(`addr:${ALICE.toLowerCase()}`)).toBe('fabien');
    const d = deps(fakeChain(), store);
    expect(await (await handleNames(new Request(`https://proxy.stage.box/names/status?address=${ALICE}`), d)).json()).toEqual({ name: null });
    expect(await (await handleNames(new Request('https://proxy.stage.box/names/resolve?label=fabien'), d)).json()).toEqual({ address: null });
  });

  test('a broadcast with no returned hash is never resubmitted by a signed retry', async () => {
    const chain = fakeChain({ fail: true }); const store = memoryStore();
    let attempts = 0;
    chain.issue = () => { attempts += 1; return Promise.reject(new Error('broadcast response lost')); };
    expect((await handleNames(claimRequest(goodClaim), deps(chain, store))).status).toBe(502);
    expect((await handleNames(claimRequest(goodClaim), deps(chain, store))).status).toBe(502);
    expect(attempts).toBe(1);
    expect(await store.get('tx:fabien')).toBe('unknown');
    chain.subnameOwner = () => Promise.resolve(ALICE);
    expect((await handleNames(claimRequest(goodClaim), deps(chain, store))).status).toBe(200);
    expect(attempts).toBe(1);
  });

  test('an interrupted receipt resumes the stored transaction instead of issuing another', async () => {
    const hash = `0x${'1'.repeat(64)}` as const;
    const chain = fakeChain();
    let submitted = 0;
    const confirmed: string[] = [];
    chain.issue = async (_label, _owner, onSubmitted) => {
      submitted += 1;
      await onSubmitted?.(hash);
      throw new Error('receipt unavailable');
    };
    chain.confirm = (value) => { confirmed.push(value); return Promise.resolve(value); };
    const store = memoryStore();
    expect((await handleNames(claimRequest(goodClaim), deps(chain, store))).status).toBe(502);
    expect(await store.get('tx:fabien')).toBe(hash);
    const retried = await handleNames(claimRequest(goodClaim), deps(chain, store));
    expect(retried.status).toBe(200);
    expect(submitted).toBe(1);
    expect(confirmed).toEqual([hash]);
    expect(await store.get('tx:fabien')).toBeNull();
  });

  test('partial reservation writes never publish a pending name or broadcast a transaction', async () => {
    for (const key of ['pending:fabien', 'label:fabien', `addr:${ALICE.toLowerCase()}`, 'tx:fabien']) {
      const store = memoryStore();
      const put = store.put;
      store.put = async (name, value) => { await put(name, value); if (name === key) throw new Error('storage interrupted'); };
      const chain = fakeChain();
      const d = deps(chain, store);
      expect((await handleNames(claimRequest(goodClaim), d)).status).toBe(502);
      expect(chain.issued).toEqual([]);
      expect(await (await handleNames(new Request('https://proxy.stage.box/names/resolve?label=fabien'), d)).json()).toEqual({ address: null });
    }
  });

  test('a claim interrupted mid-issue can be resumed by its claimant but not taken by someone else', async () => {
    const store = memoryStore();
    store.data.set('label:fabien', ALICE.toLowerCase());
    store.data.set(`addr:${ALICE.toLowerCase()}`, 'fabien');
    const other = { ...goodClaim, address: '0x00000000000000000000000000000000000000C3' };
    expect((await handleNames(claimRequest(other), deps(fakeChain(), store))).status).toBe(409);
    const chain = fakeChain();
    expect((await handleNames(claimRequest(goodClaim), deps(chain, store))).status).toBe(200);
    expect(chain.issued).toEqual(['fabien']);
  });

  test('a failed registration never echoes the chain error, which can carry the RPC URL', async () => {
    const res = await handleNames(claimRequest(goodClaim), deps(fakeChain({ fail: true }), memoryStore()));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'registration could not be confirmed, try again to check it' });
  });

  test('a name taken onchain mid-claim is reported as taken and releases the reservation', async () => {
    const store = memoryStore();
    const res = await handleNames(claimRequest(goodClaim), deps(fakeChain({ failWith: 'name already taken' }), store));
    expect(res.status).toBe(409);
    expect(await store.get('label:fabien')).toBeNull();
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

  test('resolve returns the onchain owner, the claimed address, or null', async () => {
    const store = memoryStore(); const d = deps(fakeChain({ taken: ['ownedname'] }), store);
    expect(await (await handleNames(new Request('https://proxy.stage.box/names/resolve?label=ownedname'), d)).json())
      .toEqual({ address: '0x00000000000000000000000000000000000000b2' });
    await handleNames(claimRequest(goodClaim), d);
    expect(await (await handleNames(new Request('https://proxy.stage.box/names/resolve?label=fabien'), d)).json())
      .toEqual({ address: ALICE.toLowerCase() });
    expect(await (await handleNames(new Request('https://proxy.stage.box/names/resolve?label=nobody'), d)).json()).toEqual({ address: null });
    expect((await handleNames(new Request('https://proxy.stage.box/names/resolve?label=ab'), d)).status).toBe(400);
  });

  test('answers preflight', async () => {
    const res = await handleNames(new Request('https://proxy.stage.box/names/claim', { method: 'OPTIONS' }), deps(fakeChain(), memoryStore()));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});

describe('failures', () => {
  test('a chain error becomes a JSON error with CORS headers', async () => {
    const chain = fakeChain();
    chain.subnameOwner = async () => { throw new Error('over rate limit\nmore details'); };
    const res = await handleNames(new Request('https://proxy.stage.box/names/check?label=someone'), deps(chain, memoryStore()));
    expect(res.status).toBe(502);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({ error: 'name service error: over rate limit' });
  });
});

describe('claims durable object', () => {
  const BOB = '0x00000000000000000000000000000000000000B0';

  test('concurrent claims for one label are serialized, so only the first wins', async () => {
    const chain = fakeChain(); const store = memoryStore();
    const run = serialized((request) => handleNames(request, deps(chain, store)));
    const [first, second] = await Promise.all([
      run(claimRequest(goodClaim)),
      run(claimRequest({ ...goodClaim, address: BOB })),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(chain.issued).toEqual(['fabien']);
  });

  test('the object storage is read first and every write is mirrored to KV', async () => {
    const own = new Map<string, unknown>();
    const storage = {
      get: async (key: string): Promise<unknown> => own.get(key),
      put: async (key: string, value: string): Promise<void> => { own.set(key, value); },
    };
    const kv = memoryStore();
    kv.data.set('label:legacy', ALICE.toLowerCase());
    const store = claimsStore(storage, kv);
    expect(await store.get('label:legacy')).toBe(ALICE.toLowerCase());
    await store.put('label:fabien', BOB.toLowerCase());
    expect(own.get('label:fabien')).toBe(BOB.toLowerCase());
    expect(kv.data.get('label:fabien')).toBe(BOB.toLowerCase());
    await store.put('label:legacy', '');
    expect(await store.get('label:legacy')).toBeNull();
  });
});
