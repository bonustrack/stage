/**
 * @file Unified shield-flow form driving both shield (public to own private
 * 0zk balance) and shielded send (private 0zk-to-0zk transfer), sharing the
 * amount input, stepper, and footer wiring while differing by mode.
 */
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

/** Map a pending-action phase to a stepper stage. `proving`/`broadcasting` are the two on-chain stages; `scanning` is the merkle-scan tail; `confirmed`/ `failed` are terminal. (shield mode only.) */
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
  /** "shield" = public→private deposit (locked own 0zk); "send" = private→private transfer to any 0zk address. */
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

/** Renders the shield or send body depending on the active flow mode. */
export function ShieldFlowForm(props: ShieldFlowFormProps): React.ReactElement {
  return props.mode === 'shield' ? <ShieldBody {...props} /> : <SendBody {...props} />;
}

/** Shield (public → private) body - owns its TokenSelector + pending-store sub. */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor to satisfy function-size limits
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
      /** Read helper. */
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

  /** Handle the Submit. */
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
    <Box gap={16}>
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

/** Shielded send (private → private) body - token/balance from the parent page, free 0zk recipient input, local stage state. */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor (complexity 14)
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

  /** Handle the Submit. */
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
    <Box gap={16}>
      <Box gap={6}>
        <Text size="xs" color={sub}>RECIPIENT (0zk ADDRESS)</Text>
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
