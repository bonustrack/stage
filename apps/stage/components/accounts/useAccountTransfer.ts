import { useCallback, useState } from 'react';
import type { AccountRecord } from '../../lib/accounts';

export interface AccountTransferState {
  transferRec: AccountRecord | null;
  openTransfer: (rec: AccountRecord) => void;
  closeTransfer: () => void;
}

export function useAccountTransfer(): AccountTransferState {
  const [transferRec, setTransferRec] = useState<AccountRecord | null>(null);
  const openTransfer = useCallback((rec: AccountRecord) => { setTransferRec(rec); }, []);
  const closeTransfer = useCallback(() => { setTransferRec(null); }, []);
  return { transferRec, openTransfer, closeTransfer };
}
