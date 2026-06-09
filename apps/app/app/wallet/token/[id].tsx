/** Wallet → Token detail screen.
 *
 *  Reached by tapping a token row on the Wallet page. The full AssetRow is
 *  passed through the route params as JSON (`?row=…`) so this page renders the
 *  exact same balance/price/logo the list showed — no refetch, instant paint.
 *
 *  Shows the token (logo + network badge, name, symbol, balance + $ value) and
 *  TWO big rounded primary buttons reusing the Wallet page's action-button
 *  style (`Btn` from WalletScreen.parts):
 *  Public holding:  Send → /wallet/send,  Shield → /wallet/shield.
 *  Shielded holding: Send → /wallet/send (unified page, pre-selected to the
 *                    shielded token via ?private=1 → private 0zk transfer),
 *                    Unshield → /wallet/unshield.
 *  Pre-fill is via query params (symbol/chainId) read by each page. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Image } from '@metro-labs/kit/image';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Col, Row } from '../../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../../../lib/theme';
import { Btn, fmtUsd, fmtBalance } from '../../../components/tabs/WalletScreen.parts';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '../../../components/tabs/WalletScreen.assets';
import { withStampDisplayPx } from '@metro-labs/kit/avatar';

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
  const { link: head, text: sub, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';

  const r = parseRow(params.row);

  if (!r) {
    return (
      <Box style={{ flex: 1, backgroundColor: bg }}>
        <Header head={head} border={border} onBack={() => router.back()} title="Token" />
        <Col mx={16} py={40} align="center">
          <Text size="md" style={{ color: sub }}>Token not found</Text>
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
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <Header head={head} border={border} onBack={() => router.back()} title={r.name} />

      {/* Token identity card — large logo with network badge, name + symbol,
          balance and its USD value. Mirrors the list row's data, scaled up.
          LEFT-aligned to match the Wallet page's left-aligned value card. */}
      <Col mx={16} pt={28} align="start" gap={6}>
        <Box style={{ width: 72, height: 72 }}>
          {/* r.logoUrl is cached at the 32px LIST size (s=64); re-request it at
              2× the 72px detail size (s=144) so the big logo stays crisp. */}
          <Image src={withStampDisplayPx(r.logoUrl, 72)}
            style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: border }} />
          <Box style={{
            position: 'absolute', right: -2, bottom: -2,
            width: 30, height: 30, borderRadius: 999,
            borderWidth: 3, borderColor: bg, backgroundColor: border, overflow: 'hidden',
          }}>
            <Image src={NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO}
              fit="cover" style={{ width: '100%', height: '100%' }} />
          </Box>
        </Box>

        <Row align="center" gap={6} mt={10}>
          {r.isPrivate ? <Icon name="eyeOff" size={18} color={sub} /> : null}
          <Text weight="semibold" size="xxl" style={{ color: head }}>{r.name}</Text>
        </Row>

        {/* Network badge pill */}
        <Box style={{
          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
          borderWidth: 1, borderColor: border,
        }}>
          <Text size="sm" style={{ color: sub }}>
            {NETWORK_LABEL[r.chainId] ?? `Chain ${r.chainId}`}
          </Text>
        </Box>

        <Text weight="semibold" size="xxxl" style={{ color: head, marginTop: 14 }}>
          {`${fmtBalance(r.balance)} ${r.symbol}`}
        </Text>
        <Text size="md" style={{ color: sub }}>
          {valueUsd === null ? '—' : fmtUsd(valueUsd)}
        </Text>
      </Col>

      {/* Two big rounded action buttons — same component/style as the Wallet
          page's Send/Receive/Swap/Buy circles. Send opens the public send
          flow pre-selected to this token; Shield opens send.tsx in shield
          mode pre-selected to this token. */}
      <Row justify="start" gap={36} mt={32} mx={16}>
        {r.isPrivate ? (
          <>
            {/* Shielded holding → unified Send page, pre-selected to this
                shielded token (private → another 0zk). */}
            <Btn icon="send" label="Send" head={head} border={border} dark={dark}
              onPress={() => router.push({
                pathname: '/wallet/send',
                params: { symbol: symbol ?? r.symbol, chainId: String(r.chainId), private: '1' },
              })} />
            {/* Shielded holding → Unshield (private → public, back to own EOA). */}
            <Btn icon="eye" label="Unshield" head={head} border={border} dark={dark}
              onPress={() => router.push({
                pathname: '/wallet/unshield',
                params: { symbol: symbol ?? r.symbol, chainId: String(r.chainId) },
              })} />
          </>
        ) : (
          <>
            {/* Public holding → public Send. */}
            <Btn icon="send" label="Send" head={head} border={border} dark={dark}
              onPress={() => router.push({ pathname: '/wallet/send', params: sendParams })} />
            {/* Public holding → Shield (public → own 0zk). */}
            <Btn icon="eyeOff" label="Shield" head={head} border={border} dark={dark}
              onPress={() => router.push({
                pathname: '/wallet/shield',
                params: { symbol: symbol ?? r.symbol, chainId: String(r.chainId) },
              })} />
          </>
        )}
      </Row>
    </Box>
  );
}

/** Local back-header (the shared SendHeader hardcodes "Send"). */
function Header({ head, border, onBack, title }: {
  head: string; border: string; onBack: () => void; title: string;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { toolbarBg } = usePalette();
  return (
    <Row align="center" gap={8} px={12}
      style={{
        borderBottomWidth: 1, borderBottomColor: border,
        backgroundColor: toolbarBg, paddingTop: 8 + insets.top, paddingBottom: 8,
      }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={head} />
      </Pressable>
      <Text weight="semibold" size="lg" style={{ color: head, flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Row>
  );
}
