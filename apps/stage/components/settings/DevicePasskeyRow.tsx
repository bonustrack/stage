import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import type { AccountRecord } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { passkeysAvailable } from '../../lib/zerodev';
import {
  completeDevicePasskey, createDevicePasskey, devicePasskeyInstalled, removeDevicePasskey, requestCodeFingerprint,
} from '../../lib/zerodev/devicePasskeyFlow';
import { recover } from '../../lib/errorPolicy';
import { Col } from '../layout';
import { AppModal } from '../AppModal';
import { CodeInput, CodePanel, StatusLine } from './DevicePasskeyCodes';
import { SettingsButtonRow, SettingsValueRow } from './rows';
import {
  DEVICE_PASSKEY_LABEL, DEVICE_SHEET_COPY, REMOVE_DEVICE_PASSKEY, devicePasskeyRowCopy, devicePasskeyState, devicePasskeyValue,
  fingerprintLine,
} from './DevicePasskeyRow.model';

type Status = { text: string; danger: boolean } | null;

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

function DeviceSheet({ rec, dark, code, onClose, onDone }: {
  rec: AccountRecord; dark: boolean; code: string | null; onClose: () => void; onDone: () => void;
}): React.ReactElement {
  const [approval, setApproval] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const fingerprint = code === null ? null : requestCodeFingerprint(code);
  const finish = (): void => {
    if (busy || approval === '') return;
    setBusy(true);
    setStatus({ text: DEVICE_SHEET_COPY.finishing, danger: false });
    void completeDevicePasskey(rec, approval).then((result) => {
      setBusy(false);
      if (!result.ok) { setStatus({ text: result.message, danger: true }); return; }
      capabilities.toast(DEVICE_SHEET_COPY.done);
      setApproval('');
      setStatus(null);
      onDone();
    });
  };
  return (
    <AppModal visible={code !== null} onClose={onClose}>
      <Col gap={14} align="center">
        <Title level={3}>{DEVICE_SHEET_COPY.title}</Title>
        <Text size="sm" role="secondary" textAlign="center">{DEVICE_SHEET_COPY.request}</Text>
        {code === null ? null : <CodePanel dark={dark} code={code} copyLabel="Request code" />}
        {fingerprint === null ? null : <Text size="sm" textAlign="center">{fingerprintLine(fingerprint)}</Text>}
        <Text size="sm" role="secondary" textAlign="center">{DEVICE_SHEET_COPY.approval}</Text>
        <CodeInput dark={dark} label={DEVICE_SHEET_COPY.approvalLabel} value={approval} onChange={setApproval} disabled={busy} />
        <StatusLine text={status?.text ?? null} danger={status?.danger ?? false} />
        <Button dark={dark} variant="solid" color="primary" size="lg" fullWidth pill disabled={busy || approval === ''}
          label={busy ? DEVICE_SHEET_COPY.finishing : DEVICE_SHEET_COPY.finish} onPress={finish} />
        <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth label="Close" onPress={onClose} />
      </Col>
    </AppModal>
  );
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

export function DevicePasskeyRow({ rec, dark }: { rec: AccountRecord; dark: boolean }): React.ReactElement {
  const [stored, setStored] = useState(rec.devicePasskey !== undefined);
  const [epoch, setEpoch] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const installed = useInstalled(rec, stored, epoch);
  const state = devicePasskeyState({ available: passkeysAvailable(), stored, installed });
  const refresh = (): void => { setCode(null); setEpoch((n) => n + 1); };

  if (state === 'active') return <ActiveRows rec={rec} onRemoved={() => { setStored(false); refresh(); }} />;
  if (state !== 'add' && state !== 'pending') return <SettingsValueRow label={DEVICE_PASSKEY_LABEL} value={devicePasskeyValue(state)} />;

  const open = (): void => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    void createDevicePasskey(rec).then((result) => {
      setBusy(false);
      if (!result.ok) { setStatus(result.message); capabilities.toast(result.message); return; }
      setStored(true);
      setCode(result.value);
    });
  };
  const copy = devicePasskeyRowCopy(state);
  return (
    <>
      <SettingsButtonRow label={busy ? 'Waiting for the passkey…' : copy.label} description={status ?? copy.description}
        iconStart="fingerPrint" onPress={open} />
      <DeviceSheet rec={rec} dark={dark} code={code} onClose={() => { setCode(null); }} onDone={refresh} />
    </>
  );
}
