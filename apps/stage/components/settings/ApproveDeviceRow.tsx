import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import type { AccountRecord } from '../../lib/accounts';
import { kernelCustody } from '../../lib/zerodev';
import { approveDevicePasskey, readApprovalRequest } from '../../lib/zerodev/devicePasskeyFlow';
import { recover } from '../../lib/errorPolicy';
import { DANGER } from '../../lib/theme';
import { Col } from '../layout';
import { AppModal } from '../AppModal';
import { CodeInput, CodePanel, StatusLine } from './DevicePasskeyCodes';
import { SettingsButtonRow } from './rows';
import { APPROVE_SHEET_COPY, approveRowVisible, fingerprintLine } from './DevicePasskeyRow.model';

function useCustody(rec: AccountRecord): string | null {
  const [custody, setCustody] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void kernelCustody(rec.address as `0x${string}`).catch(recover('passkey.custody', null)).then((value) => { if (alive) setCustody(value); });
    return () => { alive = false; };
  }, [rec.address]);
  return custody;
}

function RequestStep({ rec, dark, onApproved }: {
  rec: AccountRecord; dark: boolean; onApproved: (code: string) => void;
}): React.ReactElement {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = input === '' ? null : readApprovalRequest(rec, input);
  const request = parsed?.ok === true ? parsed.value : null;
  const approve = (): void => {
    if (busy || request === null) return;
    setBusy(true);
    setError(null);
    void approveDevicePasskey(rec, request).then((result) => {
      setBusy(false);
      if (result.ok) onApproved(result.value);
      else setError(result.message);
    });
  };
  const parseError = parsed?.ok === false ? parsed.message : null;
  return (
    <>
      <Text size="sm" role="secondary" textAlign="center">{APPROVE_SHEET_COPY.intro}</Text>
      <CodeInput dark={dark} label={APPROVE_SHEET_COPY.requestLabel} value={input} onChange={setInput} disabled={busy} />
      {request === null ? null : <Text size="sm" textAlign="center">{fingerprintLine(request.fingerprint)}</Text>}
      <Text size="xs" color={DANGER} textAlign="center">{APPROVE_SHEET_COPY.warning}</Text>
      <StatusLine text={error ?? parseError} danger />
      <Button dark={dark} variant="solid" color="primary" size="lg" fullWidth pill disabled={busy || request === null}
        label={busy ? APPROVE_SHEET_COPY.approving : APPROVE_SHEET_COPY.approve} onPress={approve} />
    </>
  );
}

function ApproveSheet({ rec, dark, visible, onClose }: {
  rec: AccountRecord; dark: boolean; visible: boolean; onClose: () => void;
}): React.ReactElement {
  const [approval, setApproval] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const close = (): void => { setApproval(null); setRound((n) => n + 1); onClose(); };
  return (
    <AppModal visible={visible} onClose={close}>
      <Col gap={14} align="center">
        <Title level={3}>{APPROVE_SHEET_COPY.title}</Title>
        {approval === null ? <RequestStep key={round} rec={rec} dark={dark} onApproved={setApproval} /> : (
          <>
            <Text size="sm" role="secondary" textAlign="center">{APPROVE_SHEET_COPY.result}</Text>
            <CodePanel dark={dark} code={approval} copyLabel="Approval code" />
          </>
        )}
        <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth label={approval === null ? 'Cancel' : 'Done'} onPress={close} />
      </Col>
    </AppModal>
  );
}

export function ApproveDeviceRow({ rec, dark }: { rec: AccountRecord; dark: boolean }): React.ReactElement | null {
  const custody = useCustody(rec);
  const [open, setOpen] = useState(false);
  if (!approveRowVisible(custody)) return null;
  return (
    <>
      <SettingsButtonRow label={APPROVE_SHEET_COPY.title} description="Let another device with your recovery phrase approve transactions with its own passkey."
        iconStart="fingerPrint" onPress={() => { setOpen(true); }} />
      <ApproveSheet rec={rec} dark={dark} visible={open} onClose={() => { setOpen(false); }} />
    </>
  );
}
