
import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActiveAccount, type AccountRecord } from './accounts';
import { useActiveAccountRecord } from '../modules/messaging/account';
import { capabilities } from './capabilities';
import { type ConfirmOptions } from './confirm';
import {
  enablePasskeyForRecord, removePasskeyFromRecord, passkeysAvailable, kernelDeployedOnChain,
} from './zerodev';
import { flash } from './toast';

export interface PasskeyAction {
  available: boolean;
  busy: boolean;
  run: () => void;
}

type ActionResult = { ok: true } | { ok: false; reason: string; message?: string };

interface PasskeySpec {
  name: string;
  offer: (acct: AccountRecord) => Promise<boolean>;
  confirm: ConfirmOptions;
  perform: (acct: AccountRecord) => Promise<ActionResult>;
  success: string;
  notes: Record<string, string>;
  clearOn: readonly string[];
  fallback: string;
}

const UNAVAILABLE_NOTE = 'Passkeys need the latest app build';

const ENABLE: PasskeySpec = {
  name: 'enable',
  offer: async (acct) => {
    if (!passkeysAvailable() || acct.type !== 'smart') return false;
    if (!acct.passkey) return true;
    return !(await kernelDeployedOnChain(acct.address).catch(() => false));
  },
  confirm: {
    title: 'Enable passkey',
    message:
      'Register a passkey on this device to approve every transaction with Face ID / biometrics instead of your recovery key. You can still recover with your phrase.',
    confirmLabel: 'Enable',
  },
  perform: enablePasskeyForRecord,
  success: 'Passkey enabled - it now signs every transaction',
  notes: {
    cancelled: 'Passkey setup cancelled',
    already: 'This account already has a passkey',
    unavailable: UNAVAILABLE_NOTE,
  },
  clearOn: ['already'],
  fallback: 'Could not enable passkey',
};

const REMOVE: PasskeySpec = {
  name: 'remove',
  offer: (acct) =>
    Promise.resolve(passkeysAvailable() && acct.type === 'smart' && !!acct.passkey),
  confirm: {
    title: 'Remove passkey',
    message:
      'This reverts the account to signing with your recovery key instead of the passkey. It LOWERS security: transactions will no longer require Face ID / biometrics. You will confirm this change with your passkey one last time.',
    confirmLabel: 'Remove passkey',
    destructive: true,
  },
  perform: removePasskeyFromRecord,
  success: 'Passkey removed - this account signs with your key again',
  notes: { none: 'This account has no passkey', unavailable: UNAVAILABLE_NOTE },
  clearOn: ['none'],
  fallback: 'Could not remove passkey',
};

function usePasskeyAction(spec: PasskeySpec): PasskeyAction {
  const rec = useActiveAccountRecord();
  const [busy, setBusy] = useState(false);
  const [clearedFor, setClearedFor] = useState<string | null>(null);
  const confirming = useRef(false);

  const { data: offered } = useQuery({
    queryKey: ['passkeyAction', spec.name, rec?.id ?? ''],
    queryFn: () => (rec ? spec.offer(rec) : Promise.resolve(false)),
    enabled: !!rec,
  });

  const perform = useCallback((): void => {
    setBusy(true);
    void (async (): Promise<void> => {
      try {
        const acct = await getActiveAccount();
        if (!acct) { flash('No active account'); return; }
        const res = await spec.perform(acct);
        if (res.ok) { flash(spec.success); setClearedFor(acct.id); return; }
        flash(spec.notes[res.reason] ?? res.message ?? spec.fallback);
        if (spec.clearOn.includes(res.reason)) setClearedFor(acct.id);
      } finally {
        setBusy(false);
      }
    })();
  }, [spec]);

  const run = useCallback((): void => {
    if (busy || confirming.current) return;
    confirming.current = true;
    void (async (): Promise<void> => {
      try {
        if (await capabilities.confirm(spec.confirm)) perform();
      } finally {
        confirming.current = false;
      }
    })();
  }, [busy, perform, spec]);

  return { available: !!offered && clearedFor !== (rec?.id ?? null), busy, run };
}

export function useEnablePasskey(): PasskeyAction {
  return usePasskeyAction(ENABLE);
}

export function useRemovePasskey(): PasskeyAction {
  return usePasskeyAction(REMOVE);
}
