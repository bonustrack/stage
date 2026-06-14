/** Account-action row for the LeftDrawer, split out to keep LeftDrawer.tsx under
 *  the line cap.
 *
 *    - "New account"  → mints a fresh mnemonic-derived ZeroDev smart account at
 *                       the next HD index (createSmartAccount) and switches the
 *                       active client to it.
 *
 *  Every account is a smart account derived from the single app mnemonic; there
 *  is no key/phrase import or external-wallet connect path. */

import { useState } from 'react';
import { flash } from '../lib/toast';
import { AccountManager, shortAddress } from '../modules/messaging';
import { createSmartAccount, passkeysAvailable, zerodevRpId } from '../lib/zerodev';
import { DrawerRow } from './LeftDrawer.parts';

/** Switch the active XMTP client to a freshly added account id. The wallet
 *  switch happens regardless (decoupled from XMTP), and switchToAccount bumps the
 *  account epoch even when its XMTP inbox fails to build - so HomeScreen re-inits
 *  onto the recoverable HomeError screen instead of a dead spinner. We surface a
 *  toast here so the user knows messaging needs a reset, but never block the
 *  wallet switch (don't re-throw). The drawer still closes via onChanged(). */
async function activate(id: string, onChanged: () => void): Promise<void> {
  try {
    await AccountManager.switch(id);
  } catch {
    flash('Switched account - XMTP messaging needs a reset (see Home)');
  }
  onChanged();
}

/** "New account" row. Returns the rows as a flat array (so the caller spreads
 *  them as DIRECT ListView children and the Kit ListView draws its inset divider
 *  under the row) and an empty modal slot (kept for the caller's render shape). */
export function useDrawerAccountActions({ head, sub, border, dark, onChanged }: {
  head: string; sub: string; border: string; dark: boolean;
  /** Called after the registry changes so the drawer re-reads the list/active. */
  onChanged: () => void;
}): { rows: React.ReactElement[]; modal: React.ReactElement | null } {
  const [busy, setBusy] = useState(false);

  const onNew = (): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const rec = await createSmartAccount(
          passkeysAvailable() ? { rpId: zerodevRpId(), userName: 'metro' } : {},
        );
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
