import { Caption } from '@stage-labs/kit/react-native/caption';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { tokenDetailViewModel } from '@stage-labs/client/wallet/tokenDetail';
import { Box, Col, Row } from '../../../components/layout';
import { WalletHeader } from '../../../components/wallet/WalletHeader';
import { WalletActionButton, WalletIcon } from '../../../components/wallet/widgets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePalette } from '../../../lib/theme';
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

interface DetailAction { label: string; icon: string; action: string }

function detailActions(isPrivate: boolean | undefined): DetailAction[] {
  if (isPrivate === true) {
    return [
      { label: 'Send', icon: 'send', action: 'send-private' },
      { label: 'Unshield', icon: 'eye', action: 'unshield' },
    ];
  }
  return [
    { label: 'Send', icon: 'send', action: 'send' },
    { label: 'Shield', icon: 'eyeOff', action: 'shield' },
  ];
}

function TokenDetailAvatar({ logoSrc, networkLogo, border, bg }: {
  logoSrc: string; networkLogo: string; border: string; bg: string;
}): React.ReactElement {
  return (
    <Box width={72} height={72}>
      <Image src={logoSrc} size={72} radius="full" background={border} />
      <Box
        width={30}
        height={30}
        radius="full"
        background={border}
        style={{ position: 'absolute', right: -2, bottom: -2, borderWidth: 3, borderColor: bg }}
      >
        <Image src={networkLogo} fit="cover" width="100%" height="100%" radius="full" />
      </Box>
    </Box>
  );
}

function TokenDetailBody({ r, symbol, sub, bg, border }: {
  r: AssetRow; symbol: 'ETH' | 'USDC' | undefined; sub: string; bg: string; border: string;
}): React.ReactElement {
  const router = useRouter();
  const vm = tokenDetailViewModel(r, { networkLabels: NETWORK_LABEL });
  const onAction = (action: string): void => {
    const sym = symbol ?? r.symbol;
    const chainId = String(r.chainId);
    if (action === 'send-private') {
      router.push({ pathname: '/wallet/send', params: { symbol: sym, chainId, private: '1' } });
    } else if (action === 'unshield') {
      router.push({ pathname: '/wallet/unshield', params: { symbol: sym, chainId } });
    } else if (action === 'shield') {
      router.push({ pathname: '/wallet/shield', params: { symbol: sym, chainId } });
    } else if (action === 'send') {
      router.push({ pathname: '/wallet/send', params: { symbol: r.symbol, chainId } });
    }
  };
  return (
    <Col padding={{ top: 28 }} margin={{ x: 16 }}>
      <Col align="start" gap={6}>
        <TokenDetailAvatar
          logoSrc={withStampDisplayPx(r.logoUrl, 72)}
          networkLogo={NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO}
          border={border}
          bg={bg}
        />
        <Row align="center" gap={6} margin={{ top: 10 }}>
          {r.isPrivate === true ? <WalletIcon name="eyeOff" color={sub} size={20} /> : null}
          <Title size="lg" color="link">{vm.name}</Title>
        </Row>
        <Box radius="full" padding={{ x: 10, y: 3 }} border={{
          top: { width: 1, color: border },
          right: { width: 1, color: border },
          bottom: { width: 1, color: border },
          left: { width: 1, color: border },
        }}>
          <Caption value={vm.networkLabel} color="secondary" size="sm" />
        </Box>
        <Title size="lg" hero="6xl" color="link">
          {vm.balanceLabel}
        </Title>
        <Text value={vm.usdLabel} size="md" color="secondary" />
        <Box padding={{ top: 18 }}>
          <Row gap={36} justify="start">
            {detailActions(r.isPrivate).map((a) => (
              <WalletActionButton
                key={a.action}
                label={a.label}
                icon={a.icon}
                bg={border}
                onPress={() => { onAction(a.action); }}
              />
            ))}
          </Row>
        </Box>
      </Col>
    </Col>
  );
}

export default function TokenDetail(): React.ReactElement {
  const params = useLocalSearchParams<{ id?: string; row?: string }>();
  const { text: sub, bg, border } = usePalette();

  const r = parseRow(params.row);

  if (!r) {
    return (
      <Col surface="surface" flex={1}>
        <WalletHeader title="Token" backTone="link" truncate padBottom={8} />
        <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
          <Text size="md" role="secondary">Token not found</Text>
        </Col>
      </Col>
    );
  }

  const symbol: 'ETH' | 'USDC' | undefined =
    r.symbol === 'ETH' ? 'ETH' : r.symbol === 'USDC' ? 'USDC' : undefined;

  return (
    <Col surface="surface" flex={1}>
      <WalletHeader title={r.name} backTone="link" truncate padBottom={8} />
      <TokenDetailBody r={r} symbol={symbol} sub={sub} bg={bg} border={border} />
    </Col>
  );
}
