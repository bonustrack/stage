/** Wallet → Shield token (public → private).
 *
 *  Deposits a PUBLIC token into the user's OWN 0zk shielded balance. Recipient
 *  is ALWAYS the user's own 0zk address (locked). Token/network pre-selected via
 *  query params from the token detail page's Shield button. Runs the existing
 *  shieldToPrivate() flow — this page is just the focused shell around ShieldForm. */
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { ActionPage, WalletFooter, useFormPal, type FooterState } from './wallet.form';
import { ShieldForm } from './send.shield';

export default function WalletShield(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol?: string; chainId?: string }>();
  const { link: head, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = useFormPal();
  const { snapshot } = usePrivateWallet();
  const [footer, setFooter] = useState<FooterState | null>(null);

  const initialSymbol = params.symbol === 'USDC' ? 'USDC' : params.symbol === 'ETH' ? 'ETH' : undefined;
  const initialChainId = typeof params.chainId === 'string' ? Number(params.chainId) : undefined;

  return (
    <ActionPage title="Shield token" head={head} bg={bg} border={border} onBack={() => router.back()}
      footer={footer ? (
        <WalletFooter border={border} bg={bg} dark={dark} onCancel={() => router.back()}
          submitLabel={footer.submitLabel} onSubmit={footer.onSubmit}
          submitDisabled={footer.submitDisabled} submitLoading={footer.submitLoading} />
      ) : null}>
      <ShieldForm pal={pal} dark={dark} zkAddress={snapshot?.zkAddress ?? null}
        initialSymbol={initialSymbol}
        initialChainId={initialChainId && Number.isFinite(initialChainId) ? initialChainId : undefined}
        onFooter={setFooter} />
    </ActionPage>
  );
}
