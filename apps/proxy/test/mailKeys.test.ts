import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { verifyMessage, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { claimMessage } from '@stage-labs/client/identity/stageNames';
import { ensureMailKey, listMail, openMailSession } from '@stage-labs/client/mail/api';
import { deriveMailKey, mailPublicKeyHex } from '@stage-labs/client/mail/mailbox';
import { handleMail, type MailDeps } from '../src/mailApi.ts';
import { mailboxFetch } from '../src/mailBox.ts';
import { REJECT_INACTIVE, receiveMail, type IncomingMail } from '../src/mailReceive.ts';
import { handleNames } from '../src/names.ts';
import type { NamesChain, NamesDeps } from '../src/namesTypes.ts';
import { memoryStorage, type MemoryStorage } from './memoryArchive.ts';

const BASE = 'https://proxy.stage.box';
const ALICE = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const MALLORY = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
const CAROL = privateKeyToAccount('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a');
const NOW = Date.now();
const LABEL = 'alice1';

const owners = new Map<string, Hex>();
const boxes = new Map<string, MemoryStorage>();
const failing = { issue: false, mailbox: 0 };

const signer = (account: PrivateKeyAccount) => (message: string): Promise<Hex> => account.signMessage({ message });

function mailbox(label: string): { fetch(input: string, init?: RequestInit): Promise<Response> } {
  return {
    fetch: (input, init) => {
      if (failing.mailbox > 0) {
        failing.mailbox -= 1;
        return Promise.reject(new Error('object unavailable'));
      }
      const storage = boxes.get(label) ?? memoryStorage();
      boxes.set(label, storage);
      return mailboxFetch(new Request(input, init), storage, NOW);
    },
  };
}

const chain: NamesChain = {
  operator: '0x00000000000000000000000000000000000000EE',
  verifyClaim: (address, message, signature) => verifyMessage({ address, message, signature }),
  subnameOwner: (label) => Promise.resolve(owners.get(label) ?? null),
  issue: (label, owner) => {
    if (failing.issue) return Promise.reject(new Error('rpc down'));
    owners.set(label, owner);
    return Promise.resolve('0x7478');
  },
};

function memoryNames(): NamesDeps['store'] {
  const data = new Map<string, string>();
  return {
    get: (key) => Promise.resolve(data.get(key) ?? null),
    put: (key, value) => { data.set(key, value); return Promise.resolve(); },
  };
}

const mailDeps: MailDeps = {
  mailbox, chain: { owner: chain.subnameOwner, verify: chain.verifyClaim }, clientIp: '203.0.113.7', now: () => NOW,
};

async function mailKeyOf(account: PrivateKeyAccount, label = LABEL): Promise<Hex> {
  return mailPublicKeyHex(await deriveMailKey(label, signer(account)));
}

async function claim(fields: { signedKey?: Hex; sentKey?: Hex; account?: PrivateKeyAccount }): Promise<Response> {
  const account = fields.account ?? ALICE;
  const issuedAt = NOW - 1000;
  const signature = await account.signMessage({ message: claimMessage({ label: LABEL, address: account.address, issuedAt, mailKey: fields.signedKey }) });
  const body = { label: LABEL, address: account.address, issuedAt, signature, mailKey: fields.sentKey ?? fields.signedKey };
  const request = new Request(`${BASE}/names/claim`, { method: 'POST', body: JSON.stringify(body) });
  return handleNames(request, { chain, store: memoryNames(), mailbox, now: () => NOW });
}

async function deliver(to: string): Promise<string[]> {
  const bytes = new TextEncoder().encode('Subject: hi\r\n\r\nhello');
  const rejected: string[] = [];
  const message: IncomingMail = {
    from: 'ann@example.com', to, rawSize: bytes.byteLength, raw: new Blob([bytes]).stream(),
    headers: new Headers({ subject: 'hi' }), setReject: (reason) => { rejected.push(reason); },
  };
  await receiveMail(message, mailDeps);
  return rejected;
}

interface KeyStatus { address: string; owner: string; publicKey: string | null }

async function keyStatus(): Promise<KeyStatus> {
  return (await (await handleMail(new Request(`${BASE}/mail/key?label=${LABEL}`), mailDeps)).json()) as KeyStatus;
}

beforeEach(() => {
  owners.clear();
  boxes.clear();
  failing.issue = false;
  failing.mailbox = 0;
  spyOn(globalThis, 'fetch').mockImplementation(((input: string | URL | Request, init?: RequestInit) =>
    handleMail(new Request(input, init), mailDeps)) as typeof fetch);
});

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore(): void }).mockRestore();
});

