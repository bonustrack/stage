import type { Hex } from 'viem';
import { normalizePk } from './keys';
import { isValidMnemonic, normalizeMnemonic } from '../zerodev/derive';

export type AccountTransfer =
  | { kind: 'pk'; pk: Hex }
  | { kind: 'phrase'; phrase: string };

const PREFIX = 'stage-account:1:';
const PK_TAG = 'pk:';
const PHRASE_TAG = 'phrase:';
const RAW_PK = /^(0x)?[0-9a-fA-F]{64}$/;

export function encodeAccountTransfer(transfer: AccountTransfer): string {
  if (transfer.kind === 'pk') return `${PREFIX}${PK_TAG}${transfer.pk}`;
  const words = normalizeMnemonic(transfer.phrase).split(' ').join('-');
  return `${PREFIX}${PHRASE_TAG}${words}`;
}

function pkTransfer(text: string): AccountTransfer | null {
  try {
    return { kind: 'pk', pk: normalizePk(text) };
  } catch {
    return null;
  }
}

function phraseTransfer(text: string): AccountTransfer | null {
  const phrase = normalizeMnemonic(text.replace(/-/g, ' '));
  return isValidMnemonic(phrase) ? { kind: 'phrase', phrase } : null;
}

function decodeTagged(body: string): AccountTransfer | null {
  if (body.startsWith(PK_TAG)) return pkTransfer(body.slice(PK_TAG.length));
  if (body.startsWith(PHRASE_TAG)) return phraseTransfer(body.slice(PHRASE_TAG.length));
  return null;
}

export function decodeAccountTransfer(input: string): AccountTransfer | null {
  const text = input.trim();
  if (text.startsWith(PREFIX)) return decodeTagged(text.slice(PREFIX.length));
  if (RAW_PK.test(text)) return pkTransfer(text);
  return phraseTransfer(text);
}
