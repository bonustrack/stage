
import { Pressable } from '@stage-labs/kit/pressable';

import { Image } from '@stage-labs/kit/image';
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Box, Col, Row } from '../../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../../../lib/theme';
import { Btn, fmtUsd, fmtBalance } from '../../../components/tabs/WalletScreen.parts';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '../../../components/tabs/WalletScreen.assets';
import { withStampDisplayPx } from '@stage-labs/kit/avatar';

const NETWORK_LABEL: Record<number, string> = { 1: 'Ethereum', 11155111: 'Sepolia' };

function parseRow(raw: string | undefined): AssetRow | null {
  if (typeof raw !== 'string') return null;
  try {
    const r = JSON.parse(raw) as Partial<AssetRow>;
    if (typeof r.symbol !== 'string' || typeof r.chainId !== 'number') return null;
    return r as AssetRow;
  } catch {
    return null;
  }
}

export default function TokenDetail(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; row?: string }>();
  const { link: head, text: sub, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';

  const r = parseRow(params.row);

  if (!r) {
    return (
      <Col surface="surface" flex={1}>
        <Header head={head} border={border} onBack={() => { router.back(); }} title="Token"/>
        <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
          <Text size="md" color={sub}>Token not found</Text>
        </Col>
      </Col>
    );
  }

  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  const symbol: 'ETH' | 'USDC' | undefined =
    r.symbol === 'ETH' ? 'ETH' : r.symbol === 'USDC' ? 'USDC' : undefined;
  const sendParams = {
    symbol: r.symbol,
    chainId: String(r.chainId),
  };

  return (
    <Col surface="surface" flex={1}>
      <Header head={head} border={border} onBack={() => { router.back(); }} title={r.name}/>

      {}
      <Col padding={{ top: 28 }} margin={{ x: 16 }} align="start" gap={6}>
        <Box width={72} height={72}>
          {}
          <Image src={withStampDisplayPx(r.logoUrl, 72)}
            style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: border }}/>
          <Box width={30} height={30} radius="full" background={border} style={{ position: 'absolute', right: -2, bottom: -2, borderWidth: 3, borderColor: bg, overflow: 'hidden' }}>
            <Image src={NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO}
              fit="cover" style={{ width: '100%', height: '100%' }}/>
          </Box>
        </Box>

        <Row margin={{ top: 10 }} align="center" gap={6}>
          {r.isPrivate ? <Icon name="eyeOff" size={18} color={sub} /> : null}
          <Text weight="semibold" size="5xl" color={head}>{r.name}</Text>
        </Row>

        {}
        <Box radius="full" padding={{ x: 10, y: 3 }} style={{ borderWidth: 1, borderColor: border }}>
          <Text size="xs" color={sub}>
            {NETWORK_LABEL[r.chainId] ?? `Chain ${r.chainId}`}
          </Text>
        </Box>

        <Text weight="semibold" size="6xl" color={head} style={{ marginTop: 14 }}>
          {`${fmtBalance(r.balance)} ${r.symbol}`}
        </Text>
        <Text size="md" color={sub}>
          {valueUsd === null ? '—' : fmtUsd(valueUsd)}
        </Text>
      </Col>

      {}
      <Row margin={{ x: 16, top: 32 }} justify="start" gap={36}>
        {r.isPrivate ? (
          <>
            {}
            <Btn icon="send" label="Send" head={head} border={border} dark={dark}
              onPress={() => { router.push({
                pathname: '/wallet/send',
                params: { symbol: symbol ?? r.symbol, chainId: String(r.chainId), private: '1' },
              }); }}/>
            {}
            <Btn icon="eye" label="Unshield" head={head} border={border} dark={dark}
              onPress={() => { router.push({
                pathname: '/wallet/unshield',
                params: { symbol: symbol ?? r.symbol, chainId: String(r.chainId) },
              }); }}/>
          </>
        ) : (
          <>
            {}
            <Btn icon="send" label="Send" head={head} border={border} dark={dark}
              onPress={() => { router.push({ pathname: '/wallet/send', params: sendParams }); }}/>
            {}
            <Btn icon="eyeOff" label="Shield" head={head} border={border} dark={dark}
              onPress={() => { router.push({
                pathname: '/wallet/shield',
                params: { symbol: symbol ?? r.symbol, chainId: String(r.chainId) },
              }); }}/>
          </>
        )}
      </Row>
    </Col>
  );
}

function Header({ head, border, onBack, title }: {
  head: string; border: string; onBack: () => void; title: string;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 8 }} align="center" gap={8} 
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={head}/>
      </Pressable>
      <Text weight="semibold" size="xl" color={head} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Row>
  );
}
