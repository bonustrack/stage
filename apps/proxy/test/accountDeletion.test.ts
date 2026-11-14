import { describe, expect, test } from 'bun:test';
import { verifyMessage, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { claimMessage, deletionMessage } from '@stage-labs/client/identity/stageNames';
import { mailboxFetch } from '../src/mailBox.ts';
import { handleNames } from '../src/names.ts';
import type { NamesChain, NamesDeps } from '../src/namesTypes.ts';
import { memoryStorage, type MemoryStorage } from './memoryArchive.ts';

const BASE = 'https://proxy.stage.box';
const ALICE = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const MALLORY = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
const NOW = 1_800_000_000_000;
const LABEL = 'alice1';

function world() {
  const owners = new Map<string, Hex>();
  const released: string[] = [];
  const data = new Map<string, string>();
  const boxes = new Map<string, MemoryStorage>();
  const chain: NamesChain = {
    confirm: (hash) => Promise.resolve(hash),
    verifyClaim: (address, message, signature) => verifyMessage({ address, message, signature }),
    subnameOwner: (label) => Promise.resolve(owners.get(label) ?? null),
    issue: (label, owner) => {
      owners.set(label, owner);
      return Promise.resolve('0x7478');
    },
    release: (label) => {
      owners.delete(label);
      released.push(label);
      return Promise.resolve('0x7265');
    },
  };
  const mailbox = (label: string): { fetch(input: string, init?: RequestInit): Promise<Response> } => ({
    fetch: (input, init) => {
      const storage = boxes.get(label) ?? memoryStorage();
      boxes.set(label, storage);
      return mailboxFetch(new Request(input, init), storage, NOW);
    },
  });
  const store: NamesDeps['store'] = {
    get: (key) => Promise.resolve(data.get(key) || null),
    put: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
  const deps: NamesDeps = { chain, store, mailbox, now: () => NOW };
  return { owners, released, data, boxes, deps };
}

type World = ReturnType<typeof world>;

async function post(w: World, path: string, body: unknown): Promise<Response> {
  return handleNames(new Request(`${BASE}/names/${path}`, { method: 'POST', body: JSON.stringify(body) }), w.deps);
}

async function claimName(w: World, account: PrivateKeyAccount = ALICE, label = LABEL): Promise<Response> {
  const issuedAt = NOW - 1000;
  const signature = await account.signMessage({ message: claimMessage({ label, address: account.address, issuedAt }) });
  return post(w, 'claim', { label, address: account.address, issuedAt, signature });
}

async function deletion(account: PrivateKeyAccount, signer: PrivateKeyAccount = account, issuedAt = NOW - 1000) {
  const signature = await signer.signMessage({ message: deletionMessage({ address: account.address, issuedAt }) });
  return { address: account.address, issuedAt, signature };
}

async function check(w: World, label = LABEL): Promise<unknown> {
  return (await handleNames(new Request(`${BASE}/names/check?label=${label}`), w.deps)).json();
}

describe('deleting an account on the name service', () => {
  test('releases the username onchain, retires it and erases the mailbox', async () => {
    const w = world();
    expect((await claimName(w)).status).toBe(200);
    const box = memoryStorage();
    box.data.set('key', { publicKey: '0xk', owner: ALICE.address.toLowerCase(), issuedAt: NOW - 5000 });
    box.data.set('mail:1', { id: '1' });
    w.boxes.set(LABEL, box);

    const res = await post(w, 'delete', await deletion(ALICE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, name: 'alice1.stage.base.eth', txHash: '0x7265', mail: true });
    expect(w.released).toEqual([LABEL]);
    expect(box.data.size).toBe(0);
    expect(w.data.get(`addr:${ALICE.address.toLowerCase()}`)).toBe('');
    const status = await handleNames(new Request(`${BASE}/names/status?address=${ALICE.address}`), w.deps);
    expect(await status.json()).toEqual({ name: null });
  });

  test('a deleted username is never issued again, to anyone', async () => {
    const w = world();
    await claimName(w);
    await post(w, 'delete', await deletion(ALICE));
    expect(await check(w)).toEqual({ valid: true, available: false });
    const again = await claimName(w, MALLORY);
    expect(again.status).toBe(409);
    expect(w.owners.get(LABEL)).toBeUndefined();
  });

  test('a request signed by someone else, or too old, changes nothing', async () => {
    const w = world();
    await claimName(w);
    expect((await post(w, 'delete', await deletion(ALICE, MALLORY))).status).toBe(401);
    expect((await post(w, 'delete', await deletion(ALICE, ALICE, NOW - 60 * 60 * 1000))).status).toBe(400);
    expect((await post(w, 'delete', { address: ALICE.address })).status).toBe(400);
    expect(w.released).toEqual([]);
    expect(w.owners.get(LABEL)).toBe(ALICE.address);
  });

  test('an account without a username succeeds with nothing to release', async () => {
    const w = world();
    const res = await post(w, 'delete', await deletion(ALICE));
    expect(await res.json()).toEqual({ deleted: true, name: null });
    expect(w.released).toEqual([]);
  });

  test('a retry after the name already left the account finishes without a second transaction', async () => {
    const w = world();
    await claimName(w);
    w.owners.delete(LABEL);
    const res = await post(w, 'delete', await deletion(ALICE));
    expect(await res.json()).toMatchObject({ deleted: true, name: 'alice1.stage.base.eth', txHash: null });
    expect(w.released).toEqual([]);
    expect(await check(w)).toEqual({ valid: true, available: false });
  });
});

describe('mailbox erase', () => {
  test('refuses to erase a mailbox registered to another owner', async () => {
    const box = memoryStorage();
    box.data.set('key', { publicKey: '0xk', owner: '0xother', issuedAt: 1 });
    const res = await mailboxFetch(
      new Request('https://mailbox/erase', { method: 'POST', body: JSON.stringify({ owner: ALICE.address.toLowerCase() }) }),
      box,
      NOW,
    );
    expect(res.status).toBe(409);
    expect(box.data.size).toBe(1);
  });
});
