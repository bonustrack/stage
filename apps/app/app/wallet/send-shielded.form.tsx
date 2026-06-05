/** Shielded-send body for the unified Wallet → Send token page (private →
 *  private 0zk transfer).
 *
 *  Recipient = any 0zk address; the token/network are owned by the parent page
 *  (the combined TokenSelector) and passed in, along with the selected token's
 *  shielded balance. Submit runs the REAL bridge-backed private transfer
 *  (sendShielded → lib/railgun/send.ts), which mirrors the working unshield flow:
 *  estimate → Groth16 proof → populate → sign + broadcast via the embedded Node
 *  host. Proving is the slow step (~10-30s); progress drives the shared stepper.
 *  Mounted only when the chosen token is a shielded balance.
 *
 *  WHY NOT runAction: runAction()/sdkTx route the transfer through the Hermes
 *  direct SDK, where the RAILGUN engine never inits on-device — so it failed
 *  immediately at "Submitting transaction". The engine only lives in the Node
 *  bridge, which is what send.ts uses (same path as shield/unshield). */
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { sendShielded } from '../../lib/railgun/send';
import { ShieldPhaseLine } from './send.shield.parts';
import { ShieldStepper, type ShieldStage } from './send.shield.stepper';
import { AmountBox, type FormPal, type FooterState } from './wallet.form';

export function SendShieldedBody({ pal, dark, symbol, chainId, balance, onFooter }: {
  pal: FormPal; dark: boolean; symbol: 'ETH' | 'USDC'; chainId: number; balance: string | null;
  /** Report submit state up so the page renders the pinned footer button. */
  onFooter?: (s: FooterState) => void;
}): React.ReactElement {
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
        console.error('[SendShieldedBody] private send failed:', e);
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
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>RECIPIENT (0zk ADDRESS)</Text>
        <TextInput value={to} onChangeText={setTo} placeholder="0zk…" placeholderTextColor={sub}
          autoCapitalize="none" autoCorrect={false} editable={!busy}
          style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium', backgroundColor: inputBg,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }} />
      </Box>

      <AmountBox pal={pal} amount={amount} setAmount={setAmount} busy={busy}
        balance={balance} symbol={symbol} dark={dark} />

      <ShieldStepper stage={stage} pal={pal} />
      <ShieldPhaseLine pal={pal} txHash={txHash} err={err} errPhase={errPhase}
        bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </Box>
  );
}
