import { useEffect, useMemo, useRef, useState } from 'react';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { basicRoot, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import { Col } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { WalletFooter, useFooterReporter, useFormPal } from './wallet.form';
import { PublicSendBody } from './send.public.body';
import { ShieldFlowForm } from './send.shield';
import { TokenSelector, useSelectedBalance, useTopToken, type TokenChoice } from './TokenSelector';

export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ to?: string; symbol?: string; chainId?: string; private?: string }>();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const formPal = useFormPal();

  const hasParamToken = typeof params.symbol === 'string' && params.symbol.length > 0;
  const initial = useMemo<TokenChoice>(() => {
    const isPrivate = params.private === '1' || params.private === 'true';
    const symbol = typeof params.symbol === 'string' && params.symbol.length > 0 ? params.symbol : 'ETH';
    const chainId = typeof params.chainId === 'string' && Number.isFinite(Number(params.chainId))
      ? Number(params.chainId) : isPrivate ? 11155111 : 1;
    return { symbol, chainId, isPrivate };
  }, [params.symbol, params.chainId, params.private, hasParamToken]);

  const [token, setToken] = useState<TokenChoice>(initial);

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

  const bodyKey = `${token.isPrivate ? 'priv' : 'pub'}:${token.chainId}:${token.symbol}`;

  const { footer, report: reportFooter, onSubmit: footerSubmit } = useFooterReporter();

  const headerNode = basicRoot(screenHeader({
    title: 'Send token',
    titleStyle: { kind: 'text', size: 'xl', weight: 'semibold', color: head },
    backColor: fg,
    safeTop: insets.top,
    surface: toolbarBg,
    borderColor: border,
  }));
  const registry: WidgetActionRegistry = {
    [SCREEN_BACK]: () => { router.back(); },
  };

  return (
    <Col surface="surface" flex={1}>
      <KitRenderer node={headerNode} registry={registry} />

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
