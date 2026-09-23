import { useEffect, useState } from 'react';
import type { AccountRecord } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import {
  describeLinkResult, linkPasskeyForRecord, passkeyPlace, passkeysAvailable, type PasskeyPlace,
} from '../../lib/zerodev';
import { SettingsButtonRow, SettingsValueRow } from './rows';

const ELSEWHERE_HINT =
  'If your password manager syncs the passkey that secures this wallet, pick it here. This device can then make your recovery phrase the main key.';

export function usePasskeyPlace(rec: AccountRecord, epoch = 0): [PasskeyPlace | null, (next: PasskeyPlace) => void] {
  const [place, setPlace] = useState<PasskeyPlace | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPlace(null);
    void passkeyPlace(rec).then((value) => { if (!cancelled) setPlace(value); });
    return () => { cancelled = true; };
  }, [rec.address, rec.passkey?.authenticatorId, epoch]);
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
      capabilities.toast(text);
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
