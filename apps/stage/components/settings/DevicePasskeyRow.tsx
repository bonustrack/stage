import { useEffect, useState } from 'react';
import type { AccountRecord } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { passkeysAvailable } from '../../lib/zerodev';
import { devicePasskeyInstalled, enableDevicePasskey, removeDevicePasskey } from '../../lib/zerodev/devicePasskeyFlow';
import { recover } from '../../lib/errorPolicy';
import { SettingsButtonRow, SettingsValueRow } from './rows';
import {
  DEVICE_PASSKEY_DONE, DEVICE_PASSKEY_LABEL, ENABLE_PASSKEY_CONFIRM, ENABLE_PASSKEY_ROW, REMOVE_DEVICE_PASSKEY, devicePasskeyState,
  devicePasskeyValue,
} from './DevicePasskeyRow.model';

function useInstalled(rec: AccountRecord, stored: boolean, epoch: number): boolean | null | undefined {
  const [installed, setInstalled] = useState<boolean | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setInstalled(undefined);
    if (!stored) return;
    void devicePasskeyInstalled(rec).catch(recover('passkey.device', null)).then((value) => { if (alive) setInstalled(value); });
    return () => { alive = false; };
  }, [rec.address, stored, epoch]);
  return installed;
}

function ActiveRows({ rec, onRemoved }: { rec: AccountRecord; onRemoved: () => void }): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const remove = (): void => {
    if (busy) return;
    void capabilities.confirm({ ...REMOVE_DEVICE_PASSKEY, destructive: true }).then((yes) => {
      if (!yes) return;
      setBusy(true);
      void removeDevicePasskey(rec).then((result) => {
        setBusy(false);
        capabilities.toast(result.ok ? 'Passkey removed from this account.' : result.message);
        if (result.ok) onRemoved();
      });
    });
  };
  return (
    <>
      <SettingsValueRow label={DEVICE_PASSKEY_LABEL} value={devicePasskeyValue('active')} />
      <SettingsButtonRow label={busy ? 'Removing…' : REMOVE_DEVICE_PASSKEY.label} iconStart="trash" danger onPress={remove} />
    </>
  );
}

function EnableRow({ rec, onEnabled }: { rec: AccountRecord; onEnabled: () => void }): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const enable = (): void => {
    if (busy) return;
    void capabilities.confirm(ENABLE_PASSKEY_CONFIRM).then((yes) => {
      if (!yes) return;
      setBusy(true);
      setStatus(null);
      void enableDevicePasskey(rec).then((result) => {
        setBusy(false);
        capabilities.toast(result.ok ? DEVICE_PASSKEY_DONE : result.message);
        if (result.ok) onEnabled();
        else setStatus(result.message);
      });
    });
  };
  return (
    <SettingsButtonRow label={busy ? ENABLE_PASSKEY_ROW.busy : ENABLE_PASSKEY_ROW.label} description={status ?? ENABLE_PASSKEY_ROW.description}
      iconStart="fingerPrint" onPress={enable} />
  );
}

export function DevicePasskeyRow({ rec }: { rec: AccountRecord }): React.ReactElement {
  const [stored, setStored] = useState(rec.devicePasskey !== undefined);
  const [epoch, setEpoch] = useState(0);
  const installed = useInstalled(rec, stored, epoch);
  const state = devicePasskeyState({ available: passkeysAvailable(), stored, installed });
  const refresh = (nowStored: boolean): void => { setStored(nowStored); setEpoch((n) => n + 1); };
  if (state === 'active') return <ActiveRows rec={rec} onRemoved={() => { refresh(false); }} />;
  if (state === 'add') return <EnableRow rec={rec} onEnabled={() => { refresh(true); }} />;
  return <SettingsValueRow label={DEVICE_PASSKEY_LABEL} value={devicePasskeyValue(state)} />;
}
