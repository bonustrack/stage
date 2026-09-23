
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { usePalette, useEffectiveColorScheme, type Palette } from '../../lib/theme';
import { ActionPage, WalletFooter, useFormPal, type FormPal } from '../../components/wallet/wallet.form';
import { GuardianEditor } from '../../components/wallet/recovery.parts';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { DEFAULT_RECOVERY_DELAY_SECONDS } from '@stage-labs/client/zerodev/recovery';
import { zerodevConfigured } from '../../lib/zerodev';
import { useSaveGuardians } from '../../components/wallet/recovery.actions';

type PagePal = Pick<Palette, 'link' | 'border'>;

function RecoveryNotice({ pal, p, onBack, message }: {
  pal: FormPal; p: PagePal; onBack: () => void; message: string;
}): React.ReactElement {
  return (
    <ActionPage title="Recovery" head={p.link} border={p.border} onBack={onBack}>
      <Text size="sm" color={pal.sub}>{message}</Text>
    </ActionPage>
  );
}

function RecoverySetupForm({ rec, pal, dark, p, delay, guardians, setGuardians, threshold, setThreshold, busy, onSave, onBack }: {
  rec: AccountRecord; pal: FormPal; dark: boolean; p: PagePal; delay: number;
  guardians: string[]; setGuardians: (g: string[]) => void;
  threshold: number; setThreshold: (n: number) => void;
  busy: boolean; onSave: () => Promise<void>; onBack: () => void;
}): React.ReactElement {
  return (
    <ActionPage title="Recovery" head={p.link} border={p.border} onBack={onBack}
      footer={(
        <WalletFooter border={p.border} dark={dark} onCancel={onBack}
          submitLabel={(rec.guardians ?? []).length ? 'Update guardians' : 'Save guardians'}
          onSubmit={() => void onSave()}
          submitDisabled={guardians.length === 0 || busy} submitLoading={busy}/>
      )}>
      <GuardianEditor pal={pal} dark={dark} guardians={guardians} threshold={threshold}
        delaySeconds={delay} onChange={setGuardians} onThreshold={setThreshold}/>
    </ActionPage>
  );
}

export default function WalletRecovery(): React.ReactElement {
  const router = useRouter();
  const { link, border } = usePalette();
  const p: PagePal = { link, border };
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = useFormPal();

  const [rec, setRec] = useState<AccountRecord | null>(null);
  const [guardians, setGuardians] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [busy, setBusy] = useState(false);

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
  const onSave = useSaveGuardians({ rec, guardians, threshold, delay, setBusy, router });
  const onBack = (): void => { router.back(); };

  if (!zerodevConfigured()) return <RecoveryNotice pal={pal} p={p} onBack={onBack} message="Smart wallet is not configured on this build."/>;
  if (!rec) return <RecoveryNotice pal={pal} p={p} onBack={onBack} message="Create a smart wallet first to set up guardian recovery."/>;

  return (
    <RecoverySetupForm rec={rec} pal={pal} dark={dark} p={p} delay={delay}
      guardians={guardians} setGuardians={setGuardians} threshold={threshold} setThreshold={setThreshold}
      busy={busy} onSave={onSave} onBack={onBack}/>
  );
}
