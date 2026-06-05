/** Wallet → Send token (public).
 *
 *  Public send: token chosen via the shared TokenSelector modal (reusing the
 *  Wallet page's token rows), address-or-ENS recipient (stamp.fyi/ENS
 *  resolution), token⇄USD amount with Max + balance, submitted over the
 *  connected Reown/wagmi wallet (lib/tx.ts). State + lifecycle live in
 *  usePublicSend (send.public.ts).
 *
 *  This page does ONE thing — public send. Shielding (public→private) lives in
 *  shield.tsx, private transfers in send-shielded.tsx, unshield in unshield.tsx.
 *  `?to=<address>` may be pre-populated by callers (profile Send button). */
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import {
  RecipientField, AmountField, SendHeader, SubmitButton, TxStatus,
} from './send.fields';
import { usePublicSend } from './send.public';
import { TokenSelector, useSelectedBalance } from './TokenSelector';

export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ to?: string }>();
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const inputBg = border;
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState<{ symbol: string; chainId: number }>({ symbol: 'ETH', chainId: 1 });
  const balance = useSelectedBalance('public', token);
  const p = usePublicSend(typeof params.to === 'string' ? params.to : '', token, balance);
  const pal = { fg, head, sub, border, inputBg };

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SendHeader fg={fg} head={head} border={border} onBack={() => router.back()} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <RecipientField
          pal={pal}
          to={p.to}
          setTo={p.setTo}
          resolving={p.resolving}
          resolved={p.resolved}
          resolveErr={p.resolveErr}
        />

        <TokenSelector mode="public" value={token} onChange={setToken} />

        <AmountField
          symbol={token.symbol}
          pal={pal}
          dark={dark}
          amount={p.amount}
          setAmount={p.setAmount}
          mode={p.mode}
          setMode={p.setMode}
          ethBalance={p.ethBalance}
          ethPriceUsd={p.ethPriceUsd}
          secondaryLabel={p.secondaryLabel}
          onMax={p.onMax}
        />

        <SubmitButton dark={dark} busy={p.busy} canSubmit={p.canSubmit} txState={p.txState} onSubmit={p.onSubmit} />

        <TxStatus sub={sub} txState={p.txState} txHash={p.txHash} txErr={p.txErr} />
      </ScrollView>
    </Box>
  );
}
