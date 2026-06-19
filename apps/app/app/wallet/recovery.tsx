/** @file Wallet → Recovery screen for setting up or approving smart-account guardian social recovery. */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@metro-labs/kit/text';
import { Col } from '../../components/layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { ActionPage, WalletFooter, useFormPal } from './wallet.form';
import { GuardianEditor, PendingRecoveryCard, ApprovalCard, formatDelay } from './recovery.parts';
import { resolveEnsName } from '../../lib/ens';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { DEFAULT_RECOVERY_DELAY_SECONDS } from '@stage-labs/client/zerodev/recovery';
import {
  zerodevConfigured, installGuardians, updateGuardians, cancelRecovery,
  signRecoveryApproval, sendRecoveryApproval, smartOwnerSigner,
} from '../../lib/zerodev';
import type { Address } from 'viem';

/** Screen for setting up or approving smart-account social recovery. */
// eslint-disable-next-line max-lines-per-function, complexity -- TODO(chaitu): refactor to satisfy function-size limits + refactor (complexity 13)
export default function WalletRecovery(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; line?: string; wallet?: string; newOwner?: string }>();
  const mode = params.mode === 'approve' ? 'approve' : 'setup';
  const { link: head, bg, border } = usePalette();
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

  /** Save guardians: install on first config, else reconfigure (native renew). */
  const onSave = useCallback(async (): Promise<void> => {
    if (!rec) return;
    setBusy(true);
    try {
      // Resolve any ENS names left as raw entries (addresses pass through).
      const resolved: string[] = [];
      for (const g of guardians) {
        if (g.startsWith('0x')) { resolved.push(g); continue; }
        const a = await resolveEnsName(g);
        if (!a) throw new Error(`Could not resolve ${g}`);
        resolved.push(a.toLowerCase());
      }
      const already = (rec.guardians ?? []).length > 0;
      if (already) await updateGuardians(rec, resolved, threshold, delay);
      else await installGuardians(rec, resolved, threshold, delay);
      Alert.alert('Guardians saved', 'Your recovery guardians are set.');
      router.back();
    } catch (e) {
      Alert.alert('Could not save guardians', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [rec, guardians, threshold, delay, router]);

  /** Owner cancel of a pending rotation (native veto). The pending newOwner comes from the deep link (the recovery request) — we cancel that specific rotation. */
  const onCancel = useCallback(async (): Promise<void> => {
    if (!rec || !params.newOwner) return;
    setBusy(true);
    try {
      // nonce 0 = the recovery validator's first proposal slot for this account.
      await cancelRecovery(rec, params.newOwner as Address, 0n);
      Alert.alert('Recovery cancelled', 'The pending recovery was cancelled.');
      router.back();
    } catch (e) {
      Alert.alert('Could not cancel', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [rec, params.newOwner, router]);

  /** Guardian approves an inbound request: sign offchain + post back to the line. */
  const onApprove = useCallback(async (): Promise<void> => {
    if (!params.line || !params.wallet || !params.newOwner) return;
    const active = await getActiveAccount();
    if (active?.type !== 'smart' || active.hdIndex == null) {
      Alert.alert('No smart wallet', 'You need a smart wallet to approve a recovery.');
      return;
    }
    setApproving(true);
    try {
      const signer = await smartOwnerSigner(active.hdIndex);
      const signature = await signRecoveryApproval(
        signer, params.wallet as Address, params.newOwner as Address, 0n,
      );
      await sendRecoveryApproval(params.line, {
        wallet: params.wallet, newOwner: params.newOwner,
        guardian: signer.address.toLowerCase(), signature,
      });
      setApproved(true);
      Alert.alert('Approved', 'Your approval was sent to the recovery conversation.');
    } catch (e) {
      Alert.alert('Could not approve', e instanceof Error ? e.message : String(e));
    } finally {
      setApproving(false);
    }
  }, [params.line, params.wallet, params.newOwner]);

  if (mode === 'approve') {
    return (
      <ActionPage title="Approve recovery" head={head} bg={bg} border={border} onBack={() => { router.back(); }}>
        <ApprovalCard pal={pal} dark={dark}
          wallet={params.wallet ?? ''} newOwner={params.newOwner ?? ''}
          onApprove={() => { void onApprove(); }} approving={approving} approved={approved}/>
      </ActionPage>
    );
  }

  if (!zerodevConfigured()) {
    return (
      <ActionPage title="Recovery" head={head} bg={bg} border={border} onBack={() => { router.back(); }}>
        <Text size="sm" color={pal.sub}>Smart wallet is not configured on this build.</Text>
      </ActionPage>
    );
  }
  if (!rec) {
    return (
      <ActionPage title="Recovery" head={head} bg={bg} border={border} onBack={() => { router.back(); }}>
        <Text size="sm" color={pal.sub}>Create a smart wallet first to set up guardian recovery.</Text>
      </ActionPage>
    );
  }

  const pendingNewOwner = params.newOwner;
  return (
    <ActionPage title="Recovery" head={head} bg={bg} border={border} onBack={() => { router.back(); }}
      footer={(
        <WalletFooter border={border} dark={dark} onCancel={() => { router.back(); }}
          submitLabel={(rec.guardians ?? []).length ? 'Update guardians' : 'Save guardians'}
          onSubmit={() => void onSave()}
          submitDisabled={guardians.length === 0 || busy} submitLoading={busy}/>
      )}>
      <Col gap={16}>
        {pendingNewOwner ? (
          <PendingRecoveryCard pal={pal} dark={dark} newOwner={pendingNewOwner}
            finalizeAfterLabel={`in up to ${formatDelay(delay)}`} onCancel={() => void onCancel()} cancelling={busy}/>
        ) : null}
        <GuardianEditor pal={pal} dark={dark} guardians={guardians} threshold={threshold}
          delaySeconds={delay} onChange={setGuardians} onThreshold={setThreshold}/>
      </Col>
    </ActionPage>
  );
}
