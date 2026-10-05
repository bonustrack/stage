import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import type { SignMessage } from '@stage-labs/client/mail/api';
import { deriveMailKey, mailPublicKeyHex, sealMailIndex, sealMailPart } from '@stage-labs/client/mail/mailbox';
import { makeMailAccess, type Mailbox } from '../lib/mail.core';

const A: AccountRecord = { id: 'a', address: `0x${'aa'.repeat(20)}`, type: 'generated', dbDir: 'a', createdAt: 0 };
const B: AccountRecord = { ...A, id: 'b', address: `0x${'bb'.repeat(20)}`, dbDir: 'b' };
const ID = '1759430000000-9ef6fdd0-0635-4130-8b77-aaeae0f65158';
const SIGN: Record<string, SignMessage> = {
  a: () => Promise.resolve(`0x${'ab'.repeat(65)}`),
  b: () => Promise.resolve(`0x${'cd'.repeat(65)}`),
};

function deferred<T>() {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  return { promise, resolve, reject };
}

async function harness() {
  let active: AccountRecord | null = A;
  let selection = 0;
  const lookedUp: string[] = [];
  const signers: string[] = [];
  const requests: string[] = [];
  const names = new Map([[A.address, 'alice1'], [B.address, 'bobby1']]);
  const fixtures = new Map<string, { owner: string; publicKey: string; index: string; body: Uint8Array }>();
  for (const rec of [A, B]) {
    const label = names.get(rec.address);
    const sign = SIGN[rec.id];
    if (label === undefined || sign === undefined) throw new Error('missing fixture');
    const keys = await deriveMailKey(label, sign);
    const subject = `Only ${rec.id}`;
    const raw = `Subject: ${subject}\r\nContent-Type: multipart/mixed; boundary=m\r\n\r\n--m\r\nContent-Type: text/plain\r\n\r\nBody ${rec.id}\r\n--m\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="${rec.id}.txt"\r\n\r\nFile ${rec.id}\r\n--m--`;
    fixtures.set(label, {
      owner: rec.address, publicKey: mailPublicKeyHex(keys),
      index: Buffer.from(sealMailIndex(keys.publicKey, label, ID, {
        envelopeFrom: 'test@example.com', from: 'test@example.com', to: `${label}@st.box`, subject, date: '', messageId: '', size: raw.length,
      })).toString('base64'),
      body: sealMailPart(keys.publicKey, label, ID, 'body', new TextEncoder().encode(raw)),
    });
  }
  const pauses = new Map<string, ReturnType<typeof deferred<Response>>>();
  const started = new Map<string, ReturnType<typeof deferred<undefined>>>();
  const lookup = { run: (address: string): Promise<string | null> => Promise.resolve(names.get(address) ?? null) };
  const signing = { run: (rec: AccountRecord): Promise<SignMessage> => {
    signers.push(rec.id);
    const sign = SIGN[rec.id];
    if (sign === undefined) throw new Error('missing signer');
    return Promise.resolve(sign);
  } };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json() as { label: string } : null;
    const label = body?.label ?? url.searchParams.get('label') ?? '';
    const key = `${url.pathname}/${label}`;
    requests.push(key);
    started.get(key)?.resolve(undefined);
    const pause = pauses.get(key);
    if (pause !== undefined) return pause.promise;
    const fixture = fixtures.get(label);
    if (fixture === undefined) throw new Error('unexpected mailbox');
    if (url.pathname === '/mail/key') return Response.json(fixture);
    if (url.pathname === '/mail/challenge') return Response.json({ nonce: 'nonce', expiresAt: Date.now() + 60_000 });
    if (url.pathname === '/mail/session') return Response.json({ token: label, expiresAt: Date.now() + 900_000 });
    if (request.headers.get('authorization') !== `Bearer ${label}`) throw new Error('wrong session');
    if (url.pathname === '/mail/list') return Response.json({ mails: [{ id: ID, ts: 1759430000000, size: 10, index: fixture.index }] });
    if (url.pathname === '/mail/message') return new Response(fixture.body);
    throw new Error('unexpected request');
  });
  const access = makeMailAccess({
    activeAccount: () => Promise.resolve(active),
    ownedLabel: (address) => { lookedUp.push(address); return lookup.run(address); },
    signer: (rec) => signing.run(rec),
    selection: () => selection,
    baseUrl: () => 'https://mail.test',
  });
  return {
    access, lookedUp, signers, requests, names, lookup, signing,
    select(rec: AccountRecord | null) { active = rec; selection += 1; access.clear(); },
    boxes: () => access.mailboxes(selection),
    inbox: (boxes: Mailbox[]) => access.inbox(boxes, selection),
    pause(path: string) {
      const response = deferred<Response>();
      const start = deferred<undefined>();
      pauses.set(path, response);
      started.set(path, start);
      return { response, started: start.promise };
    },
  };
}

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;
const originalFetch = globalThis.fetch;
afterEach(() => {
  fetchSpy?.mockRestore();
  globalThis.fetch = originalFetch;
});

