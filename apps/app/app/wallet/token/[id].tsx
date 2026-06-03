/** Wallet → Token detail screen.
 *
 *  Reached by tapping a token row on the Wallet page. The full AssetRow is
 *  passed through the route params as JSON (`?row=…`) so this page renders the
 *  exact same balance/price/logo the list showed — no refetch, instant paint.
 *
 *  Shows the token (logo + network badge, name, symbol, balance + $ value) and
 *  TWO big rounded primary buttons reusing the Wallet page's action-button
 *  style (`Btn` from WalletScreen.parts):
 *    - Send  → /wallet/send pre-selected to this token's symbol/network.
 *    - Shield → /wallet/send?mode=shield pre-selected to this token (deposits
 *               the public token into the user's own 0zk shielded balance).
 *
 *  Both buttons route to the existing send.tsx; pre-fill is via query params
 *  (mode/symbol/chainId) read by send.tsx + ShieldForm. */

import { Image, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Col, Row } from '../../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../../../lib/theme';
import { Btn, fmtUsd, fmtBalance } from '../../../components/tabs/WalletScreen.parts';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '../../../components/tabs/WalletScreen.assets';

const NETWORK_LABEL: Record<number, string> = { 1: 'Ethereum', 11155111: 'Sepolia' };

/** Parse the serialized AssetRow param. Returns null when missing/malformed so
 *  the screen can render a graceful fallback instead of crashing. */
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
  const { head, sub, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const r = parseRow(params.row);

  if (!r) {
    return (
      <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
        <Header head={head} border={border} onBack={() => router.back()} title="Token" />
        <Col mx={16} py={40} align="center">
          <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Token not found</Text>
        </Col>
      </Box>
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
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <Header head={head} border={border} onBack={() => router.back()} title={r.name} />

      {/* Token identity card — large logo with network badge, name + symbol,
          balance and its USD value. Mirrors the list row's data, scaled up. */}
      <Col mx={16} pt={28} align="center" gap={6}>
        <Box style={{ width: 72, height: 72 }}>
          <Image source={{ uri: r.logoUrl }}
            style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: border }} />
          <Box style={{
            position: 'absolute', right: -2, bottom: -2,
            width: 30, height: 30, borderRadius: 999,
            borderWidth: 3, borderColor: bg, backgroundColor: border, overflow: 'hidden',
          }}>
            <Image source={{ uri: NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO }}
              resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          </Box>
        </Box>

        <Row align="center" gap={6} mt={10}>
          {r.isPrivate ? <Icon name="eyeOff" size={18} color={sub} /> : null}
          <Text style={{ color: head, fontSize: 24, fontFamily: 'Calibre-Semibold' }}>{r.name}</Text>
        </Row>

        {/* Network badge pill */}
        <Box style={{
          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
          borderWidth: 1, borderColor: border,
        }}>
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            {NETWORK_LABEL[r.chainId] ?? `Chain ${r.chainId}`}
          </Text>
        </Box>

        <Text style={{ color: head, fontSize: 34, fontFamily: 'Calibre-Semibold', marginTop: 14 }}>
          {`${fmtBalance(r.balance)} ${r.symbol}`}
        </Text>
        <Text style={{ color: sub, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
          {valueUsd === null ? '—' : fmtUsd(valueUsd)}
        </Text>
      </Col>

      {/* Two big rounded action buttons — same component/style as the Wallet
          page's Send/Receive/Swap/Buy circles. Send opens the public send
          flow pre-selected to this token; Shield opens send.tsx in shield
          mode pre-selected to this token. */}
      <Row justify="center" gap={36} mt={32}>
        <Btn icon="send" label="Send" head={head} dark={dark}
          onPress={() => router.push({ pathname: '/wallet/send', params: sendParams })} />
        {r.isPrivate ? (
          /* Shielded holding → Unshield (private → public, back to own EOA). */
          <Btn icon="eye" label="Unshield" head={head} dark={dark}
            onPress={() => router.push({
              pathname: '/wallet/unshield',
              params: { symbol: symbol ?? r.symbol, chainId: String(r.chainId) },
            })} />
        ) : (
          /* Public holding → Shield (public → own 0zk). */
          <Btn icon="eyeOff" label="Shield" head={head} dark={dark}
            onPress={() => router.push({
              pathname: '/wallet/send',
              params: { mode: 'shield', symbol: symbol ?? r.symbol, chainId: String(r.chainId) },
            })} />
        )}
      </Row>
    </Box>
  );
}

/** Local back-header (the shared SendHeader hardcodes "Send"). */
function Header({ head, border, onBack, title }: {
  head: string; border: string; onBack: () => void; title: string;
}): React.ReactElement {
  return (
    <Row align="center" gap={8} px={12} py={8}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={head} />
      </Pressable>
      <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Row>
  );
}
