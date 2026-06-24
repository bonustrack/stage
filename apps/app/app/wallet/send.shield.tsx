import { useEffect, useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Input } from '@stage-labs/kit/react-native/input';
import { Text } from '@stage-labs/kit/react-native/text';
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

function isBusyStage(stage: ShieldStage): boolean {
  return stage === 'submitting' || stage === 'confirming' || stage === 'scanning';
}

function pickShieldAction(list: PendingAction[] | undefined, submittedAt: number): PendingAction | null {
  const mine = (list ?? [])
    .filter(a => a.kind === 'shield' && a.startedAt >= submittedAt - 2000)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  return mine ?? null;
}

function canRunFlow(amount: string, busy: boolean): boolean {
  const n = Number(amount);
  return isFinite(n) && n > 0 && !busy && isBridgeAvailable();
}

function shieldSubmitLabel(busy: boolean, stage: ShieldStage): string {
  if (busy) return 'Shielding…';
  return stage === 'done' ? 'Shielded ✓' : 'Shield';
}

function sendSubmitLabel(stage: ShieldStage): string {
  if (stage === 'submitting') return 'Proving…';
  if (stage === 'confirming' || stage === 'scanning') return 'Broadcasting…';
  return stage === 'done' ? 'Sent ✓' : 'Send';
}

export interface ShieldFlowFormProps {
  mode: 'shield' | 'send';
  pal: Pal; dark: boolean;
  zkAddress?: string | null;
  initialSymbol?: 'ETH' | 'USDC'; initialChainId?: number;
  symbol?: 'ETH' | 'USDC'; chainId?: number; balance?: string | null;
  onFooter?: (s: FooterState) => void;
}

export function ShieldFlowForm(props: ShieldFlowFormProps): React.ReactElement {
  return props.mode === 'shield' ? <ShieldBody {...props} /> : <SendBody {...props} />;
}

function ShieldBody({ pal, dark, zkAddress, initialSymbol, initialChainId, onFooter }: ShieldFlowFormProps): React.ReactElement {
  const [symbol, setSymbol] = useState<'ETH' | 'USDC'>(initialSymbol ?? 'ETH');
  const [chainId, setChainId] = useState<number>(initialChainId ?? 11155111);
  const balance = useSelectedBalance('public', { symbol, chainId });
  const [amount, setAmount] = useState('');
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (submittedAt == null) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!id || cancelled) return;
      const read = (list: PendingAction[] | undefined): void => { setAction(pickShieldAction(list, submittedAt)); };
      read(pendingStore.get(id));
      unsub = pendingStore.subscribe(id, read);
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [submittedAt]);

  const stage = err ? 'error' : phaseToStage(action?.phase);
  const txHash = action?.txHash ?? null;
  const busy = isBusyStage(stage);
  const canSubmit = !!zkAddress && canRunFlow(amount, busy);

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

  const submitLabel = shieldSubmitLabel(busy, stage);
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
      <ShieldPhaseLine txHash={txHash} err={err} bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </Box>
  );
}

function SendBody({ pal, dark, symbol = 'ETH', chainId = 1, balance = null, onFooter }: ShieldFlowFormProps): React.ReactElement {
  const { head, sub, inputBg } = pal;
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<ShieldStage>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errPhase, setErrPhase] = useState<string | null>(null);

  const busy = isBusyStage(stage);
  const validTo = to.trim().toLowerCase().startsWith('0zk');
  const canSubmit = validTo && canRunFlow(amount, busy);

  const onSubmit = (): void => {
    if (!canSubmit) return;
    setErr(null); setErrPhase(null); setTxHash(null); setStage('submitting');
    void (async (): Promise<void> => {
      try {
        const res = await sendShielded({ chainId, symbol, amount: amount.trim(), recipient: to.trim() });
        setTxHash(res.txHash); setStage('done');
      } catch (e) {
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

  const submitLabel = sendSubmitLabel(stage);
  useEffect(() => {
    onFooter?.({ submitLabel, onSubmit, submitDisabled: !canSubmit, submitLoading: busy });
  }, [onFooter, submitLabel, canSubmit, busy, onSubmit]);

  return (
    <Box gap={16}>
      <Box gap={6}>
        <Text size="xs" role="secondary">RECIPIENT (0zk ADDRESS)</Text>
        <Input value={to} onChangeText={setTo} placeholder="0zk…" placeholderTextColor={sub}
          disabled={busy} dark={dark}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
          style={{ color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium', backgroundColor: inputBg,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 0, borderWidth: 0 }} />
      </Box>

      <AmountBox pal={pal} amount={amount} setAmount={setAmount} busy={busy}
        balance={balance} symbol={symbol} dark={dark} />

      <ShieldStepper stage={stage} pal={pal} />
      <ShieldPhaseLine txHash={txHash} err={err} errPhase={errPhase}
        bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </Box>
  );
}
