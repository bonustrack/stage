import { encodeAccountTransfer, type AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { canExportPrivateKey, type AccountRecord } from './accounts';
import { addPhrase, revealPrivateKey, revealRecoveryPhrase } from './zerodev/keyring';

type TransferKind = AccountTransfer['kind'];

export function transferKindFor(rec: AccountRecord): TransferKind | null {
  if (canExportPrivateKey(rec)) return 'pk';
  if (rec.type === 'smart') return 'phrase';
  return null;
}

export async function transferPayloadFor(rec: AccountRecord): Promise<string | null> {
  const kind = transferKindFor(rec);
  if (kind === 'pk') {
    const pk = await revealPrivateKey(rec.id);
    return pk ? encodeAccountTransfer({ kind: 'pk', pk }) : null;
  }
  if (kind === 'phrase') {
    const phrase = await revealRecoveryPhrase(rec);
    return phrase ? encodeAccountTransfer({ kind: 'phrase', phrase }) : null;
  }
  return null;
}

export function adoptPhrase(phrase: string): Promise<string> {
  return addPhrase(phrase);
}
