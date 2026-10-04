import { utf8ToBytes } from '@noble/hashes/utils';
import { bytesToHex, hexToBytes, type Hex } from 'viem';
import { stableOwnerSignature } from '../accounts/keys';
import { z } from 'zod';
import { stageNameOf, validateStageLabel } from '../identity/stageNames';
import { parseOrThrow } from '../validate';
import { deriveHpkeKeyPair, hpkeOpen, hpkeSeal, type HpkeKeyPair } from './hpke';

export const MAIL_DOMAIN = 'st.box';
export const MAIL_MAX_BYTES = 25 * 1024 * 1024;
const MAIL_INFO = utf8ToBytes('st.box mail v1');
const MAIL_ID = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PUBLIC_KEY = /^0x[0-9a-f]{64}$/;

const ROLE_LABELS: ReadonlySet<string> = new Set([
  'abuse', 'admin', 'administrator', 'hostmaster', 'mailer-daemon', 'no-reply', 'noreply', 'postmaster',
  'root', 'security', 'ssl-admin', 'ssladmin', 'support', 'webmaster',
]);

export type MailPart = 'index' | 'body';

export type MailKeyPair = HpkeKeyPair;

export interface MailIndex {
  envelopeFrom: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  size: number;
}

const MAIL_INDEX_SCHEMA = z.object({
  envelopeFrom: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  date: z.string(),
  messageId: z.string(),
  size: z.number().int().nonnegative(),
});

export function isMailboxLabel(label: string): boolean {
  return validateStageLabel(label) === null && !ROLE_LABELS.has(label);
}

export function mailboxLabel(address: string): string | null {
  const at = address.lastIndexOf('@');
  if (at < 1 || address.slice(at + 1).toLowerCase() !== MAIL_DOMAIN) return null;
  const label = (address.slice(0, at).split('+')[0] ?? '').toLowerCase();
  return isMailboxLabel(label) ? label : null;
}

export function mailAddressOf(label: string): string {
  return `${label}@${MAIL_DOMAIN}`;
}

export function isMailId(id: string): boolean {
  return MAIL_ID.test(id);
}

export function isMailPublicKey(value: string): value is Hex {
  return PUBLIC_KEY.test(value);
}

export function mailKeyMessage(label: string): string {
  return `st.box mail key v1 for ${stageNameOf(label)}`;
}

export interface MailKeyClaim {
  label: string;
  publicKey: Hex;
  issuedAt: number;
}

export function mailRegisterMessage(claim: MailKeyClaim): string {
  return [
    'Register st.box mail key',
    `name: ${stageNameOf(claim.label)}`,
    `key: ${claim.publicKey.toLowerCase()}`,
    `issued: ${claim.issuedAt}`,
  ].join('\n');
}

export interface MailChallenge {
  label: string;
  nonce: string;
  expiresAt: number;
}

export function mailSessionMessage(challenge: MailChallenge): string {
  return [
    'Sign in to st.box mail',
    `name: ${stageNameOf(challenge.label)}`,
    `nonce: ${challenge.nonce}`,
    `expires: ${challenge.expiresAt}`,
  ].join('\n');
}

export async function deriveMailKey(label: string, signOwnerMessage: (message: string) => Promise<Hex>): Promise<MailKeyPair> {
  return deriveHpkeKeyPair(hexToBytes(await stableOwnerSignature(mailKeyMessage(label), signOwnerMessage)));
}

export function mailPublicKeyHex(keys: MailKeyPair): Hex {
  return bytesToHex(keys.publicKey);
}

function mailAad(label: string, id: string, part: MailPart): Uint8Array {
  return utf8ToBytes(`${MAIL_DOMAIN}/${label}/${id}/${part}`);
}

export function sealMailPart(publicKey: Uint8Array, label: string, id: string, part: MailPart, plaintext: Uint8Array): Uint8Array {
  return hpkeSeal(publicKey, MAIL_INFO, mailAad(label, id, part), plaintext);
}

export function openMailPart(secretKey: Uint8Array, label: string, id: string, part: MailPart, sealed: Uint8Array): Uint8Array {
  return hpkeOpen(secretKey, MAIL_INFO, mailAad(label, id, part), sealed);
}

export function sealMailIndex(publicKey: Uint8Array, label: string, id: string, index: MailIndex): Uint8Array {
  return sealMailPart(publicKey, label, id, 'index', utf8ToBytes(JSON.stringify(index)));
}

export function openMailIndex(secretKey: Uint8Array, label: string, id: string, sealed: Uint8Array): MailIndex {
  const json: unknown = JSON.parse(new TextDecoder().decode(openMailPart(secretKey, label, id, 'index', sealed)));
  return parseOrThrow('mail index', MAIL_INDEX_SCHEMA, json);
}
