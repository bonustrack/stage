import { bytesToHex, sha256, stringToBytes } from 'viem';
import { isMailId } from '@stage-labs/client/mail/mailbox';
import { putChunks, readChunks, storedChunkKeys, type ArchiveNamespace, type ArchiveStub } from './historyStore.ts';

const MAILBOX_URL = 'https://mailbox/';
export const MAILBOX_MAX_BYTES = 512 * 1024 * 1024;
export const NONCE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_OPEN = 20;
const KEY = 'key';
const USAGE = 'usage';
const NONCE = /^[0-9a-f]{32}$/;
const TOKEN = /^[0-9a-f]{64}$/;

export interface MailStorage {
  get(keys: string[]): Promise<Map<string, unknown>>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
  list(options: { prefix: string }): Promise<Map<string, unknown>>;
  deleteAll(): Promise<void>;
}

export interface MailKeyRecord {
  publicKey: string;
  owner: string;
  issuedAt: number;
}

interface MailRecord {
  id: string;
  ts: number;
  owner: string;
  size: number;
  index: string;
}

type Fields = Record<string, unknown>;
type Op = (storage: MailStorage, body: Fields, now: number) => Promise<Response>;

const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const done = (status: number): Response => new Response(null, { status });
const mailKey = (id: string): string => `mail:${id}`;
const bodyPrefix = (id: string): string => `body:${id}:`;
const nonceKey = (nonce: string): string => `nonce:${nonce}`;
const sessionKey = (token: string): string => `session:${sha256(stringToBytes(token)).slice(2)}`;
const randomHex = (bytes: number): string => bytesToHex(crypto.getRandomValues(new Uint8Array(bytes))).slice(2);

function keyRecord(value: unknown): MailKeyRecord | null {
  if (!isFields(value) || typeof value.issuedAt !== 'number') return null;
  const { publicKey, owner } = value;
  if (typeof publicKey !== 'string' || typeof owner !== 'string') return null;
  return { publicKey, owner, issuedAt: value.issuedAt };
}

function mailRecord(value: unknown): MailRecord | null {
  if (!isFields(value) || typeof value.ts !== 'number' || typeof value.size !== 'number') return null;
  const { id, owner, index } = value;
  if (typeof id !== 'string' || typeof owner !== 'string' || typeof index !== 'string') return null;
  return { id, ts: value.ts, owner, size: value.size, index };
}

async function getOne(storage: MailStorage, key: string): Promise<unknown> {
  return (await storage.get([key])).get(key);
}

async function ownedMail(storage: MailStorage, body: Fields): Promise<MailRecord | null> {
  const id = text(body.id);
  if (!isMailId(id)) return null;
  const record = mailRecord(await getOne(storage, mailKey(id)));
  return record !== null && record.owner === text(body.owner) ? record : null;
}

function expiryOf(value: unknown): number {
  const expiresAt = isFields(value) ? value.expiresAt : value;
  return typeof expiresAt === 'number' ? expiresAt : 0;
}

async function prune(storage: MailStorage, prefix: string, now: number, keep: number): Promise<void> {
  const drop = [...(await storage.list({ prefix })).entries()]
    .map(([key, value]) => ({ key, expiresAt: expiryOf(value) }))
    .sort((a, b) => b.expiresAt - a.expiresAt)
    .filter((entry, rank) => entry.expiresAt < now || rank >= keep)
    .map(({ key }) => key);
  if (drop.length > 0) await storage.delete(drop);
}

const register: Op = async (storage, body) => {
  const next = keyRecord(body);
  if (next === null) return done(400);
  const current = keyRecord(await getOne(storage, KEY));
  const sameOwner = current !== null && current.owner === next.owner;
  if (sameOwner && next.issuedAt <= current.issuedAt) return done(409);
  if (current !== null && !sameOwner) await storage.deleteAll();
  await storage.put({ [KEY]: next });
  return done(204);
};

const readKey: Op = async (storage) => {
  const current = keyRecord(await getOne(storage, KEY));
  return current === null ? done(404) : Response.json(current);
};

const challenge: Op = async (storage, _body, now) => {
  await prune(storage, 'nonce:', now, MAX_OPEN - 1);
  const nonce = randomHex(16);
  const expiresAt = now + NONCE_TTL_MS;
  await storage.put({ [nonceKey(nonce)]: expiresAt });
  return Response.json({ nonce, expiresAt });
};

const consume: Op = async (storage, body, now) => {
  const nonce = text(body.nonce);
  if (!NONCE.test(nonce)) return done(401);
  const expiresAt = await getOne(storage, nonceKey(nonce));
  if (typeof expiresAt !== 'number') return done(401);
  await storage.delete([nonceKey(nonce)]);
  return expiresAt < now ? done(401) : Response.json({ expiresAt });
};

