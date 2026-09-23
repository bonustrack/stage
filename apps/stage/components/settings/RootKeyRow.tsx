import { useEffect, useState } from 'react';
import type { AccountRecord } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { rootKeyMigrationFor } from '../../lib/zerodev/rootKey';
import { recover } from '../../lib/errorPolicy';
import { SettingsButtonRow } from './rows';
import { migrateRootKey } from './rootKeyActions';
import { ROOT_KEY_CONFIRM, ROOT_KEY_LABEL, rootKeyActionable, rootKeyDescription, type RootKeyMigrationState } from './RootKeyRow.model';

function useMigration(rec: AccountRecord, epoch: number): RootKeyMigrationState {
  const [state, setState] = useState<RootKeyMigrationState>('loading');
  useEffect(() => {
    let alive = true;
    setState('loading');
    void rootKeyMigrationFor(rec).catch(recover('rootkey.plan', 'unknown' as const)).then((value) => { if (alive) setState(value); });
    return () => { alive = false; };
  }, [rec.address, rec.passkey?.authenticatorId, epoch]);
  return state;
}

export function RootKeyRow({ rec, epoch, onChanged }: { rec: AccountRecord; epoch: number; onChanged: () => void }): React.ReactElement | null {
  const state = useMigration(rec, epoch);
  const [busy, setBusy] = useState(false);
  if (state === 'not-needed') return null;
  const run = (): void => {
    if (busy) return;
    if (!rootKeyActionable(state)) { capabilities.toast(rootKeyDescription(state)); return; }
    void capabilities.confirm(ROOT_KEY_CONFIRM).then(async (yes) => {
      if (!yes) return;
      setBusy(true);
      try {
        if (await migrateRootKey(rec)) onChanged();
      } finally {
        setBusy(false);
      }
    });
  };
  return (
    <SettingsButtonRow label={busy ? 'Waiting for approval…' : ROOT_KEY_LABEL} description={rootKeyDescription(state)} iconStart="key" onPress={run} />
  );
}