describe('mail key in the name claim', () => {
  test('a claim with a key activates the mailbox once the name is issued', async () => {
    const key = await mailKeyOf(ALICE);
    const res = await claim({ signedKey: key });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'alice1.stage.base.eth', txHash: '0x7478', mailKey: 'stored' });
    expect(boxes.get(LABEL)?.data.get('key')).toEqual({ publicKey: key, owner: ALICE.address.toLowerCase(), issuedAt: NOW - 1000 });
    expect(await keyStatus()).toEqual({ address: 'alice1@st.box', owner: ALICE.address.toLowerCase(), publicKey: key });
    expect(await deliver('alice1@st.box')).toEqual([]);
  });

  test('a failed claim stores no key', async () => {
    failing.issue = true;
    expect((await claim({ signedKey: await mailKeyOf(ALICE) })).status).toBe(502);
    expect(boxes.get(LABEL)?.data.has('key') ?? false).toBe(false);
  });

  test('a claim without a key is accepted and leaves the mailbox inactive', async () => {
    const res = await claim({});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'alice1.stage.base.eth', txHash: '0x7478' });
    expect((await keyStatus()).publicKey).toBeNull();
    expect(await deliver('alice1@st.box')).toEqual([REJECT_INACTIVE]);
  });

  test('the claim signature covers the key', async () => {
    const swapped = await claim({ signedKey: await mailKeyOf(ALICE), sentKey: await mailKeyOf(MALLORY) });
    expect(swapped.status).toBe(401);
    expect((await claim({ sentKey: await mailKeyOf(MALLORY) })).status).toBe(401);
    expect((await claim({ sentKey: '0x1234' })).status).toBe(400);
    expect(owners.has(LABEL)).toBe(false);
    expect(boxes.get(LABEL)?.data.has('key') ?? false).toBe(false);
  });

  test('a failing mailbox is retried, and reported when it never stores the key', async () => {
    failing.mailbox = 2;
    expect(((await (await claim({ signedKey: await mailKeyOf(ALICE) })).json()) as { mailKey: string }).mailKey).toBe('stored');
    owners.clear();
    boxes.clear();
    failing.mailbox = 3;
    const res = await claim({ signedKey: await mailKeyOf(ALICE) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { mailKey: string }).mailKey).toBe('failed');
    expect(owners.get(LABEL)).toBe(ALICE.address);
  });
});

describe('mail key for names claimed before', () => {
  test('the owner registers once, others never do, and a new owner takes over', async () => {
    owners.set(LABEL, ALICE.address);
    expect(await ensureMailKey(BASE, LABEL, MALLORY.address, signer(MALLORY))).toBe(false);
    expect(await ensureMailKey(BASE, LABEL, ALICE.address, signer(ALICE))).toBe(true);
    expect((await keyStatus()).publicKey).toBe(await mailKeyOf(ALICE));
    expect(await ensureMailKey(BASE, LABEL, ALICE.address, signer(ALICE))).toBe(false);
    expect(await deliver('alice1@st.box')).toEqual([]);
    owners.set(LABEL, CAROL.address);
    expect((await keyStatus()).publicKey).toBeNull();
    expect(await deliver('alice1@st.box')).toEqual([REJECT_INACTIVE]);
    expect(await ensureMailKey(BASE, LABEL, CAROL.address, signer(CAROL))).toBe(true);
    expect(await listMail(await openMailSession(BASE, LABEL, signer(CAROL)))).toEqual([]);
    await expect(openMailSession(BASE, LABEL, signer(ALICE))).rejects.toThrow('(401)');
  });
});
