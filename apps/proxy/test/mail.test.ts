import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { verifyMessage, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  closeMailbox, deleteMail, fetchMail, listMail, openMailSession, registerMailKey, type MailSession,
} from '@stage-labs/client/mail/api';
import {
  MAIL_MAX_BYTES, deriveMailKey, mailSessionMessage, openMailIndex, openMailPart, type MailKeyPair,
} from '@stage-labs/client/mail/mailbox';
import { handleMail, type MailChain, type MailDeps } from '../src/mailApi.ts';
import { NONCE_TTL_MS, SESSION_TTL_MS, mailboxFetch } from '../src/mailBox.ts';
import { REJECT_INACTIVE, REJECT_TOO_LARGE, REJECT_UNKNOWN, receiveMail, type IncomingMail } from '../src/mailReceive.ts';
import { memoryStorage, type MemoryStorage } from './memoryArchive.ts';

const BASE = 'https://proxy.stage.box';
const ALICE = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const BOB = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
const MALLORY = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
const CAROL = privateKeyToAccount('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a');
const MIME = 'From: Ann <ann@example.com>\r\nTo: alice1@st.box\r\nSubject: Quarterly numbers\r\n\r\nsecret body text';

const clock = { now: 1_759_430_000_000 };
const owners = new Map<string, Hex>();
const boxes = new Map<string, MemoryStorage>();

const chain: MailChain = {
  owner: (label) => Promise.resolve(owners.get(label) ?? null),
  verify: (address, message, signature) => verifyMessage({ address, message, signature }),
};

function mailbox(label: string): { fetch(input: string, init?: RequestInit): Promise<Response> } {
  return {
    fetch: (input, init) => {
      const storage = boxes.get(label) ?? memoryStorage();
      boxes.set(label, storage);
      return mailboxFetch(new Request(input, init), storage, clock.now);
    },
  };
}

const deps: MailDeps = { mailbox, chain, clientIp: '203.0.113.7', now: () => clock.now };
const signer = (account: PrivateKeyAccount) => (message: string): Promise<Hex> => account.signMessage({ message });

function incoming(to: string, raw = MIME, rawSize?: number): { message: IncomingMail; rejected: string[] } {
  const bytes = new TextEncoder().encode(raw);
  const rejected: string[] = [];
  const message: IncomingMail = {
    from: 'bounce@example.com', to, rawSize: rawSize ?? bytes.byteLength, raw: new Blob([bytes]).stream(),
    headers: new Headers({ from: 'Ann <ann@example.com>', to, subject: 'Quarterly numbers' }),
    setReject: (reason) => { rejected.push(reason); },
  };
  return { message, rejected };
}

async function activate(label: string, account: PrivateKeyAccount): Promise<MailKeyPair> {
  owners.set(label, account.address);
  const keys = await deriveMailKey(label, signer(account));
  await registerMailKey(BASE, label, keys, signer(account), clock.now);
  return keys;
}

async function deliver(to: string): Promise<string[]> {
  const { message, rejected } = incoming(to);
  await receiveMail(message, deps);
  return rejected;
}

function post(path: string, body: unknown): Promise<Response> {
  return handleMail(new Request(`${BASE}/mail/${path}`, { method: 'POST', body: JSON.stringify(body) }), deps);
}

function storedText(label: string): string {
  return [...(boxes.get(label)?.data.values() ?? [])]
    .map((value) => (value instanceof ArrayBuffer ? new TextDecoder().decode(value) : JSON.stringify(value)))
    .join('\n');
}

beforeEach(() => {
  clock.now = 1_759_430_000_000;
  owners.clear();
  boxes.clear();
  spyOn(globalThis, 'fetch').mockImplementation(((input: string | URL | Request, init?: RequestInit) =>
    handleMail(new Request(input, init), deps)) as typeof fetch);
});

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore(): void }).mockRestore();
});

describe('st.box mail delivery', () => {
  test('stores only ciphertext that the owner lists, fetches and opens with the client helper', async () => {
    const keys = await activate('alice1', ALICE);
    expect(await deliver('Alice1+news@ST.box')).toEqual([]);
    expect(storedText('alice1')).not.toContain('secret body text');
    expect(storedText('alice1')).not.toContain('Quarterly numbers');
    const session = await openMailSession(BASE, 'alice1', signer(ALICE));
    const [mail] = await listMail(session);
    if (mail === undefined) throw new Error('no mail listed');
    expect(openMailIndex(keys.secretKey, 'alice1', mail.id, mail.index).subject).toBe('Quarterly numbers');
    const raw = openMailPart(keys.secretKey, 'alice1', mail.id, 'body', await fetchMail(session, mail.id));
    expect(new TextDecoder().decode(raw)).toBe(MIME);
    await deleteMail(session, mail.id);
    expect(await listMail(session)).toEqual([]);
    expect(boxes.get('alice1')?.data.get('usage')).toBe(0);
    expect([...(boxes.get('alice1')?.data.keys() ?? [])].filter((key) => key.startsWith('body:'))).toEqual([]);
  });

  test('rejects unknown names, role names, inactive mailboxes and oversized mail', async () => {
    owners.set('bobby1', BOB.address);
    owners.set('postmaster', BOB.address);
    expect(await deliver('nobody1@st.box')).toEqual([REJECT_UNKNOWN]);
    expect(await deliver('postmaster@st.box')).toEqual([REJECT_UNKNOWN]);
    expect(await deliver('bobby1@example.com')).toEqual([REJECT_UNKNOWN]);
    expect(await deliver('bobby1@st.box')).toEqual([REJECT_INACTIVE]);
    await activate('bobby1', BOB);
    const { message, rejected } = incoming('bobby1@st.box', MIME, MAIL_MAX_BYTES + 1);
    await receiveMail(message, deps);
    expect(rejected).toEqual([REJECT_TOO_LARGE]);
    expect(boxes.get('bobby1')?.data.has('usage')).toBe(false);
  });
});

