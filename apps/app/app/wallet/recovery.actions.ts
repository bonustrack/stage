
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { resolveEnsName } from '../../lib/ens';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import {
  installGuardians, updateGuardians, cancelRecovery,
  signRecoveryApproval, sendRecoveryApproval, smartOwnerSigner,
} from '../../lib/zerodev';
import type { Address } from 'viem';

export interface RecoveryActionsArgs {
  rec: AccountRecord | null;
  guardians: string[];
  threshold: number;
  delay: number;
  params: { line?: string; wallet?: string; newOwner?: string };
  setBusy: (b: boolean) => void;
  setApproving: (b: boolean) => void;
  setApproved: (b: boolean) => void;
  router: { back: () => void };
}

export interface RecoveryActions {
  onSave: () => Promise<void>;
  onCancel: () => Promise<void>;
  onApprove: () => Promise<void>;
}

async function resolveGuardians(guardians: string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const g of guardians) {
    if (g.startsWith('0x')) { resolved.push(g); continue; }
    const a = await resolveEnsName(g);
    if (!a) throw new Error(`Could not resolve ${g}`);
    resolved.push(a.toLowerCase());
  }
  return resolved;
}

export function useRecoveryActions(a: RecoveryActionsArgs): RecoveryActions {
  const { rec, guardians, threshold, delay, params, setBusy, setApproving, setApproved, router } = a;

  const onSave = useCallback(async (): Promise<void> => {
    if (!rec) return;
    setBusy(true);
    try {
      const resolved = await resolveGuardians(guardians);
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
  }, [rec, guardians, threshold, delay, router, setBusy]);

  const onCancel = useCallback(async (): Promise<void> => {
    if (!rec || !params.newOwner) return;
    setBusy(true);
    try {
      await cancelRecovery(rec, params.newOwner as Address, 0n);
      Alert.alert('Recovery cancelled', 'The pending recovery was cancelled.');
      router.back();
    } catch (e) {
      Alert.alert('Could not cancel', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [rec, params.newOwner, router, setBusy]);

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
  }, [params.line, params.wallet, params.newOwner, setApproving, setApproved]);

  return { onSave, onCancel, onApprove };
}
