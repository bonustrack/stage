/** Unified shield-flow form for the Wallet, driving BOTH:
 *
 *    • mode="shield"  - Shield (public → private). Deposits a PUBLIC token into
 *      the user's OWN 0zk shielded balance. Recipient is ALWAYS the user's own
 *      0zk address (locked, read-only). Owns its OWN TokenSelector. Runs
 *      shieldToPrivate(); the 4-stage stepper is driven off the SHARED
 *      pending-action store (cache.ts) so the post-receipt 'scanning' tail
 *      (balance-landed watcher) is reflected even though the awaited
 *      shieldToPrivate() returns right after the receipt.
 *
 *    • mode="send"    - Shielded send (private → private 0zk transfer). Recipient
 *      = any 0zk address (free text). Token/network/balance are owned by the
 *      parent page (the combined TokenSelector) and passed in. Runs the REAL
 *      bridge-backed private transfer (sendShielded → lib/railgun/send.ts), which
 *      mirrors the unshield flow: estimate → Groth16 proof → populate → sign +
 *      broadcast via the embedded Node host. Proving is the slow step (~10-30s).
 *
 *  WHY one component: the two flows share the amount input, stepper, phase line,
 *  busy/footer wiring, and bridge gating verbatim - only the recipient row, the
 *  token source, the submit fn, and the labels differ by `mode`. The shield-only
 *  pending-store subscription stays gated behind mode==='shield'.
 *
 *  WHY NOT runAction (send mode): runAction()/sdkTx route the transfer through the
 *  Hermes direct SDK, where the RAILGUN engine never inits on-device - so it
 *  failed immediately at "Submitting transaction". The engine only lives in the
 *  Node bridge, which is what send.ts uses (same path as shield/unshield). */
import { useEffect, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Input } from '@metro-labs/kit/input';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { shieldToPrivate } from '../../lib/railgun/shield';
import { sendShielded } from '../../lib/railgun/send';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { getActiveAccountId } from '../../lib/accounts';
import { pendingStore } from '../../lib/railgun/cache';
import type { PendingAction } from '../../lib/railgun/types';
import { ShieldRecipient, ShieldPhaseLine } from './send.shield.parts';
import { ShieldStepper, type ShieldStage } from './send.shield.stepper';
import { AmountBox, type FormPal, type FooterState } from './wallet.form';
import { TokenSelector, useSelectedBalance } from './TokenSelector';

type Pal = FormPal;

/** Map a pending-action phase to a stepper stage. `proving`/`broadcasting` are
 *  the two on-chain stages; `scanning` is the merkle-scan tail; `confirmed`/
 *  `failed` are terminal. (shield mode only.) */
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

export interface ShieldFlowFormProps {
  /** "shield" = public→private deposit (locked own 0zk); "send" = private→private
   *  transfer to any 0zk address. */
  mode: 'shield' | 'send';
  pal: Pal; dark: boolean;
  /** shield mode: the user's own 0zk address (locked recipient). */
  zkAddress?: string | null;
  /** shield mode: pre-selected token/network (from the token detail Shield btn). */
  initialSymbol?: 'ETH' | 'USDC'; initialChainId?: number;
  /** send mode: token/network/balance owned by the parent page. */
  symbol?: 'ETH' | 'USDC'; chainId?: number; balance?: string | null;
  /** Report submit state up so the page renders the pinned footer button. */
  onFooter?: (s: FooterState) => void;
}

export function ShieldFlowForm(props: ShieldFlowFormProps): React.ReactElement {
  return props.mode === 'shield' ? <ShieldBody {...props} /> : <SendBody {...props} />;
}

