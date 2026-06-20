/** @file Wallet → Recovery screen for setting up or approving smart-account guardian social recovery. */

import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@stage-labs/kit/text';
import { Col } from '../../components/layout';
import { usePalette, useEffectiveColorScheme, type Palette } from '../../lib/theme';
import { ActionPage, WalletFooter, useFormPal, type FormPal } from './wallet.form';
import { GuardianEditor, PendingRecoveryCard, ApprovalCard, formatDelay } from './recovery.parts';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { DEFAULT_RECOVERY_DELAY_SECONDS } from '@stage-labs/client/zerodev/recovery';
import { zerodevConfigured } from '../../lib/zerodev';
import { useRecoveryActions, type RecoveryActions } from './recovery.actions';

type PagePal = Pick<Palette, 'link' | 'bg' | 'border'>;

/** A bare ActionPage with a single explanatory line (used for unavailable states). */
function RecoveryNotice({ pal, p, onBack, message }: {
  pal: FormPal; p: PagePal; onBack: () => void; message: string;
}): React.ReactElement {
  return (
    <ActionPage title="Recovery" head={p.link} bg={p.bg} border={p.border} onBack={onBack}>
      <Text size="sm" color={pal.sub}>{message}</Text>
    </ActionPage>
  );
}

/** The guardian setup/edit form with its pinned footer. */
function RecoverySetupForm({ rec, pal, dark, p, params, delay, guardians, setGuardians, threshold, setThreshold, busy, actions, onBack }: {
  rec: AccountRecord; pal: FormPal; dark: boolean; p: PagePal;
  params: { newOwner?: string }; delay: number;
  guardians: string[]; setGuardians: (g: string[]) => void;
  threshold: number; setThreshold: (n: number) => void;
  busy: boolean; actions: RecoveryActions; onBack: () => void;
}): React.ReactElement {
  const pendingNewOwner = params.newOwner;
  return (
    <ActionPage title="Recovery" head={p.link} bg={p.bg} border={p.border} onBack={onBack}
      footer={(
        <WalletFooter border={p.border} dark={dark} onCancel={onBack}
          submitLabel={(rec.guardians ?? []).length ? 'Update guardians' : 'Save guardians'}
          onSubmit={() => void actions.onSave()}
          submitDisabled={guardians.length === 0 || busy} submitLoading={busy}/>
      )}>
      <Col gap={16}>
        {pendingNewOwner ? (
          <PendingRecoveryCard pal={pal} dark={dark} newOwner={pendingNewOwner}
            finalizeAfterLabel={`in up to ${formatDelay(delay)}`} onCancel={() => void actions.onCancel()} cancelling={busy}/>
        ) : null}
        <GuardianEditor pal={pal} dark={dark} guardians={guardians} threshold={threshold}
          delaySeconds={delay} onChange={setGuardians} onThreshold={setThreshold}/>
      </Col>
    </ActionPage>
  );
}

/** Screen for setting up or approving smart-account social recovery. */
export default function WalletRecovery(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; line?: string; wallet?: string; newOwner?: string }>();
  const mode = params.mode === 'approve' ? 'approve' : 'setup';
  const { link, bg, border } = usePalette();
  const p: PagePal = { link, bg, border };
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = useFormPal();

  const [rec, setRec] = useState<AccountRecord | null>(null);
  const [guardians, setGuardians] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    void (async () => {
      const active = await getActiveAccount();
      if (active?.type === 'smart') {
        setRec(active);
        setGuardians(active.guardians ?? []);
        setThreshold(active.guardianThreshold ?? 1);
      }
    })();
  }, []);

  const delay = rec?.guardianDelay ?? DEFAULT_RECOVERY_DELAY_SECONDS;
  const actions = useRecoveryActions({ rec, guardians, threshold, delay, params, setBusy, setApproving, setApproved, router });
  /** Pop back to the previous screen. */
  const onBack = (): void => { router.back(); };

  if (mode === 'approve') {
    return (
      <ActionPage title="Approve recovery" head={link} bg={bg} border={border} onBack={onBack}>
        <ApprovalCard pal={pal} dark={dark}
          wallet={params.wallet ?? ''} newOwner={params.newOwner ?? ''}
          onApprove={() => { void actions.onApprove(); }} approving={approving} approved={approved}/>
      </ActionPage>
    );
  }
  if (!zerodevConfigured()) return <RecoveryNotice pal={pal} p={p} onBack={onBack} message="Smart wallet is not configured on this build."/>;
  if (!rec) return <RecoveryNotice pal={pal} p={p} onBack={onBack} message="Create a smart wallet first to set up guardian recovery."/>;

  return (
    <RecoverySetupForm rec={rec} pal={pal} dark={dark} p={p} params={params} delay={delay}
      guardians={guardians} setGuardians={setGuardians} threshold={threshold} setThreshold={setThreshold}
      busy={busy} actions={actions} onBack={onBack}/>
  );
}
