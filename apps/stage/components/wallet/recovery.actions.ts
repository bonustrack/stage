import { errorMessage } from '@stage-labs/client/errors';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import type { AccountRecord } from '../../lib/accounts';
import { installGuardians, updateGuardians } from '../../lib/zerodev';

interface RecoveryActionsArgs {
  rec: AccountRecord | null;
  guardians: string[];
  threshold: number;
  delay: number;
  setBusy: (b: boolean) => void;
  router: { back: () => void };
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

export function useSaveGuardians(a: RecoveryActionsArgs): () => Promise<void> {
  const { rec, guardians, threshold, delay, setBusy, router } = a;
  return useCallback(async (): Promise<void> => {
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
      Alert.alert('Could not save guardians', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [rec, guardians, threshold, delay, router, setBusy]);
}
