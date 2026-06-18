/** Wallet → Unshield token (private → public).
 *
 *  Moves funds from the user's OWN 0zk shielded balance back to a PUBLIC address
 *  (defaults to the user's own EOA). Reached from the token detail page's
 *  "Unshield" button (shielded holdings only). Token/network pre-selected via
 *  query params; amount is chosen.
 *
 *  Unshield REQUIRES a Groth16 proof, so confirm runs the full estimate → prove
 *  → populate → broadcast flow in lib/railgun/unshield.ts. Proving is the slow
 *  step (~10-30s); progress flows through the phase line + Private-tab chip.
 *  Recipient defaults to own EOA (kept simple, not editable). */
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { unshieldToPublic } from '../../lib/railgun/unshield';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { UnshieldRecipient, UnshieldPhaseLine } from './unshield.parts';
import { ActionPage, AmountBox, WalletFooter, useFormPal } from './wallet.form';
import { TokenSelector, useSelectedBalance } from './TokenSelector';

type Phase = 'idle' | 'proving' | 'broadcasting' | 'done' | 'error';
const NET_LABEL: Record<number, string> = { 1: 'Ethereum', 11155111: 'Sepolia' };

/** Screen for unshielding tokens from a private balance back to public. */
export default function WalletUnshield(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol?: string; chainId?: string }>();
  const { link: head, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = useFormPal();

  const [eoa, setEoa] = useState<string | null>(null);
  useEffect(() => { void getActiveAccount().then(a => setEoa(a?.address ?? null)); }, []);

  const initialSymbol = params.symbol === 'USDC' ? 'USDC' : 'ETH';
  const initialChainId = typeof params.chainId === 'string' && Number.isFinite(Number(params.chainId))
    ? Number(params.chainId) : 11155111;
  const [symbol, setSymbol] = useState<'ETH' | 'USDC'>(initialSymbol);
  const [chainId, setChainId] = useState<number>(initialChainId);
  const balance = useSelectedBalance('shielded', { symbol, chainId });
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const n = Number(amount);
  const busy = phase === 'proving' || phase === 'broadcasting';
  const canSubmit = isFinite(n) && n > 0 && !busy && !!eoa && isBridgeAvailable();

  const onSubmit = (): void => {
    if (!canSubmit) return;
    setErr(null); setTxHash(null); setPhase('proving');
    void (async (): Promise<void> => {
      try {
        const res = await unshieldToPublic({ chainId, symbol, amount: amount.trim() });
        setTxHash(res.txHash); setPhase('done');
      } catch (e) {
        setErr((e as Error).message ?? 'Unshield failed'); setPhase('error');
      }
    })();
  };

  return (
    <ActionPage title="Unshield token" head={head} bg={bg} border={border} onBack={() => router.back()}
      footer={
        <WalletFooter border={border} dark={dark} onCancel={() => router.back()}
          submitDisabled={!canSubmit} submitLoading={busy} onSubmit={onSubmit}
          submitLabel={phase === 'proving' ? 'Proving…' : phase === 'broadcasting' ? 'Broadcasting…'
            : phase === 'done' ? 'Unshielded ✓' : 'Unshield'} />
      }>
      <UnshieldRecipient pal={pal} eoa={eoa} network={NET_LABEL[chainId] ?? `Chain ${chainId}`} />

      <TokenSelector mode="shielded" value={{ symbol, chainId }}
        onChange={(v) => { setSymbol(v.symbol as 'ETH' | 'USDC'); setChainId(v.chainId); }} />

      <AmountBox pal={pal} amount={amount} setAmount={setAmount} busy={busy}
        balance={balance} symbol={symbol} dark={dark} />

      <UnshieldPhaseLine pal={pal} phase={phase} txHash={txHash} err={err} bridgeOk={isBridgeAvailable()} chainId={chainId} />
    </ActionPage>
  );
}
