import { decodeAccountTransfer, type AccountTransfer } from '@stage-labs/client/accounts/transfer';

export type ImportParse =
  | { ok: true; transfer: AccountTransfer }
  | { ok: false; error: string };

export const IMPORT_EMPTY = 'Scan the code from your other device, or paste a private key or recovery phrase.';
export const IMPORT_INVALID = 'That is not a Stage transfer code, private key, or recovery phrase.';

export function parseImportInput(text: string): ImportParse {
  if (text.trim().length === 0) return { ok: false, error: IMPORT_EMPTY };
  const transfer = decodeAccountTransfer(text);
  return transfer === null ? { ok: false, error: IMPORT_INVALID } : { ok: true, transfer };
}

export function transferWarning(kind: AccountTransfer['kind']): string {
  return kind === 'pk'
    ? 'This code contains the private key of this account. Anyone who scans it controls the account.'
    : 'This code contains your recovery phrase. Anyone who scans it controls every smart wallet account derived from it.';
}

export const TRANSFER_HOW_TO =
  'On the other device open Stage, go to Accounts, choose Import account and scan this code. Nothing is sent over the network: the code only exists on this screen.';
