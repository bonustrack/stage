/**
 * @file useAccountsManager hook owning the state, effects, and handlers for the
 * AccountsManager Settings section (switch, add, remove, export), where every
 * account is a mnemonic-derived ZeroDev smart account.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { usePeerProfiles } from '../lib/peerProfiles';
import { deleteAccount, AccountManager, shortAddress } from '../modules/messaging';
import {
  loadAccounts, getActiveAccountId, getPrivateKey, canExportPrivateKey,
  type AccountRecord,
} from '../lib/accounts';
import { createSmartAccount, enablePasskeyForRecord, passkeysAvailable } from '../lib/zerodev';
import { reloadApp } from './AccountsManager.helpers';

/** Hook providing the accounts list, active id, and switch/add/remove/export handlers for AccountsManager. */
export function useAccountsManager(onSwitched?: () => void): {
  accounts: AccountRecord[]; activeId: string | null; busy: boolean;
  expanded: boolean; setExpanded: (fn: (e: boolean) => boolean) => void;
  manageId: string | null; setManageId: (id: string | null) => void;
  revealPk: string | null; setRevealPk: (s: string | null) => void;
  manageRec: AccountRecord | null; activeRec: AccountRecord | null; otherAccounts: AccountRecord[];
  onSwitch: (id: string) => Promise<void>; onAdd: () => Promise<void>;
  onExport: (id: string) => Promise<void>;
  onRemove: (rec: AccountRecord) => void;
} {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Collapsed by default — show only the active account as a row with a chevron; tapping expands the other accounts + "Add account". Collapses after a switch. */
  const [expanded, setExpanded] = useState(false);

  const [manageId, setManageId] = useState<string | null>(null);
  const [revealPk, setRevealPk] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const [list, active] = await Promise.all([loadAccounts(), getActiveAccountId()]);
    setAccounts(list);
    setActiveId(active);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const manageRec = accounts.find(a => a.id === manageId) ?? null;
  const activeRec = accounts.find(a => a.id === activeId) ?? null;
  const otherAccounts = accounts.filter(a => a.id !== activeId);

  /** Resolve Snapshot display names for each account address (re-renders the rows once they load) so the list shows names, not just addresses. */
  usePeerProfiles(accounts.map(a => a.address));

  /** Handle the Switch. */
  async function onSwitch(id: string): Promise<void> {
    if (id === activeId || busy) return;
    setBusy(true);
    try {
      /**
       * In-place switch — no full app reload (which on the dev client re-downloads
       *  the whole JS bundle + flashes white). switchToAccount drops the cached
       *  client + global stream, builds the target account's client, points the
       *  (account-scoped) channels cache at the target account's store, and bumps
       *  the account epoch — which re-inits the channels list + any open
       *  conversation against the new inbox. We DON'T clear the cache: each
       *  account keeps its own rows, so the target account's channels render
       *  instantly from cache (instant 2nd open) and the stream revalidates in the
       *  background. Far snappier than reloadApp().
       */
      await AccountManager.switch(id);
      await refresh();
      setExpanded(() => false);
      /** Let the host dismiss itself after a switch (the full-page /accounts switcher passes router.back). Other callers omit it → no-op. */
      onSwitched?.();
    } catch (e) {
      Alert.alert('Switch failed', (e as Error).message);
    } finally { setBusy(false); }
  }

  /** Add a new account = mint the next HD-index ZeroDev smart account off the single app mnemonic, make it active, and reload so XMTP re-inits against the new inbox. */
  async function onAdd(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      // Create ECDSA-owner (deployable) account, install the passkey (WebAuthn CREATE
      // + deploy-and-swap sudo), THEN register its XMTP inbox. Passkey-BEFORE-switch
      // makes the inbox registration sign with the passkey (the key never signs the
      // XMTP identity). WebAuthn CREATE needs no prior credential, so it can't pop
      // the empty "No available sign-in" picker.
      const rec = await createSmartAccount();
      if (passkeysAvailable()) {
        const res = await enablePasskeyForRecord(rec);
        if (!res.ok && res.reason !== 'already') {
          throw new Error(res.message ?? 'Could not set up the passkey for this account.');
        }
      }
      await AccountManager.switch(rec.id);
      reloadApp();
    } catch (e) {
      Alert.alert('Could not create account', (e as Error).message);
      setBusy(false);
    }
  }

  /** Handle the Export. */
  async function onExport(id: string): Promise<void> {
    const pk = await getPrivateKey(id);
    if (!pk) { Alert.alert('No key', 'This account has no exportable private key.'); return; }
    setRevealPk(pk);
  }

  /** Handle the Remove. */
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
    manageId, setManageId, revealPk, setRevealPk,
    manageRec, activeRec, otherAccounts,
    onSwitch, onAdd, onExport, onRemove,
  };
}
