/** useAccountsManager — state, effects + handlers for AccountsManager.
 *  Extracted for lint line-budget. Behaviour identical. */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAppKit } from '@reown/appkit-wagmi-react-native';
import { useAccount, useSignMessage } from 'wagmi';
import { usePeerProfiles } from '../lib/peerProfiles';
import { deleteAccount, switchToAccount, shortAddress } from '../modules/messaging';
import {
  loadAccounts, getActiveAccountId, addGeneratedAccount,
  importPrivateKey, addWalletConnectAccount, getPrivateKey, canExportPrivateKey,
  type AccountRecord,
} from '../lib/accounts';
import { setWcSign } from '../lib/wcSigner';
import { reloadApp } from './AccountsManager.helpers';

export function useAccountsManager(onSwitched?: () => void): {
  accounts: AccountRecord[]; activeId: string | null; busy: boolean;
  expanded: boolean; setExpanded: (fn: (e: boolean) => boolean) => void;
  addOpen: boolean; setAddOpen: (b: boolean) => void;
  importOpen: boolean; setImportOpen: (b: boolean) => void;
  importText: string; setImportText: (s: string) => void;
  importErr: string; setImportErr: (s: string) => void;
  manageId: string | null; setManageId: (id: string | null) => void;
  revealPk: string | null; setRevealPk: (s: string | null) => void;
  setWcPending: (b: boolean) => void; open: () => void;
  manageRec: AccountRecord | null; activeRec: AccountRecord | null; otherAccounts: AccountRecord[];
  onSwitch: (id: string) => Promise<void>; onGenerate: () => Promise<void>;
  onImport: () => Promise<void>; onExport: (id: string) => Promise<void>;
  onRemove: (rec: AccountRecord) => void;
} {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Collapsed by default — show only the active account as a row with a chevron;
   *  tapping expands the other accounts + "Add account". Collapses after a switch. */
  const [expanded, setExpanded] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErr, setImportErr] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);
  const [revealPk, setRevealPk] = useState<string | null>(null);

  /** WalletConnect (Reown AppKit) — open() shows the wallet picker; the effect
   *  below reacts once a wallet is connected. */
  const { open } = useAppKit();
  const { address: wcAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [wcPending, setWcPending] = useState(false);

  useEffect(() => {
    if (!wcPending || !isConnected || !wcAddress) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        setBusy(true);
        /** Register the sign fn xmtp.ts will call for the one-time installation
         *  challenge; signMessageAsync routes personal_sign to the wallet. */
        setWcSign(async (message: string) => signMessageAsync({ message, account: wcAddress }));
        const rec = await addWalletConnectAccount(wcAddress);
        /** Build + register this account's XMTP installation now (wallet prompts
         *  personal_sign once). After the reload it's registered → Client.build,
         *  no further prompts. */
        await switchToAccount(rec.id);
        if (!cancelled) { setWcPending(false); reloadApp(); }
      } catch (e) {
        if (!cancelled) {
          setWcPending(false);
          setBusy(false);
          Alert.alert('WalletConnect setup failed', (e as Error).message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [wcPending, isConnected, wcAddress, signMessageAsync]);

  const refresh = useCallback(async (): Promise<void> => {
    const [list, active] = await Promise.all([loadAccounts(), getActiveAccountId()]);
    setAccounts(list);
    setActiveId(active);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const manageRec = accounts.find(a => a.id === manageId) ?? null;
  const activeRec = accounts.find(a => a.id === activeId) ?? null;
  const otherAccounts = accounts.filter(a => a.id !== activeId);

  /** Resolve Snapshot display names for each account address (re-renders the
   *  rows once they load) so the list shows names, not just addresses. */
  usePeerProfiles(accounts.map(a => a.address));

  async function onSwitch(id: string): Promise<void> {
    if (id === activeId || busy) return;
    setBusy(true);
    try {
      /** In-place switch — no full app reload (which on the dev client re-downloads
       *  the whole JS bundle + flashes white). switchToAccount drops the cached
       *  client + global stream, builds the target account's client, points the
       *  (account-scoped) channels cache at the target account's store, and bumps
       *  the account epoch — which re-inits the channels list + any open
       *  conversation against the new inbox. We DON'T clear the cache: each
       *  account keeps its own rows, so the target account's channels render
       *  instantly from cache (instant 2nd open) and the stream revalidates in the
       *  background. Far snappier than reloadApp(). */
      await switchToAccount(id);
      await refresh();
      setExpanded(() => false);
      /** Let the host dismiss itself after a switch (the full-page /accounts
       *  switcher passes router.back). Other callers omit it → no-op. */
      onSwitched?.();
    } catch (e) {
      Alert.alert('Switch failed', (e as Error).message);
    } finally { setBusy(false); }
  }

  async function onGenerate(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await addGeneratedAccount();
      setAddOpen(false);
      reloadApp();
    } catch (e) {
      Alert.alert('Could not create account', (e as Error).message);
      setBusy(false);
    }
  }

  async function onImport(): Promise<void> {
    if (busy) return;
    setImportErr('');
    setBusy(true);
    try {
      await importPrivateKey(importText);
      setImportOpen(false);
      setImportText('');
      reloadApp();
    } catch (e) {
      setImportErr((e as Error).message);
      setBusy(false);
    }
  }

  async function onExport(id: string): Promise<void> {
    const pk = await getPrivateKey(id);
    if (!pk) { Alert.alert('No key', 'This account has no exportable private key.'); return; }
    setRevealPk(pk);
  }

  function onRemove(rec: AccountRecord): void {
    Alert.alert(
      'Remove account',
      `Remove ${rec.label ?? shortAddress(rec.address)}? Its local XMTP database will be deleted from this device.${
        canExportPrivateKey(rec) ? ' Export the private key first if you want to keep access.' : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
            void (async (): Promise<void> => {
              const wasActive = rec.id === activeId;
              await deleteAccount(rec.id);
              setManageId(null);
              if (wasActive) reloadApp();
              else await refresh();
            })();
          } },
      ],
    );
  }

  return {
    accounts, activeId, busy, expanded, setExpanded,
    addOpen, setAddOpen, importOpen, setImportOpen,
    importText, setImportText, importErr, setImportErr,
    manageId, setManageId, revealPk, setRevealPk, setWcPending, open,
    manageRec, activeRec, otherAccounts,
    onSwitch, onGenerate, onImport, onExport, onRemove,
  };
}
