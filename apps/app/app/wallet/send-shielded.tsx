/** Wallet → Send shielded token (private → private).
 *
 *  Transfers a token from the user's OWN 0zk shielded balance to ANOTHER 0zk
 *  address — fully private, never touching a public address. Reuses the existing
 *  runAction({ kind: 'send' }) path (wallet.ts → privateTransfer in sdkTx.ts):
 *  it estimates, generates the transfer proof, populates + broadcasts, and drives
 *  the shared pending-action store. This page subscribes to its own pending row
 *  and maps the phases to the same stepper the Shield page uses.
 *
 *  Token/network may be pre-selected via query params (from a shielded token's
 *  detail page). Recipient is a free 0zk address entered by the user. */
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { ActionPage, useFormPal } from './wallet.form';
import { SendShieldedForm } from './send-shielded.form';

export default function WalletSendShielded(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol?: string; chainId?: string }>();
  const { link: head, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = useFormPal();

  const initialSymbol = params.symbol === 'USDC' ? 'USDC' : 'ETH';
  const initialChainId = typeof params.chainId === 'string' && Number.isFinite(Number(params.chainId))
    ? Number(params.chainId) : 11155111;

  return (
    <ActionPage title="Send shielded" head={head} bg={bg} border={border} onBack={() => router.back()}>
      <SendShieldedForm pal={pal} dark={dark}
        initialSymbol={initialSymbol} initialChainId={initialChainId} />
    </ActionPage>
  );
}
