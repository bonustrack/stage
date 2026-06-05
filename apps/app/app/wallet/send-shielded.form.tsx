/** Shielded-send body for the unified Wallet → Send token page (private →
 *  private 0zk transfer).
 *
 *  Recipient = any 0zk address; the token/network are owned by the parent page
 *  (the combined TokenSelector) and passed in, along with the selected token's
 *  shielded balance. Submit reuses runAction({ kind: 'send' }) which performs
 *  the privateTransfer (proof + broadcast) and drives the shared pending store.
 *  Tracks this transfer's pending row and reflects its phase via the shared
 *  stepper. Mounted only when the chosen token is a shielded balance. */
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { getActiveAccountId } from '../../lib/accounts';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { runAction } from '../../lib/railgun/wallet';
import { pendingStore } from '../../lib/railgun/cache';
import { RAILGUN_TOKENS } from '../../lib/railgun/tokens';
import type { PendingAction } from '../../lib/railgun/types';
import { ShieldPhaseLine } from './send.shield.parts';
import { ShieldStepper, type ShieldStage } from './send.shield.stepper';
import { AmountBox, type FormPal, type FooterState } from './wallet.form';

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

function tokenAddress(chainId: number, symbol: 'ETH' | 'USDC'): string | undefined {
  const net = chainId === 1 ? 'mainnet' : 'sepolia';
  return RAILGUN_TOKENS[net].find(t => t.symbol === symbol)?.address;
}

export function SendShieldedBody({ pal, dark, symbol, chainId, balance, onFooter }: {
  pal: FormPal; dark: boolean; symbol: 'ETH' | 'USDC'; chainId: number; balance: string | null;
  /** Report submit state up so the page renders the pinned footer button. */
  onFooter?: (s: FooterState) => void;
}): React.ReactElement {
  const { head, sub, inputBg } = pal;
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingId) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!id || cancelled) return;
      const read = (list: PendingAction[] | undefined): void =>
        setAction((list ?? []).find(a => a.id === pendingId) ?? null);
      read(pendingStore.get(id));
      unsub = pendingStore.subscribe(id, read);
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [pendingId]);

  const stage = err ? 'error' : phaseToStage(action?.phase);
  const txHash = action?.txHash ?? null;
  const n = Number(amount);
  const busy = stage === 'submitting' || stage === 'confirming' || stage === 'scanning';
  const validTo = to.trim().toLowerCase().startsWith('0zk');
  const canSubmit = validTo && isFinite(n) && n > 0 && !busy && isBridgeAvailable();

  const onSubmit = (): void => {
    if (!canSubmit) return;
    setErr(null); setAction(null);
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!id) { setErr('No active account'); return; }
      const token = tokenAddress(chainId, symbol);
      if (!token) { setErr(`Unsupported token: ${symbol}`); return; }
      const pid = runAction(id, {
        kind: 'send', symbol, chainId, delta: amount.trim(), recipient: to.trim(), token,
      });
      setPendingId(pid);
    })();
  };

  const submitLabel = busy ? 'Sending…' : stage === 'done' ? 'Sent ✓' : 'Send';
  useEffect(() => {
    onFooter?.({ submitLabel, onSubmit, submitDisabled: !canSubmit, submitLoading: busy });
  }, [onFooter, submitLabel, canSubmit, busy, onSubmit]);

  return (
    <Box style={{ gap: 16 }}>
      <Box style={{ gap: 6 }}>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>RECIPIENT (0zk ADDRESS)</Text>
        <TextInput value={to} onChangeText={setTo} placeholder="0zk…" placeholderTextColor={sub}
          autoCapitalize="none" autoCorrect={false} editable={!busy}
          style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium', backgroundColor: inputBg,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }} />
      </Box>

      <AmountBox pal={pal} amount={amount} setAmount={setAmount} busy={busy}
        balance={balance} symbol={symbol} dark={dark} />

      <ShieldStepper stage={stage} pal={pal} />
      <ShieldPhaseLine pal={pal} txHash={txHash} err={err} bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </Box>
  );
}
