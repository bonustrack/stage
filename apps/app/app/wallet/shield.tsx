/**
 * @file Wallet shield-token screen depositing a public token into the user's
 * own 0zk shielded balance via shieldToPrivate; a focused shell around
 * ShieldFlowForm with the recipient locked to the user's own 0zk address.
 */
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { ActionPage, WalletFooter, useFooterReporter, useFormPal } from './wallet.form';
import { ShieldFlowForm } from './send.shield';

/** Screen for shielding tokens from a public balance into a private one. */
export default function WalletShield(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol?: string; chainId?: string }>();
  const { link: head, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = useFormPal();
  const { snapshot } = usePrivateWallet();
  const { footer, report: reportFooter, onSubmit: footerSubmit } = useFooterReporter();

  const initialSymbol = params.symbol === 'USDC' ? 'USDC' : params.symbol === 'ETH' ? 'ETH' : undefined;
  const initialChainId = typeof params.chainId === 'string' ? Number(params.chainId) : undefined;

  return (
    <ActionPage title="Shield token" head={head} bg={bg} border={border} onBack={() => { router.back(); }}
      footer={footer ? (
        <WalletFooter border={border} dark={dark} onCancel={() => { router.back(); }}
          submitLabel={footer.submitLabel} onSubmit={footerSubmit}
          submitDisabled={footer.submitDisabled} submitLoading={footer.submitLoading} />
      ) : null}>
      <ShieldFlowForm mode="shield" pal={pal} dark={dark} zkAddress={snapshot?.zkAddress ?? null}
        initialSymbol={initialSymbol}
        initialChainId={initialChainId && Number.isFinite(initialChainId) ? initialChainId : undefined}
        onFooter={reportFooter} />
    </ActionPage>
  );
}
