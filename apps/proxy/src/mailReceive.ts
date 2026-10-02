import { hexToBytes } from 'viem';
import { bytesToBase64 } from '@stage-labs/client/text/base64';
import {
  MAIL_MAX_BYTES, isMailPublicKey, mailboxLabel, sealMailIndex, sealMailPart, type MailIndex,
} from '@stage-labs/client/mail/mailbox';
import type { ArchiveStub } from './historyStore.ts';
import type { MailChain } from './mailApi.ts';
import { readMailKey, storeMail, type MailKeyRecord } from './mailBox.ts';
import { readCappedBytes } from './ssrf.ts';

const HEADER_MAX_CHARS = 512;

export const REJECT_UNKNOWN = 'No such mailbox';
export const REJECT_INACTIVE = 'Mailbox not activated';
export const REJECT_TOO_LARGE = 'Message too large';
export const REJECT_FULL = 'Mailbox full';

export interface IncomingMail {
  readonly from: string;
  readonly to: string;
  readonly rawSize: number;
  readonly raw: ReadableStream<Uint8Array>;
  readonly headers: Headers;
  setReject(reason: string): void;
}

export interface ReceiveDeps {
  mailbox: (label: string) => ArchiveStub;
  chain: MailChain;
  now?: () => number;
}

interface Destination { label: string; stub: ArchiveStub; key: MailKeyRecord; publicKey: Uint8Array }

function newMailId(now: number): string {
  return `${String(now).padStart(13, '0')}-${crypto.randomUUID()}`;
}

function indexOf(message: IncomingMail, size: number): MailIndex {
  const header = (name: string): string => (message.headers.get(name) ?? '').slice(0, HEADER_MAX_CHARS);
  return {
    envelopeFrom: message.from.slice(0, HEADER_MAX_CHARS),
    from: header('from'),
    to: header('to'),
    subject: header('subject'),
    date: header('date'),
    messageId: header('message-id'),
    size,
  };
}

async function destination(message: IncomingMail, deps: ReceiveDeps): Promise<Destination | string> {
  const label = mailboxLabel(message.to);
  if (label === null) return REJECT_UNKNOWN;
  if (message.rawSize > MAIL_MAX_BYTES) return REJECT_TOO_LARGE;
  const owner = await deps.chain.owner(label);
  if (owner === null) return REJECT_UNKNOWN;
  const stub = deps.mailbox(label);
  const key = await readMailKey(stub);
  if (key === null || key.owner !== owner.toLowerCase() || !isMailPublicKey(key.publicKey)) return REJECT_INACTIVE;
  return { label, stub, key, publicKey: hexToBytes(key.publicKey) };
}

async function sealAndStore(message: IncomingMail, target: Destination, deps: ReceiveDeps): Promise<string | null> {
  const raw = await readCappedBytes(new Response(message.raw), MAIL_MAX_BYTES, 'reject');
  if (raw === null) return REJECT_TOO_LARGE;
  const { label, stub, key, publicKey } = target;
  const id = newMailId((deps.now ?? Date.now)());
  const index = bytesToBase64(sealMailIndex(publicKey, label, id, indexOf(message, raw.byteLength)));
  const sealed = sealMailPart(publicKey, label, id, 'body', raw);
  const status = await storeMail(stub, { owner: key.owner, publicKey: key.publicKey, id, index }, sealed);
  if (status === 507) return REJECT_FULL;
  if (status !== 204) throw new Error(`st.box mail could not be stored (${status})`);
  return null;
}

export async function receiveMail(message: IncomingMail, deps: ReceiveDeps): Promise<void> {
  const target = await destination(message, deps);
  const rejection = typeof target === 'string' ? target : await sealAndStore(message, target, deps);
  if (rejection !== null) message.setReject(rejection);
}
