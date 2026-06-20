/** @file Unified Wallet send-token screen routing each held token to an on-chain or Railgun 0zk transfer per the combined TokenSelector pick. */
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

  /** A caller can pin a token via `?symbol=&chainId=&private=`; otherwise default to the highest-USD-value holding once rows load. */
  const hasParamToken = typeof params.symbol === 'string' && params.symbol.length > 0;
  const initial = useMemo<TokenChoice>(() => {
    const isPrivate = params.private === '1' || params.private === 'true';
    const symbol = typeof params.symbol === 'string' && params.symbol.length > 0 ? params.symbol : 'ETH';
    const chainId = typeof params.chainId === 'string' && Number.isFinite(Number(params.chainId))
      ? Number(params.chainId) : isPrivate ? 11155111 : 1;
    return { symbol, chainId, isPrivate };
  }, [params.symbol, params.chainId, params.private, hasParamToken]);

  const [token, setToken] = useState<TokenChoice>(initial);

  /** Default-select the highest-value token once the list loads, unless pinned or user-picked; `touched` latches on first change so later refreshes don't override. */
  const topToken = useTopToken('combined');
  const touched = useRef(hasParamToken);
  useEffect(() => {
    if (touched.current || !topToken) return;
    touched.current = true;
    setToken(topToken);
  }, [topToken]);
  /** Handle the Change. */
  const onChange = (v: TokenChoice): void => { touched.current = true; setToken(v); };

  const balance = useSelectedBalance('combined', token);
  const initialTo = typeof params.to === 'string' ? params.to : '';

  /** Reset per-token body state on kind/symbol/chain change by keying the body on the selection identity. */
  const bodyKey = `${token.isPrivate ? 'priv' : 'pub'}:${token.chainId}:${token.symbol}`;

  /** The mounted body reports its submit state up for the pinned footer; useFooterReporter makes the report idempotent so re-reporting each render doesn't loop. */
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