describe('st.box mail access', () => {
  test('denies keys and sign-ins signed by someone other than the owner', async () => {
    owners.set('alice1', ALICE.address);
    const keys = await deriveMailKey('alice1', signer(MALLORY));
    await expect(registerMailKey(BASE, 'alice1', keys, signer(MALLORY), clock.now)).rejects.toThrow('(401)');
    await activate('alice1', ALICE);
    await expect(openMailSession(BASE, 'alice1', signer(MALLORY))).rejects.toThrow('(401)');
  });

  test('serves a mail only to its own mailbox owner', async () => {
    await activate('alice1', ALICE);
    await activate('bobby1', BOB);
    await deliver('alice1@st.box');
    const alice = await openMailSession(BASE, 'alice1', signer(ALICE));
    const [mail] = await listMail(alice);
    if (mail === undefined) throw new Error('no mail listed');
    const bob = await openMailSession(BASE, 'bobby1', signer(BOB));
    expect(await listMail(bob)).toEqual([]);
    await expect(fetchMail(bob, mail.id)).rejects.toThrow('(404)');
    const borrowed: MailSession = { ...bob, label: 'alice1' };
    await expect(listMail(borrowed)).rejects.toThrow('(401)');
    await expect(fetchMail(borrowed, mail.id)).rejects.toThrow('(401)');
    await expect(fetchMail({ ...alice, token: '' }, mail.id)).rejects.toThrow('(401)');
  });

  test('refuses expired sessions, expired challenges and replayed sign-ins', async () => {
    await activate('alice1', ALICE);
    const issued = (await (await post('challenge', { label: 'alice1' })).json()) as { nonce: string; expiresAt: number };
    const signature = await ALICE.signMessage({ message: mailSessionMessage({ label: 'alice1', ...issued }) });
    expect((await post('session', { label: 'alice1', nonce: issued.nonce, signature })).status).toBe(200);
    expect((await post('session', { label: 'alice1', nonce: issued.nonce, signature })).status).toBe(401);
    const session = await openMailSession(BASE, 'alice1', signer(ALICE));
    clock.now += SESSION_TTL_MS + 1;
    await expect(listMail(session)).rejects.toThrow('(401)');
    const late = (await (await post('challenge', { label: 'alice1' })).json()) as { nonce: string; expiresAt: number };
    const lateSignature = await ALICE.signMessage({ message: mailSessionMessage({ label: 'alice1', ...late }) });
    clock.now += NONCE_TTL_MS + 1;
    expect((await post('session', { label: 'alice1', nonce: late.nonce, signature: lateSignature })).status).toBe(401);
  });

  test('keeps at most 20 open sign-ins per mailbox, dropping the oldest first', async () => {
    await activate('alice1', ALICE);
    const issued: { nonce: string; expiresAt: number }[] = [];
    for (let i = 0; i < 25; i += 1) {
      clock.now += 1;
      issued.push((await (await post('challenge', { label: 'alice1' })).json()) as { nonce: string; expiresAt: number });
    }
    expect([...(boxes.get('alice1')?.data.keys() ?? [])].filter((key) => key.startsWith('nonce:')).length).toBe(20);
    const signIn = async (challenge: { nonce: string; expiresAt: number }): Promise<number> => {
      const signature = await ALICE.signMessage({ message: mailSessionMessage({ label: 'alice1', ...challenge }) });
      return (await post('session', { label: 'alice1', nonce: challenge.nonce, signature })).status;
    };
    expect(await signIn(issued[0] ?? { nonce: '', expiresAt: 0 })).toBe(401);
    expect(await signIn(issued[24] ?? { nonce: '', expiresAt: 0 })).toBe(200);
  });

  test('cuts access and delivery when the name moves to a new owner', async () => {
    await activate('alice1', ALICE);
    await deliver('alice1@st.box');
    const alice = await openMailSession(BASE, 'alice1', signer(ALICE));
    owners.set('alice1', CAROL.address);
    await expect(listMail(alice)).rejects.toThrow('(403)');
    await expect(openMailSession(BASE, 'alice1', signer(ALICE))).rejects.toThrow('(401)');
    expect(await deliver('alice1@st.box')).toEqual([REJECT_INACTIVE]);
    const carol = await openMailSession(BASE, 'alice1', signer(CAROL));
    expect(await listMail(carol)).toEqual([]);
    await activate('alice1', CAROL);
    expect([...(boxes.get('alice1')?.data.keys() ?? [])].filter((key) => key.startsWith('body:'))).toEqual([]);
    await closeMailbox(await openMailSession(BASE, 'alice1', signer(CAROL)));
    expect(boxes.get('alice1')?.data.size).toBe(0);
  });

  test('refuses replayed older key registrations and rate limits per client', async () => {
    const keys = await activate('alice1', ALICE);
    await expect(registerMailKey(BASE, 'alice1', keys, signer(ALICE), clock.now - 1)).rejects.toThrow('(409)');
    await expect(registerMailKey(BASE, 'alice1', keys, signer(ALICE), clock.now - 11 * 60 * 1000)).rejects.toThrow('(400)');
    const limited = await handleMail(
      new Request(`${BASE}/mail/challenge`, { method: 'POST', body: '{}' }),
      { ...deps, limiter: { limit: () => Promise.resolve({ success: false }) } },
    );
    expect(limited.status).toBe(429);
  });
});
