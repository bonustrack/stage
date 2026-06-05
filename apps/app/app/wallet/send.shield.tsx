/** Shield (public → private) form for the Wallet → Send screen.
 *
 *  Deposits a PUBLIC token into the user's OWN 0zk shielded balance. The
 *  recipient is ALWAYS the user's own 0zk address (locked, shown read-only) —
 *  never an arbitrary recipient. Defaults to Sepolia (testnet) for the first
 *  on-chain write. Token (ETH/USDC) + amount are user-chosen; confirm runs
 *  shieldToPrivate() and surfaces a 4-stage stepper: submit → confirm → scan →
 *  shielded ✓.
 *
 *  The stepper is driven off the SHARED pending-action store (cache.ts), which
 *  shieldToPrivate() advances proving → broadcasting → scanning → confirmed; the
 *  form subscribes to its own pending row and maps each phase to a stepper stage.
 *  This way the 'scanning' tail (balance-landed watcher) is reflected even though
 *  the awaited shieldToPrivate() call returns right after the receipt. */
import { useEffect, useState } from 'react';
import { Button } from '@metro-labs/kit/button';
import { Box } from '../../components/layout';
import { shieldToPrivate } from '../../lib/railgun/shield';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { getActiveAccountId } from '../../lib/accounts';
import { pendingStore } from '../../lib/railgun/cache';
import type { PendingAction } from '../../lib/railgun/types';
import { ShieldRecipient, ShieldPhaseLine } from './send.shield.parts';
import { ShieldStepper, type ShieldStage } from './send.shield.stepper';
import { Segmented, AmountBox, type FormPal } from './wallet.form';

type Pal = FormPal;

const SYMBOLS = ['ETH', 'USDC'] as const;
const NETS = [{ id: 11155111, label: 'Sepolia' }, { id: 1, label: 'Ethereum' }] as const;

/** Map a pending-action phase to a stepper stage. `proving`/`broadcasting` are
 *  the two on-chain stages; `scanning` is the merkle-scan tail; `confirmed`/
 *  `failed` are terminal. */
function phaseToStage(p?: PendingAction['phase']): ShieldStage {
  switch (p) {
    case 'proving': return 'submitting';
    case 'broadcasting': return 'confirming';
    case 'scanning': return 'scanning';
    case 'confirmed': return 'done';
    case 'failed': return 'error';
    default: return 'idle';
  }
}

export function ShieldForm({ pal, dark, zkAddress, initialSymbol, initialChainId }: {
  pal: Pal; dark: boolean; zkAddress: string | null;
  /** Pre-selected token/network (from the token detail page's Shield button). */
  initialSymbol?: 'ETH' | 'USDC'; initialChainId?: number;
}): React.ReactElement {
  const [symbol, setSymbol] = useState<'ETH' | 'USDC'>(initialSymbol ?? 'ETH');
  const [chainId, setChainId] = useState<number>(initialChainId ?? 11155111);
  const [amount, setAmount] = useState('');
  // Wall-clock of the latest submit; we track the shield pending row started at
  // or after this, so the stepper follows THIS shield (not a stale prior one).
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Subscribe to the pending store and track this shield's row (newest `shield`
  // action at/after submit) so the stepper reflects every phase — including the
  // post-receipt `scanning` tail driven by the balance-landed watcher.
  useEffect(() => {
    if (submittedAt == null) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!id || cancelled) return;
      const read = (list: PendingAction[] | undefined): void => {
        const mine = (list ?? [])
          .filter(a => a.kind === 'shield' && a.startedAt >= submittedAt - 2000)
          .sort((a, b) => b.startedAt - a.startedAt)[0];
        setAction(mine ?? null);
      };
      read(pendingStore.get(id));
      unsub = pendingStore.subscribe(id, read);
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [submittedAt]);

  const stage = err ? 'error' : phaseToStage(action?.phase);
  const txHash = action?.txHash ?? null;
  const n = Number(amount);
  const busy = stage === 'submitting' || stage === 'confirming' || stage === 'scanning';
  const canSubmit = !!zkAddress && isFinite(n) && n > 0 && !busy && isBridgeAvailable();

  const onSubmit = (): void => {
    if (!canSubmit) return;
    setErr(null); setAction(null); setSubmittedAt(Date.now());
    void (async (): Promise<void> => {
      try {
        await shieldToPrivate({ chainId, symbol, amount: amount.trim() });
      } catch (e) {
        setErr((e as Error).message ?? 'Shield failed');
      }
    })();
  };

  return (
    <Box style={{ gap: 16 }}>
      <ShieldRecipient pal={pal} zkAddress={zkAddress} />

      <Segmented label="NETWORK" dark={dark} value={chainId} onChange={setChainId}
        options={NETS.map(n => [n.id, n.label] as const)} />

      <Segmented label="TOKEN" dark={dark} value={symbol} onChange={setSymbol}
        options={SYMBOLS.map(s => [s, s] as const)} />

      <AmountBox pal={pal} amount={amount} setAmount={setAmount} busy={busy} />

      <Button variant="primary" size="lg" fullWidth pill dark={dark} loading={busy}
        disabled={!canSubmit} onPress={onSubmit}
        label={busy ? 'Shielding…' : stage === 'done' ? 'Shielded ✓' : 'Shield to private'}
        style={{ marginTop: 4 }} />

      <ShieldStepper stage={stage} pal={pal} />
      <ShieldPhaseLine pal={pal} txHash={txHash} err={err} bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </Box>
  );
}
