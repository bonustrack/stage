import { useCallback, useState } from 'react';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import type { AccountRecord } from '../../lib/accounts';
import { importAccountTransfer } from '../../lib/accountTransfer';
import { markHistorySyncPending } from '../../lib/historySync';
import { AccountManager } from '../../modules/messaging';
import { reloadApp } from '../AccountsManager.helpers';

export interface AccountTransferState {
  transferRec: AccountRecord | null;
  openTransfer: (rec: AccountRecord) => void;
  closeTransfer: () => void;
  importOpen: boolean;
  openImport: () => void;
  closeImport: () => void;
  importing: boolean;
  importError: string | null;
  onImport: (transfer: AccountTransfer) => void;
}

export function useAccountTransfer(): AccountTransferState {
  const [transferRec, setTransferRec] = useState<AccountRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const openTransfer = useCallback((rec: AccountRecord) => { setTransferRec(rec); }, []);
  const closeTransfer = useCallback(() => { setTransferRec(null); }, []);
  const openImport = useCallback(() => { setImportError(null); setImportOpen(true); }, []);
  const closeImport = useCallback(() => { if (!importing) setImportOpen(false); }, [importing]);

  const onImport = useCallback((transfer: AccountTransfer) => {
    setImporting(true);
    setImportError(null);
    void (async (): Promise<void> => {
      try {
        const rec = await importAccountTransfer(transfer);
        await markHistorySyncPending(rec.id);
        await AccountManager.switch(rec.id);
        reloadApp();
      } catch (e) {
        setImportError(e instanceof Error ? e.message : String(e));
        setImporting(false);
      }
    })();
  }, []);

  return {
    transferRec, openTransfer, closeTransfer,
    importOpen, openImport, closeImport, importing, importError, onImport,
  };
}
