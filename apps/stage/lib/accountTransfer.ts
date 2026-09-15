import { encodeAccountTransfer, type AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { canExportPrivateKey, type AccountRecord } from './accounts';
import {
  mnemonicRelation, restoreMnemonic, revealPrivateKey, revealRecoveryPhrase,
} from './zerodev/keyring';

type TransferKind = AccountTransfer['kind'];

const PHRASE_CONFLICT_MESSAGE =
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

export async function adoptPhrase(phrase: string): Promise<void> {
  const relation = await mnemonicRelation(phrase);
  if (relation === 'different') throw new Error(PHRASE_CONFLICT_MESSAGE);
  if (relation === 'none') await restoreMnemonic(phrase);
}
