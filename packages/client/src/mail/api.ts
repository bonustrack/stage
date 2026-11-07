import type { Hex } from 'viem';
import { z } from 'zod';
import { mailPath, type MailOp } from '../endpoints';
import { base64ToBytes } from '../text/base64';
import { parseOrThrow } from '../validate';
import { deriveMailKey, mailPublicKeyHex, mailRegisterMessage, mailSessionMessage, type MailKeyPair } from './mailbox';

export type SignMessage = (message: string) => Promise<Hex>;

export interface MailSession {
  proxyBase: string;
  label: string;
  token: string;
  expiresAt: number;
}

export interface MailListItem {
  id: string;
  ts: number;
  size: number;
  index: Uint8Array;
}

const KEY_STATUS_SCHEMA = z.object({ owner: z.string(), publicKey: z.string().nullable() });
const CHALLENGE_SCHEMA = z.object({ nonce: z.string(), expiresAt: z.number() });
const SESSION_SCHEMA = z.object({ token: z.string(), expiresAt: z.number() });
const LIST_SCHEMA = z.object({ mails: z.array(z.object({ id: z.string(), ts: z.number(), size: z.number(), index: z.string() })) });

async function mailCall(proxyBase: string, op: MailOp, query: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${proxyBase}${mailPath(op)}${query}`, init);
  if (res.ok) return res;
  throw new Error(`st.box mail ${op} failed (${res.status}): ${await res.text()}`);
}

async function postJson(proxyBase: string, op: MailOp, body: unknown): Promise<unknown> {
  const res = await mailCall(proxyBase, op, '', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sessionCall(session: MailSession, method: string, op: MailOp, id?: string): Promise<Response> {
  const query = `?label=${encodeURIComponent(session.label)}${id === undefined ? '' : `&id=${encodeURIComponent(id)}`}`;
  return mailCall(session.proxyBase, op, query, { method, headers: { authorization: `Bearer ${session.token}` } });
}

export async function registerMailKey(
  proxyBase: string,
  label: string,
  keys: MailKeyPair,
  signMessage: SignMessage,
  issuedAt = Date.now(),
): Promise<void> {
  const publicKey = mailPublicKeyHex(keys);
  const signature = await signMessage(mailRegisterMessage({ label, publicKey, issuedAt }));
  await postJson(proxyBase, 'key', { label, publicKey, issuedAt, signature });
}

export async function ensureMailKey(proxyBase: string, label: string, address: string, signMessage: SignMessage): Promise<boolean> {
  const res = await mailCall(proxyBase, 'key', `?label=${encodeURIComponent(label)}`, { method: 'GET' });
  const status = parseOrThrow('mail key status', KEY_STATUS_SCHEMA, await res.json());
  if (status.owner !== address.toLowerCase() || status.publicKey !== null) return false;
  await registerMailKey(proxyBase, label, await deriveMailKey(label, signMessage), signMessage);
  return true;
}

export async function openMailSession(proxyBase: string, label: string, signMessage: SignMessage): Promise<MailSession> {
  const challenge = parseOrThrow('mail challenge', CHALLENGE_SCHEMA, await postJson(proxyBase, 'challenge', { label }));
  const signature = await signMessage(mailSessionMessage({ label, ...challenge }));
  const session = parseOrThrow(
    'mail session',
    SESSION_SCHEMA,
    await postJson(proxyBase, 'session', { label, nonce: challenge.nonce, signature }),
  );
  return { proxyBase, label, ...session };
}

export async function listMail(session: MailSession): Promise<MailListItem[]> {
  const body = parseOrThrow('mail list', LIST_SCHEMA, await (await sessionCall(session, 'GET', 'list')).json());
  return body.mails.map((mail) => ({ ...mail, index: base64ToBytes(mail.index) }));
}

export async function fetchMail(session: MailSession, id: string): Promise<Uint8Array> {
  return new Uint8Array(await (await sessionCall(session, 'GET', 'message', id)).arrayBuffer());
}

export async function deleteMail(session: MailSession, id: string): Promise<void> {
  await sessionCall(session, 'DELETE', 'message', id);
}
