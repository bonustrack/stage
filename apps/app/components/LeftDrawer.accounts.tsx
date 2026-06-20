/** @file LeftDrawer "New account" action row that mints a fresh mnemonic-derived ZeroDev smart account at the next HD index and switches the active client to it. */

import { useState } from 'react';
import { flash } from '../lib/toast';
import { AccountManager, shortAddress } from '../modules/messaging';
import { createSmartAccount, enablePasskeyForRecord, passkeysAvailable } from '../lib/zerodev';
import { DrawerRow } from './LeftDrawer.parts';

/** Switch the active XMTP client to a freshly added account; the wallet switch always happens (toast on XMTP inbox failure, never re-throw, drawer still closes via onChanged). */
async function activate(id: string, onChanged: () => void): Promise<void> {
  try {
    await AccountManager.switch(id);
  } catch {
    flash('Switched account - XMTP messaging needs a reset (see Home)');
  }
  onChanged();
}

/** "New account" row. Returns the rows as a flat array (so the caller spreads them as DIRECT ListView children and the Kit ListView draws its inset divider under the row) and an empty modal slot (kept for the caller's render shape). */
export function useDrawerAccountActions({ head, sub, border, dark, onChanged }: {
  head: string; sub: string; border: string; dark: boolean;
  /** Called after the registry changes so the drawer re-reads the list/active. */
  onChanged: () => void;
}): { rows: React.ReactElement[]; modal: React.ReactElement | null } {
  const [busy, setBusy] = useState(false);

  /** Handle the New. */
  const onNew = (): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        /** Create the ECDSA-owner account, install the passkey, THEN register its XMTP inbox so registration signs with the passkey not the ECDSA key (WebAuthn CREATE needs no prior credential). */
        const rec = await createSmartAccount();
        if (passkeysAvailable()) {
          const res = await enablePasskeyForRecord(rec);
          if (!res.ok && res.reason !== 'already') {
            flash(res.message ?? 'Account created, but the passkey could not be set up');
          }
        }
        await activate(rec.id, onChanged);
        flash(`New account ${shortAddress(rec.address)} created`);
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Could not create account');
      } finally {
        setBusy(false);
      }
    })();
  };

  const rows = [
    <DrawerRow
      key="new-account" rowKey="new-account" icon="userAdd" label="New account"
      head={head} sub={sub} border={border} dark={dark} onPress={onNew}
    />,
  ];

  return { rows, modal: null };
}
