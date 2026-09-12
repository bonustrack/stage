import { useEffect, useState } from 'react';
import type { AccountRecord } from '../../lib/accounts';
import { flash } from '../../lib/toast';
import {
  describeLinkResult, linkPasskeyForRecord, passkeyPlace, passkeysAvailable, type PasskeyPlace,
} from '../../lib/zerodev';
import { SettingsButtonRow, SettingsValueRow } from './rows';

const ELSEWHERE_HINT =
  'This account is secured by a passkey created on another device. Pick that passkey when your password manager offers it.';

export function usePasskeyPlace(rec: AccountRecord): [PasskeyPlace | null, (next: PasskeyPlace) => void] {
  const [place, setPlace] = useState<PasskeyPlace | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPlace(null);
    void passkeyPlace(rec).then((value) => { if (!cancelled) setPlace(value); });
    return () => { cancelled = true; };
  }, [rec.address, rec.passkey?.authenticatorId]);
  return [place, setPlace];
}

export function PasskeyLinkRow({ rec, place, onLinked }: {
  rec: AccountRecord; place: PasskeyPlace | null; onLinked: () => void;
}): React.ReactElement | null {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (rec.type !== 'smart' || place === null || place === 'none' || place === 'unknown') return null;
  if (place === 'this-device') return <SettingsValueRow label="Passkey" value="On this device" />;
  if (!passkeysAvailable()) {
    return <SettingsValueRow label="Passkey" value="On another device" />;
  }

  const link = (): void => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    void linkPasskeyForRecord(rec).then((result) => {
      setBusy(false);
      const text = describeLinkResult(result);
      flash(text);
      setStatus(text);
      if (result.ok) onLinked();
    });
  };

  return (
    <SettingsButtonRow
      label={busy ? 'Waiting for the passkey…' : 'Use my passkey on this device'}
      description={status ?? ELSEWHERE_HINT}
      iconStart="key"
      onPress={link}
    />
  );
}
