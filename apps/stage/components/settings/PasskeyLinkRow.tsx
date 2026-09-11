import { useEffect, useState } from 'react';
import type { AccountRecord } from '../../lib/accounts';
import { flash } from '../../lib/toast';
import { describeLinkResult, linkPasskeyForRecord, passkeyLinked, passkeysAvailable } from '../../lib/zerodev';
import { SettingsNavRow } from './rows';

export function PasskeyLinkRow({ rec }: { rec: AccountRecord }): React.ReactElement | null {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void passkeyLinked(rec).then((value) => { if (!cancelled) setLinked(value); });
    return () => { cancelled = true; };
  }, [rec.address, rec.passkey?.authenticatorId]);

  if (rec.type !== 'smart' || !passkeysAvailable() || linked !== false) return null;

  const link = (): void => {
    if (busy) return;
    setBusy(true);
    void linkPasskeyForRecord(rec).then((result) => {
      setBusy(false);
      flash(describeLinkResult(result));
      if (result.ok) setLinked(true);
    });
  };

  return <SettingsNavRow label={busy ? 'Waiting for the passkey…' : 'Use my passkey on this device'} iconStart="key" onPress={link} />;
}
