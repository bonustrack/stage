/** Wallet → Unshield screen.
 *
 *  Unshield (private → public): moves funds from the user's OWN 0zk shielded
 *  balance back to a PUBLIC address — defaulting to the user's own EOA. Reached
 *  from the token detail page's "Unshield" button (shown only for shielded
 *  holdings). Token/network are pre-selected via query params; amount is chosen.
 *
 *  Unlike shield, unshield REQUIRES a Groth16 proof, so confirm runs the full
 *  estimate → prove → populate → broadcast flow in lib/railgun/unshield.ts.
 *  Proving is the slow step (~10-30s on the embedded prover) — the progress
 *  chips (proving → broadcasting → confirmed) and the Private-tab pending chip
 *  both reflect it. Recipient defaults to own EOA (kept simple, not editable). */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Box, Row } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { unshieldToPublic } from '../../lib/railgun/unshield';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { UnshieldRecipient, UnshieldPhaseLine } from './unshield.parts';

type Phase = 'idle' | 'proving' | 'broadcasting' | 'done' | 'error';
const SYMBOLS = ['ETH', 'USDC'] as const;
const NET_LABEL: Record<number, string> = { 1: 'Ethereum', 11155111: 'Sepolia' };

export default function WalletUnshield(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol?: string; chainId?: string }>();
  const { fg, head, sub, bg, border, rowBg: inputBg } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const pal = { fg, head, sub, border, inputBg };

  const [eoa, setEoa] = useState<string | null>(null);
  useEffect(() => { void getActiveAccount().then(a => setEoa(a?.address ?? null)); }, []);

  const initialSymbol = params.symbol === 'USDC' ? 'USDC' : 'ETH';
  const initialChainId = typeof params.chainId === 'string' && Number.isFinite(Number(params.chainId))
    ? Number(params.chainId) : 11155111;
  const [symbol, setSymbol] = useState<'ETH' | 'USDC'>(initialSymbol);
  const [chainId] = useState<number>(initialChainId);
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
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <Row align="center" gap={8} px={12} py={8}
        style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={head} />
        </Pressable>
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
          Unshield
        </Text>
      </Row>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <UnshieldRecipient pal={pal} eoa={eoa} network={NET_LABEL[chainId] ?? `Chain ${chainId}`} />

        <Box style={{ gap: 6 }}>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>TOKEN</Text>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            {SYMBOLS.map(s => (
              <Pressable key={s} onPress={() => setSymbol(s)} style={{
                flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
                borderWidth: 1, borderColor: symbol === s ? '#c0a06e' : border,
                backgroundColor: symbol === s ? 'rgba(192,160,110,0.15)' : inputBg,
              }}>
                <Text style={{ color: symbol === s ? '#c0a06e' : fg, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>{s}</Text>
              </Pressable>
            ))}
          </Box>
        </Box>

        <Box style={{ gap: 6 }}>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>AMOUNT</Text>
          <Box style={{ backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
            <TextInput value={amount} onChangeText={setAmount} placeholder="0.0" placeholderTextColor={sub}
              keyboardType="decimal-pad" editable={!busy}
              style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', padding: 0 }} />
          </Box>
        </Box>

        <Button variant="primary" size="lg" fullWidth pill dark={dark} loading={busy}
          disabled={!canSubmit} onPress={onSubmit}
          label={phase === 'proving' ? 'Proving…' : phase === 'broadcasting' ? 'Broadcasting…'
            : phase === 'done' ? 'Unshielded ✓' : 'Unshield to public'}
          style={{ marginTop: 4 }} />

        <UnshieldPhaseLine pal={pal} phase={phase} txHash={txHash} err={err} bridgeOk={isBridgeAvailable()} />
      </ScrollView>
    </Box>
  );
}
