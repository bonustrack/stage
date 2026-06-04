/** Wallet → Send screen.
 *
 *  Two modes via a top toggle:
 *    - PUBLIC: address-or-ENS recipient (stamp.fyi resolution), ETH⇄USD amount
 *      with Max, submitted over the connected Reown/wagmi wallet (lib/tx.ts).
 *      The public-send state + lifecycle live in usePublicSend (send.public.ts).
 *    - SHIELD: deposit a public token into the user's OWN 0zk shielded balance
 *      (recipient locked to self). Runs lib/railgun/shield.ts over the in-app
 *      EOA key; see send.shield.tsx. Defaults to Sepolia for the first on-chain
 *      Kohaku write. */

import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import {
  RecipientField, AmountField, SendHeader, SubmitButton, TxStatus,
} from './send.fields';
import { ShieldForm } from './send.shield';
import { SendModeToggle } from './send.shield.parts';
import { usePublicSend } from './send.public';

export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  /** `to` may be pre-populated by callers (e.g. the profile Send button passes
   *  `?to=<address>`) — seed the input so the user doesn't retype. */
  const params = useLocalSearchParams<{ to?: string; mode?: string; symbol?: string; chainId?: string }>();
  const { text: fg, primary: head, bg, border } = usePalette();
  const sub = fg;
  const inputBg = border;
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  /** Public send vs Shield (public → own 0zk private wallet). Defaults to
   *  shield when the token detail page's Shield button passes `?mode=shield`. */
  const [sendMode, setSendMode] = useState<'public' | 'shield'>(
    params.mode === 'shield' ? 'shield' : 'public',
  );
  /** Token/network pre-selected by the token detail page (Shield button). */
  const initialSymbol = params.symbol === 'USDC' ? 'USDC' : params.symbol === 'ETH' ? 'ETH' : undefined;
  const initialChainId = typeof params.chainId === 'string' ? Number(params.chainId) : undefined;
  const { snapshot: privSnapshot } = usePrivateWallet();
  const p = usePublicSend(typeof params.to === 'string' ? params.to : '');
  const pal = { fg, head, sub, border, inputBg };

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SendHeader fg={fg} head={head} border={border} onBack={() => router.back()} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <SendModeToggle pal={pal} mode={sendMode} setMode={setSendMode} />

        {sendMode === 'shield' ? (
          <ShieldForm pal={pal} dark={dark} bg={bg} zkAddress={privSnapshot?.zkAddress ?? null}
            initialSymbol={initialSymbol} initialChainId={initialChainId && Number.isFinite(initialChainId) ? initialChainId : undefined} />
        ) : (
          <>
            <RecipientField
              pal={pal}
              to={p.to}
              setTo={p.setTo}
              resolving={p.resolving}
              resolved={p.resolved}
              resolveErr={p.resolveErr}
            />

            <AmountField
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

            <SubmitButton dark={dark} tintBg={head} tintFg={bg} busy={p.busy} canSubmit={p.canSubmit} txState={p.txState} onSubmit={p.onSubmit} />

            <TxStatus sub={sub} txState={p.txState} txHash={p.txHash} txErr={p.txErr} />
          </>
        )}
      </ScrollView>
    </Box>
  );
}
