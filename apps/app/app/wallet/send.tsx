/** Wallet → Send token (unified public + shielded).
 *
 *  ONE page for sending any token the wallet holds. The combined TokenSelector
 *  modal lists EVERY positive-balance token — public AND Railgun-shielded — each
 *  row tagged with the shielded badge so the kind is obvious. Picking a token
 *  carries its `isPrivate` flag, and the page routes the send automatically:
 *
 *    • public token  → PublicSendBody  → sendNativeOrToken / send.public
 *    • shielded token → SendShieldedBody → runAction({ kind: 'send' }) (0zk→0zk)
 *
 *  There is NO manual public/shielded toggle — the chosen token decides. Shield
 *  (public→private) and Unshield (private→public) remain their own pages.
 *  `?to=` pre-fills the public recipient; `?symbol=&chainId=&private=` pre-select
 *  a token (e.g. from a token detail page's Send button). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Col } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { SendHeader } from './send.fields';
import { WalletFooter, useFooterReporter, useFormPal } from './wallet.form';
import { PublicSendBody } from './send.public.body';
import { ShieldFlowForm } from './send.shield';
import { TokenSelector, useSelectedBalance, useTopToken, type TokenChoice } from './TokenSelector';

/** Screen for sending tokens, supporting public and private transfers. */
export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ to?: string; symbol?: string; chainId?: string; private?: string }>();
  const { text: fg, link: head, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const formPal = useFormPal();

  // A caller can pin a token via `?symbol=&chainId=&private=`; otherwise we
  // default to the wallet's highest-USD-value holding once rows load (below).
  const hasParamToken = typeof params.symbol === 'string' && params.symbol.length > 0;
  const initial = useMemo<TokenChoice>(() => {
    const isPrivate = params.private === '1' || params.private === 'true';
    const symbol = typeof params.symbol === 'string' && params.symbol.length > 0 ? params.symbol : 'ETH';
    const chainId = typeof params.chainId === 'string' && Number.isFinite(Number(params.chainId))
      ? Number(params.chainId) : isPrivate ? 11155111 : 1;
    return { symbol, chainId, isPrivate };
  }, [params.symbol, params.chainId, params.private, hasParamToken]);

  const [token, setToken] = useState<TokenChoice>(initial);

  // Default-select the highest-value token once the combined list loads — unless
  // the caller pinned one via params or the user has already picked. `touched`
  // latches on the first apply/user change so we don't override later refreshes.
  const topToken = useTopToken('combined');
  const touched = useRef(hasParamToken);
  useEffect(() => {
    if (touched.current || !topToken) return;
    touched.current = true;
    setToken(topToken);
  }, [topToken]);
  const onChange = (v: TokenChoice): void => { touched.current = true; setToken(v); };

  const balance = useSelectedBalance('combined', token);
  const initialTo = typeof params.to === 'string' ? params.to : '';

  // Reset per-token body state when the kind/symbol/chain changes by keying the
  // body on the selection identity.
  const bodyKey = `${token.isPrivate ? 'priv' : 'pub'}:${token.chainId}:${token.symbol}`;

  // The mounted body (public or shielded) reports its submit state up so we can
  // render it in the pinned footer alongside Cancel. useFooterReporter makes the
  // report idempotent so the body re-reporting on every render doesn't loop.
  const { footer, report: reportFooter, onSubmit: footerSubmit } = useFooterReporter();

  return (
    <Col surface="surface" flex={1}>
      <SendHeader fg={fg} head={head} border={border} onBack={() => { router.back(); }}/>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16 }}>
        <TokenSelector mode="combined" value={token} onChange={onChange}/>

        {token.isPrivate ? (
          <ShieldFlowForm key={bodyKey} mode="send" pal={formPal} dark={dark}
            symbol={token.symbol === 'USDC' ? 'USDC' : 'ETH'} chainId={token.chainId} balance={balance}
            onFooter={reportFooter}/>
        ) : (
          <PublicSendBody key={bodyKey} token={token} initialTo={initialTo} onFooter={reportFooter}/>
        )}
      </ScrollView>

      {footer ? (
        <WalletFooter border={border} dark={dark} onCancel={() => { router.back(); }}
          submitLabel={footer.submitLabel} onSubmit={footerSubmit}
          submitDisabled={footer.submitDisabled} submitLoading={footer.submitLoading}/>
      ) : null}
    </Col>
  );
}