async function firstBox(h: Awaited<ReturnType<typeof harness>>): Promise<Mailbox> {
  const box = (await h.boxes())[0];
  if (box === undefined) throw new Error('no mailbox');
  return box;
}

describe('active account mail', () => {
  test('looks up only the selected account and returns no mailbox for logout or a nameless account', async () => {
    const h = await harness();
    expect((await h.boxes()).map((box) => box.accountId)).toEqual(['a']);
    h.select(B);
    expect((await h.boxes()).map((box) => box.accountId)).toEqual(['b']);
    h.names.delete(B.address);
    expect(await h.boxes()).toEqual([]);
    h.select(null);
    expect(await h.boxes()).toEqual([]);
    expect(h.lookedUp).toEqual([A.address, B.address, B.address]);
    expect(h.requests).toEqual([]);
  });

  test('drops a delayed name lookup even when the user switches back to the same account', async () => {
    const h = await harness();
    const lookup = deferred<string | null>();
    h.lookup.run = () => lookup.promise;
    const pending = h.boxes();
    const rejected = pending.catch((err: unknown) => err);
    await Promise.resolve(undefined);
    h.select(B);
    h.select(A);
    lookup.resolve('alice1');
    expect(await rejected).toEqual(new Error('The active account changed.'));
  });

  test('never reuses signers, keys or sessions after switch or logout and relogin', async () => {
    const h = await harness();
    const a = await firstBox(h);
    expect((await h.inbox([a])).entries[0]?.index?.subject).toBe('Only a');
    const mail = await h.access.mail(a, ID);
    expect(mail.subject).toBe('Only a');
    expect(mail.attachments[0]?.filename).toBe('a.txt');
    h.select(B);
    await expect(h.access.mail(a, ID)).rejects.toThrow('active account changed');
    expect((await h.inbox(await h.boxes())).entries[0]?.index?.subject).toBe('Only b');
    h.select(null);
    h.select(A);
    expect((await h.inbox(await h.boxes())).entries[0]?.index?.subject).toBe('Only a');
    expect(h.signers).toEqual(['a', 'b', 'a']);
    expect(h.requests.filter((path) => path === '/mail/session/alice1')).toHaveLength(2);
  });

  test.each(['list', 'message'])('drops a late %s response after switching accounts', async (path) => {
    const h = await harness();
    const a = await firstBox(h);
    await h.inbox([a]);
    const pause = h.pause(`/mail/${path}/alice1`);
    const pending = path === 'list' ? h.inbox([a]) : h.access.mail(a, ID);
    const rejected = pending.catch((err: unknown) => err);
    await pause.started;
    h.select(B);
    expect((await h.inbox(await h.boxes())).entries[0]?.index?.subject).toBe('Only b');
    pause.response.resolve(path === 'list' ? Response.json({ mails: [] }) : new Response('stale body'));
    expect(await rejected).toEqual(new Error('The active account changed.'));
    expect(h.requests.filter((request) => request === '/mail/session/alice1')).toHaveLength(1);
  });

  test('does not retry an old session failure after a switch', async () => {
    const h = await harness();
    const a = await firstBox(h);
    const pause = h.pause('/mail/list/alice1');
    const rejected = h.inbox([a]).catch((err: unknown) => err);
    await pause.started;
    h.select(B);
    pause.response.resolve(new Response('expired', { status: 401 }));
    expect(await rejected).toEqual(new Error('The active account changed.'));
    expect(h.requests.filter((path) => path === '/mail/session/alice1')).toHaveLength(1);
  });

  test('does not start mail requests with a signer that arrives after switching', async () => {
    const h = await harness();
    const signer = deferred<SignMessage>();
    const started = deferred<undefined>();
    h.signing.run = () => { started.resolve(undefined); return signer.promise; };
    const a = await firstBox(h);
    const rejected = h.access.mail(a, ID).catch((err: unknown) => err);
    await started.promise;
    h.select(B);
    const sign = SIGN.a;
    if (sign === undefined) throw new Error('missing signer');
    signer.resolve(sign);
    expect(await rejected).toEqual(new Error('The active account changed.'));
    expect(h.requests).toEqual([]);
  });
});
