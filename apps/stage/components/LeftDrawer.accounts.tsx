
import { useState } from 'react';
import { flash } from '../lib/toast';
import { AccountManager, shortAddress } from '../modules/messaging';
import { createSmartAccount, enablePasskeyForRecord, passkeysAvailable } from '../lib/zerodev';
import { DrawerRow } from './LeftDrawer.parts';

async function activate(id: string, onChanged: () => void): Promise<void> {
  try {
    await AccountManager.switch(id);
  } catch {
    flash('Switched account - XMTP messaging needs a reset (see Home)');
  }
  onChanged();
}

export function useDrawerAccountActions({ head, sub, dark, onChanged }: {
  head: string; sub: string; dark: boolean;
  onChanged: () => void;
}): { rows: React.ReactElement[] } {
  const [busy, setBusy] = useState(false);

  const onNew = (): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
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
      head={head} sub={sub} dark={dark} onPress={onNew}
    />,
  ];

  return { rows };
}