/** Shield (public → private) body - owns its TokenSelector + pending-store sub. */
function ShieldBody({ pal, dark, zkAddress, initialSymbol, initialChainId, onFooter }: ShieldFlowFormProps): React.ReactElement {
  const [symbol, setSymbol] = useState<'ETH' | 'USDC'>(initialSymbol ?? 'ETH');
  const [chainId, setChainId] = useState<number>(initialChainId ?? 11155111);
  const balance = useSelectedBalance('public', { symbol, chainId });
  const [amount, setAmount] = useState('');
  // Wall-clock of the latest submit; we track the shield pending row started at
  // or after this, so the stepper follows THIS shield (not a stale prior one).
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Subscribe to the pending store and track this shield's row (newest `shield`
  // action at/after submit) so the stepper reflects every phase - including the
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

  // Report the primary-button state up so the page renders it in the pinned
  // footer (keeps the form as the source of truth for label/disabled/loading).
  const submitLabel = busy ? 'Shielding…' : stage === 'done' ? 'Shielded ✓' : 'Shield';
  useEffect(() => {
    onFooter?.({ submitLabel, onSubmit, submitDisabled: !canSubmit, submitLoading: busy });
  }, [onFooter, submitLabel, canSubmit, busy, onSubmit]);

  return (
    <Box style={{ gap: 16 }}>
      <ShieldRecipient pal={pal} zkAddress={zkAddress ?? null} />

      <TokenSelector mode="public" value={{ symbol, chainId }}
        onChange={(v) => { setSymbol(v.symbol as 'ETH' | 'USDC'); setChainId(v.chainId); }} />

      <AmountBox pal={pal} amount={amount} setAmount={setAmount} busy={busy}
        balance={balance} symbol={symbol} dark={dark} />

      <ShieldStepper stage={stage} pal={pal} />
      <ShieldPhaseLine pal={pal} txHash={txHash} err={err} bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </Box>
  );
}

/** Shielded send (private → private) body - token/balance from the parent page,
 *  free 0zk recipient input, local stage state. */
function SendBody({ pal, dark, symbol = 'ETH', chainId = 1, balance = null, onFooter }: ShieldFlowFormProps): React.ReactElement {
  const { head, sub, inputBg } = pal;
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<ShieldStage>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errPhase, setErrPhase] = useState<string | null>(null);

  const n = Number(amount);
  const busy = stage === 'submitting' || stage === 'confirming' || stage === 'scanning';
  const validTo = to.trim().toLowerCase().startsWith('0zk');
  const canSubmit = validTo && isFinite(n) && n > 0 && !busy && isBridgeAvailable();

  const onSubmit = (): void => {
    if (!canSubmit) return;
    setErr(null); setErrPhase(null); setTxHash(null); setStage('submitting');
    void (async (): Promise<void> => {
      try {
        // proving runs first; flip to confirming once it broadcasts.
        const res = await sendShielded({ chainId, symbol, amount: amount.trim(), recipient: to.trim() });
        setTxHash(res.txHash); setStage('done');
      } catch (e) {
        // Robustly extract a message: handle non-Error rejections, empty
        // messages, and the wrapped { step } from sendShielded so the user
        // ALWAYS sees real text instead of a bare red X.
        const we = e as { message?: unknown; step?: unknown } | undefined;
        const raw = typeof we?.message === 'string' ? we.message : '';
        const msg = raw.trim() ? raw : `Send failed: ${String(e)}`;
        console.error('[ShieldFlowForm] private send failed:', e);
        setErr(msg);
        setErrPhase(typeof we?.step === 'string' ? we.step : null);
        setStage('error');
      }
    })();
  };

  const submitLabel = stage === 'submitting' ? 'Proving…'
    : stage === 'confirming' || stage === 'scanning' ? 'Broadcasting…'
    : stage === 'done' ? 'Sent ✓' : 'Send';
  useEffect(() => {
    onFooter?.({ submitLabel, onSubmit, submitDisabled: !canSubmit, submitLoading: busy });
  }, [onFooter, submitLabel, canSubmit, busy, onSubmit]);

  return (
    <Box style={{ gap: 16 }}>
      <Box style={{ gap: 6 }}>
        <Text size="sm" style={{ color: sub }}>RECIPIENT (0zk ADDRESS)</Text>
        <Input value={to} onChangeText={setTo} placeholder="0zk…" placeholderTextColor={sub}
          disabled={busy} dark={dark}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
          style={{ color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium', backgroundColor: inputBg,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 0, borderWidth: 0 }} />
      </Box>

      <AmountBox pal={pal} amount={amount} setAmount={setAmount} busy={busy}
        balance={balance} symbol={symbol} dark={dark} />

      <ShieldStepper stage={stage} pal={pal} />
      <ShieldPhaseLine pal={pal} txHash={txHash} err={err} errPhase={errPhase}
        bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </Box>
  );
}
