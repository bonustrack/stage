import { encodeAccountTransfer, type AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { addPrivateKeyAccount, canExportPrivateKey, type AccountRecord } from './accounts';
import { createSmartAccount } from './zerodev';
import {
  mnemonicRelation, restoreMnemonic, revealPrivateKey, revealRecoveryPhrase,
} from './zerodev/keyring';

export type TransferKind = AccountTransfer['kind'];

export const PHRASE_CONFLICT_MESSAGE =
  'This device already holds a different recovery phrase. Remove its smart wallet accounts before importing another phrase.';

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
    const phrase = await revealRecoveryPhrase();
    return phrase ? encodeAccountTransfer({ kind: 'phrase', phrase }) : null;
  }
  return null;
}

export async function importAccountTransfer(transfer: AccountTransfer): Promise<AccountRecord> {
  if (transfer.kind === 'pk') return addPrivateKeyAccount(transfer.pk);
  const relation = await mnemonicRelation(transfer.phrase);
  if (relation === 'different') throw new Error(PHRASE_CONFLICT_MESSAGE);
  if (relation === 'none') await restoreMnemonic(transfer.phrase);
  return createSmartAccount();
}
