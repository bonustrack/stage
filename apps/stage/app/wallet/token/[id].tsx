import { Caption } from '@stage-labs/kit/react-native/caption';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { tokenDetailViewModel } from '@stage-labs/client/wallet/tokenDetail';
import { Box, Col, Row } from '../../../components/layout';
import { WalletHeader } from '../../../components/wallet/WalletHeader';
import { WalletActionButton } from '../../../components/widgets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePalette } from '../../../lib/theme';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '@stage-labs/client/wallet/assets';
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

const DETAIL_ACTIONS: DetailAction[] = [
  { label: 'Send', icon: 'send', action: 'send' },
];

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

function TokenDetailBody({ r, bg, border }: {
  r: AssetRow; bg: string; border: string;
}): React.ReactElement {
  const router = useRouter();
  const vm = tokenDetailViewModel(r, { networkLabels: NETWORK_LABEL });
  const onAction = (action: string): void => {
    if (action === 'send') {
      router.push({ pathname: '/wallet/send', params: { symbol: r.symbol, chainId: String(r.chainId) } });
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
            {DETAIL_ACTIONS.map((a) => (
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
  const { bg, border } = usePalette();

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

  return (
    <Col surface="surface" flex={1}>
      <WalletHeader title={r.name} backTone="link" truncate padBottom={8} />
      <TokenDetailBody r={r} bg={bg} border={border} />
    </Col>
  );
}