const openSession: Op = async (storage, body, now) => {
  const owner = text(body.owner);
  if (owner === '') return done(400);
  await prune(storage, 'session:', now, MAX_OPEN - 1);
  const token = randomHex(32);
  const expiresAt = now + SESSION_TTL_MS;
  await storage.put({ [sessionKey(token)]: { owner, expiresAt } });
  return Response.json({ token, expiresAt });
};

const authorize: Op = async (storage, body, now) => {
  const token = text(body.token);
  if (!TOKEN.test(token)) return done(401);
  const session = await getOne(storage, sessionKey(token));
  if (!isFields(session) || typeof session.owner !== 'string' || typeof session.expiresAt !== 'number') return done(401);
  return session.expiresAt < now ? done(401) : Response.json({ owner: session.owner });
};

const list: Op = async (storage, body) => {
  const owner = text(body.owner);
  const mails = [...(await storage.list({ prefix: 'mail:' })).values()]
    .map(mailRecord)
    .filter((mail): mail is MailRecord => mail !== null && mail.owner === owner)
    .map(({ id, ts, size, index }) => ({ id, ts, size, index }));
  return Response.json({ mails });
};

const read: Op = async (storage, body) => {
  const mail = await ownedMail(storage, body);
  const bytes = mail === null ? null : await readChunks(storage, bodyPrefix(mail.id));
  return bytes === null ? done(404) : new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } });
};

const remove: Op = async (storage, body) => {
  const mail = await ownedMail(storage, body);
  if (mail === null) return done(404);
  const usage = await getOne(storage, USAGE);
  await storage.delete([mailKey(mail.id), ...(await storedChunkKeys(storage, bodyPrefix(mail.id)))]);
  await storage.put({ [USAGE]: Math.max(0, (typeof usage === 'number' ? usage : 0) - mail.size) });
  return done(204);
};

const close: Op = async (storage) => {
  await storage.deleteAll();
  return done(204);
};

const OPS: Record<string, Op> = { register, key: readKey, challenge, consume, session: openSession, auth: authorize, list, read, delete: remove, close };

async function store(request: Request, storage: MailStorage): Promise<Response> {
  const owner = request.headers.get('x-mail-owner') ?? '';
  const id = request.headers.get('x-mail-id') ?? '';
  const current = keyRecord(await getOne(storage, KEY));
  if (current === null || current.owner !== owner || current.publicKey !== request.headers.get('x-mail-key') || !isMailId(id)) {
    return done(409);
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  const used = await getOne(storage, USAGE);
  const usage = (typeof used === 'number' ? used : 0) + bytes.byteLength;
  if (usage > MAILBOX_MAX_BYTES) return done(507);
  await putChunks(storage, bytes, bodyPrefix(id));
  const record: MailRecord = { id, ts: Number(id.slice(0, 13)), owner, size: bytes.byteLength, index: request.headers.get('x-mail-index') ?? '' };
  await storage.put({ [mailKey(id)]: record, [USAGE]: usage });
  return done(204);
}

export async function mailboxFetch(request: Request, storage: MailStorage, now = Date.now()): Promise<Response> {
  const op = new URL(request.url).pathname.slice(1);
  if (op === 'store') return store(request, storage);
  const handler = OPS[op];
  if (handler === undefined) return done(404);
  const body: unknown = await request.json().catch(() => null);
  return handler(storage, isFields(body) ? body : {}, now);
}

export function mailboxStub<Id>(ns: ArchiveNamespace<Id>, label: string): ArchiveStub {
  return ns.get(ns.idFromName(label));
}

export function mailboxCall(stub: ArchiveStub, op: string, body: Fields = {}): Promise<Response> {
  return stub.fetch(`${MAILBOX_URL}${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export interface SealedMail {
  owner: string;
  publicKey: string;
  id: string;
  index: string;
}

export async function storeMail(stub: ArchiveStub, mail: SealedMail, sealed: Uint8Array): Promise<number> {
  const headers = { 'x-mail-owner': mail.owner, 'x-mail-key': mail.publicKey, 'x-mail-id': mail.id, 'x-mail-index': mail.index };
  return (await stub.fetch(`${MAILBOX_URL}store`, { method: 'POST', headers, body: sealed })).status;
}

export async function saveMailKey(stub: ArchiveStub, key: MailKeyRecord): Promise<number> {
  return (await mailboxCall(stub, 'register', { ...key })).status;
}

export async function readMailKey(stub: ArchiveStub): Promise<MailKeyRecord | null> {
  const res = await mailboxCall(stub, 'key');
  return res.ok ? keyRecord(await res.json()) : null;
}

export class MailBoxes {
  private readonly storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  fetch(request: Request): Promise<Response> {
    return mailboxFetch(request, this.storage);
  }
}
