import { afterEach, describe, expect, test } from 'bun:test';
import { claimMessage } from '@stage-labs/client/identity/stageNames';
import { fetchIssuedAddress, fetchIssuedName, fetchNameCheck, postNameClaim } from '@stage-labs/client/identity/namesApi';
import { handleNames } from '../src/names.ts';
import { claimsStore, serialized } from '../src/namesClaims.ts';
import type { NamesChain, NamesDeps, NamesStore } from '../src/namesTypes.ts';
import { restoreFetch, stubFetch } from './fakeFetch.ts';

const ALICE = '0x00000000000000000000000000000000000000A1';
const BOB = '0x00000000000000000000000000000000000000B0';
const NOW = 1_800_000_000_000;

function memoryStore(): NamesStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => {
      const v = data.get(key);
      return v === undefined || v === '' ? null : v;
    },
    put: async (key, value) => {
      data.set(key, value);
    },
  };
}

function fakeChain(opts: { valid?: boolean; taken?: string[]; fail?: boolean; failWith?: string } = {}): NamesChain & { issued: string[] } {
  const issued: string[] = [];
  return {
    issued,
    confirm: (hash) => Promise.resolve(hash),
    verifyClaim: async (_a, message, signature) => (opts.valid ?? true) && signature === '0x5169' && message.startsWith('Claim '),
    subnameOwner: async (label) => ((opts.taken ?? []).includes(label) ? '0x00000000000000000000000000000000000000B2' : null),
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
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function get(path: string, d: NamesDeps): Promise<Response> {
  return handleNames(new Request(`https://proxy.stage.box/names/${path}`), d);
}

const goodClaim = { label: 'fabien', address: ALICE, issuedAt: NOW - 1000, signature: '0x5169' };

describe('claim', () => {
  test('issues a valid claim and remembers it for the address', async () => {
    const chain = fakeChain();
    const store = memoryStore();
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
    expect(await (await get(`status?address=${ALICE}`, d)).json()).toEqual({ name: null });
    expect(await (await get('resolve?label=fabien', d)).json()).toEqual({ address: null });
  });

  test('a broadcast with no returned hash is never resubmitted by a signed retry', async () => {
    const chain = fakeChain({ fail: true });
    const store = memoryStore();
    let attempts = 0;
    chain.issue = () => {
      attempts += 1;
      return Promise.reject(new Error('broadcast response lost'));
    };
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
    chain.confirm = (value) => {
      confirmed.push(value);
      return Promise.resolve(value);
    };
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
      store.put = async (name, value) => {
        await put(name, value);
        if (name === key) throw new Error('storage interrupted');
      };
      const chain = fakeChain();
      const d = deps(chain, store);
      expect((await handleNames(claimRequest(goodClaim), d)).status).toBe(502);
      expect(chain.issued).toEqual([]);
      expect(await (await get('resolve?label=fabien', d)).json()).toEqual({ address: null });
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
    expect(await (await get('check?label=fabien', d)).json()).toEqual({ valid: true, available: false });
    expect(await (await get('check?label=someone', d)).json()).toEqual({ valid: true, available: true });
    expect(((await (await get('check?label=ab', d)).json()) as { valid: boolean }).valid).toBe(false);
  });

  test('status returns the name owned by an address, or null', async () => {
    const d = deps(fakeChain(), memoryStore());
    expect(await (await get(`status?address=${ALICE}`, d)).json()).toEqual({ name: null });
    await handleNames(claimRequest(goodClaim), d);
    expect(await (await get(`status?address=${ALICE}`, d)).json()).toEqual({ name: 'fabien.stage.base.eth' });
    expect((await get('status', d)).status).toBe(400);
  });

  test('resolve returns the onchain owner, the claimed address, or null', async () => {
    const d = deps(fakeChain({ taken: ['ownedname'] }), memoryStore());
    expect(await (await get('resolve?label=ownedname', d)).json()).toEqual({ address: '0x00000000000000000000000000000000000000b2' });
    await handleNames(claimRequest(goodClaim), d);
    expect(await (await get('resolve?label=fabien', d)).json()).toEqual({ address: ALICE.toLowerCase() });
    expect(await (await get('resolve?label=nobody', d)).json()).toEqual({ address: null });
    expect((await get('resolve?label=ab', d)).status).toBe(400);
  });
});

describe('failures', () => {
  test('a chain error becomes a JSON error with CORS headers', async () => {
    const chain = fakeChain();
    chain.subnameOwner = async () => {
      throw new Error('over rate limit\nmore details');
    };
    const res = await get('check?label=someone', deps(chain, memoryStore()));
    expect(res.status).toBe(502);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({ error: 'name service error: over rate limit' });
  });
});

describe('claims durable object', () => {
  test('concurrent claims for one label are serialized, so only the first wins', async () => {
    const chain = fakeChain();
    const store = memoryStore();
    const run = serialized((request) => handleNames(request, deps(chain, store)));
    const [first, second] = await Promise.all([run(claimRequest(goodClaim)), run(claimRequest({ ...goodClaim, address: BOB }))]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(chain.issued).toEqual(['fabien']);
  });

  test('the object storage is read first and every write is mirrored to KV', async () => {
    const own = new Map<string, unknown>();
    const storage = {
      get: async (key: string): Promise<unknown> => own.get(key),
      put: async (key: string, value: string): Promise<void> => {
        own.set(key, value);
      },
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

describe('the client names api against the handler', () => {
  const base = 'https://proxy.stage.box';
  const signature = '0x5169' as const;
  afterEach(restoreFetch);

  test('reads every answer the handler writes', async () => {
    const d = deps(fakeChain({ taken: ['ownedname'] }), memoryStore());
    stubFetch((request) => handleNames(request, d));
    expect(await fetchIssuedName(base, ALICE)).toBeNull();
    expect(await fetchIssuedAddress(base, 'fabien')).toBeNull();
    expect(await fetchNameCheck(base, 'fabien')).toEqual({ valid: true, available: true });
    expect(await fetchNameCheck(base, 'ab')).toMatchObject({ valid: false, available: false });
    expect(await postNameClaim(base, { ...goodClaim, signature })).toEqual({
      kind: 'claimed',
      name: 'fabien.stage.base.eth',
      mailKeyFailed: false,
    });
    expect(await fetchIssuedName(base, ALICE)).toBe('fabien.stage.base.eth');
    expect(await fetchIssuedAddress(base, 'fabien')).toBe(ALICE.toLowerCase());
    expect(await fetchIssuedAddress(base, 'ownedname')).toBe('0x00000000000000000000000000000000000000b2');
    expect(await fetchNameCheck(base, 'fabien')).toEqual({ valid: true, available: false });
  });

  test('sends claims the handler accepts or refuses in the shape the client reads', async () => {
    const d = deps(fakeChain(), memoryStore());
    stubFetch((request) => handleNames(request, d));
    const mailKey = `0x${'ab'.repeat(32)}`;
    expect((await postNameClaim(base, { ...goodClaim, signature })).kind).toBe('claimed');
    expect(await postNameClaim(base, { ...goodClaim, address: BOB, signature })).toEqual({ kind: 'taken' });
    expect(await postNameClaim(base, { ...goodClaim, label: 'second', address: BOB, signature, mailKey })).toEqual({
      kind: 'claimed',
      name: 'second.stage.base.eth',
      mailKeyFailed: true,
    });
    expect(await postNameClaim(base, { ...goodClaim, label: 'third', signature, mailKey: '0x12' })).toEqual({
      kind: 'refused',
      status: 400,
      error: 'label, address, issuedAt and signature required',
    });
  });
});
